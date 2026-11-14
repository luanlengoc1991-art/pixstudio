// LMS Studio backend: accounts, license keys, devices and sessions (D1 "lms-auth").
//
//   POST /api/auth/login     { username, password, deviceId, deviceName?, key? }
//   GET  /api/auth/me        (Bearer) re-checks account, key and device
//   POST /api/auth/logout    (Bearer)
//   POST /api/auth/password  (Bearer) { oldPassword, newPassword }
//   /api/admin/...           (Bearer, admin) users, keys, devices, stats
//
// Passwords: PBKDF2-SHA256; session tokens are random and stored only as SHA-256.
// Responses are never cached.

interface Env {
  DB: D1Database;
}

type Row = Record<string, unknown>;

const DAY = 86_400_000;
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100_000;
const MAX_FAILURES = 10;
const FAILURE_WINDOW = 15 * 60_000;

class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
  "access-control-max-age": "86400",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...CORS },
  });

const fail = (status: number, code: string, message: string): never => {
  throw new ApiError(status, code, message);
};

// ---------- crypto helpers ----------

const enc = new TextEncoder();
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, iter, salt, hash] = stored.split("$");
  if (kind !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = await pbkdf2(password, unb64(salt), Number(iter));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const KEY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newLicenseKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = [...bytes].map((b) => KEY_ALPHABET[b % KEY_ALPHABET.length]).join("");
  return `LMS-${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}-${chars.slice(12, 16)}`;
}
const normalizeKey = (k: unknown) => String(k ?? "").trim().toUpperCase().replace(/\s+/g, "");

// ---------- input helpers ----------

function str(body: Row, name: string, opts: { min?: number; max?: number; required?: boolean } = {}): string {
  const v = body[name];
  if (v === undefined || v === null || v === "") {
    if (opts.required) fail(400, "BAD_INPUT", `Thiếu ${name}`);
    return "";
  }
  if (typeof v !== "string") fail(400, "BAD_INPUT", `${name} không hợp lệ`);
  const s = (v as string).trim();
  if (opts.min && s.length < opts.min) fail(400, "BAD_INPUT", `${name} cần ít nhất ${opts.min} ký tự`);
  if (s.length > (opts.max ?? 200)) fail(400, "BAD_INPUT", `${name} quá dài`);
  return s;
}

function int(body: Row, name: string, min: number, max: number, fallback: number): number {
  const v = body[name];
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(400, "BAD_INPUT", `${name} phải là số từ ${min} đến ${max}`);
  return n;
}

const USERNAME_RE = /^[A-Za-z0-9._@-]{3,64}$/;

async function readBody(request: Request): Promise<Row> {
  if (request.method === "GET" || request.method === "DELETE") return {};
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const body = JSON.parse(text);
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Row) : {};
  } catch {
    return fail(400, "BAD_INPUT", "Dữ liệu gửi lên không phải JSON");
  }
}

// ---------- licenses ----------

interface License {
  key: string;
  user_id: number | null;
  duration_days: number;
  max_devices: number;
  status: string;
  note: string;
  created_at: number;
  activated_at: number | null;
  expires_at: number | null;
}

const isLive = (l: License, now: number) => l.status === "active" && (l.expires_at === null || l.expires_at > now);

/** The account's best key right now: live, the one that lasts longest (never-expiring first). */
async function currentLicense(db: D1Database, userId: number, now: number): Promise<{ live?: License; expired?: License }> {
  const { results } = await db
    .prepare("SELECT * FROM licenses WHERE user_id = ? ORDER BY expires_at IS NOT NULL, expires_at DESC")
    .bind(userId)
    .all<License>();
  const live = results.find((l) => isLive(l, now));
  return { live, expired: live ? undefined : results.find((l) => l.status === "active") };
}

async function deviceCount(db: D1Database, key: string): Promise<number> {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM devices WHERE license_key = ?").bind(key).first<{ n: number }>();
  return r?.n ?? 0;
}

async function licenseView(db: D1Database, l: License) {
  return {
    key: l.key,
    expiresAt: l.expires_at,
    maxDevices: l.max_devices,
    devices: await deviceCount(db, l.key),
    activatedAt: l.activated_at,
  };
}

// ---------- sessions ----------

interface SessionUser {
  id: number;
  username: string;
  role: string;
  display_name: string;
  disabled: number;
  device_id: string;
  token_hash: string;
}

async function authenticate(request: Request, env: Env, now: number): Promise<SessionUser> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) fail(401, "NO_SESSION", "Chưa đăng nhập");
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.role, u.display_name, u.disabled, s.device_id, s.token_hash
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now)
    .first<SessionUser>();
  if (!row) fail(401, "NO_SESSION", "Phiên đăng nhập đã hết, hãy đăng nhập lại");
  if (row!.disabled) fail(403, "DISABLED", "Tài khoản đã bị khoá. Liên hệ quản trị viên.");
  return row!;
}

const userView = (u: { username: string; role: string; display_name: string }) => ({
  username: u.username,
  displayName: u.display_name || u.username,
  role: u.role,
});

// ---------- auth routes ----------

async function login(env: Env, body: Row, now: number) {
  const db = env.DB;
  const username = str(body, "username", { required: true, max: 64 });
  const password = str(body, "password", { required: true, max: 200 });
  const deviceId = str(body, "deviceId", { max: 100 });
  const deviceName = str(body, "deviceName", { max: 120 }) || "Không rõ";
  const keyInput = normalizeKey(body.key);

  const failures = await db
    .prepare("SELECT count, first_at FROM login_failures WHERE username = ?")
    .bind(username)
    .first<{ count: number; first_at: number }>();
  if (failures && failures.count >= MAX_FAILURES && now - failures.first_at < FAILURE_WINDOW) {
    fail(429, "TOO_MANY", "Sai mật khẩu quá nhiều lần. Thử lại sau 15 phút.");
  }

  const user = await db.prepare("SELECT * FROM users WHERE username = ?").bind(username).first<Row>();
  if (!user || !(await verifyPassword(password, String(user.pass_hash)))) {
    if (failures && now - failures.first_at < FAILURE_WINDOW) {
      await db.prepare("UPDATE login_failures SET count = count + 1 WHERE username = ?").bind(username).run();
    } else {
      await db
        .prepare("INSERT OR REPLACE INTO login_failures (username, count, first_at) VALUES (?, 1, ?)")
        .bind(username, now)
        .run();
    }
    fail(401, "BAD_LOGIN", "Sai tên đăng nhập hoặc mật khẩu");
  }
  const u = user!;
  if (u.disabled) fail(403, "DISABLED", "Tài khoản đã bị khoá. Liên hệ quản trị viên.");
  const userId = Number(u.id);
  await db.prepare("DELETE FROM login_failures WHERE username = ?").bind(username).run();

  let license: License | undefined;
  if (u.role !== "admin") {
    if (keyInput) {
      const l = await db.prepare("SELECT * FROM licenses WHERE key = ?").bind(keyInput).first<License>();
      if (!l || l.status !== "active") fail(403, "KEY_INVALID", "Key không đúng hoặc đã bị thu hồi");
      if (l!.user_id !== null && l!.user_id !== userId) fail(403, "KEY_USED", "Key này đã được dùng cho tài khoản khác");
      if (l!.expires_at !== null && l!.expires_at <= now) fail(403, "KEY_EXPIRED", "Key đã hết hạn");
      if (l!.user_id === null) {
        const expires = l!.expires_at ?? (l!.duration_days > 0 ? now + l!.duration_days * DAY : null);
        await db
          .prepare("UPDATE licenses SET user_id = ?, activated_at = ?, expires_at = ? WHERE key = ? AND user_id IS NULL")
          .bind(userId, now, expires, l!.key)
          .run();
        l!.user_id = userId;
        l!.activated_at = now;
        l!.expires_at = expires;
      }
      license = l!;
    } else {
      const { live, expired } = await currentLicense(db, userId, now);
      if (!live) {
        if (expired) fail(403, "KEY_EXPIRED", "Key của tài khoản đã hết hạn. Nhập key mới để gia hạn.");
        fail(403, "NEED_KEY", "Tài khoản chưa có key. Nhập key bản quyền để kích hoạt.");
      }
      license = live;
    }

    if (deviceId.length < 8) fail(400, "BAD_INPUT", "Thiếu mã máy");
    const known = await db
      .prepare("SELECT id FROM devices WHERE license_key = ? AND device_id = ?")
      .bind(license!.key, deviceId)
      .first();
    if (known) {
      await db
        .prepare("UPDATE devices SET last_seen = ?, device_name = ? WHERE id = ?")
        .bind(now, deviceName, known.id)
        .run();
    } else {
      if ((await deviceCount(db, license!.key)) >= license!.max_devices) {
        fail(
          403,
          "DEVICE_LIMIT",
          `Key này đã dùng đủ ${license!.max_devices} máy. Liên hệ quản trị viên để gỡ máy cũ.`,
        );
      }
      await db
        .prepare(
          "INSERT INTO devices (license_key, device_id, device_name, first_seen, last_seen) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(license!.key, deviceId, deviceName, now, now)
        .run();
    }
  }

  const token = randomToken();
  await db.batch([
    db
      .prepare("INSERT INTO sessions (token_hash, user_id, device_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(await sha256(token), userId, deviceId, now, now + SESSION_DAYS * DAY),
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").bind(now, userId),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
  ]);
  return {
    token,
    user: userView(u as { username: string; role: string; display_name: string }),
    license: license ? await licenseView(db, license) : null,
  };
}

async function me(request: Request, env: Env, now: number) {
  const db = env.DB;
  const s = await authenticate(request, env, now);
  let license: License | undefined;
  if (s.role !== "admin") {
    const { live, expired } = await currentLicense(db, s.id, now);
    if (!live) {
      if (expired) fail(403, "KEY_EXPIRED", "Key của tài khoản đã hết hạn. Nhập key mới để gia hạn.");
      fail(403, "NEED_KEY", "Tài khoản chưa có key còn hiệu lực.");
    }
    license = live;
    const dev = await db
      .prepare("SELECT id FROM devices WHERE license_key = ? AND device_id = ?")
      .bind(license!.key, s.device_id)
      .first();
    if (!dev) fail(403, "DEVICE_REMOVED", "Máy này đã bị gỡ khỏi key. Đăng nhập lại.");
    await db.prepare("UPDATE devices SET last_seen = ? WHERE id = ?").bind(now, dev!.id).run();
  }
  // sliding expiry
  await db
    .prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?")
    .bind(now + SESSION_DAYS * DAY, s.token_hash)
    .run();
  return { user: userView(s), license: license ? await licenseView(db, license) : null, serverTime: now };
}

async function changePassword(request: Request, env: Env, body: Row, now: number) {
  const s = await authenticate(request, env, now);
  const oldPassword = str(body, "oldPassword", { required: true });
  const newPassword = str(body, "newPassword", { required: true, min: 6 });
  const u = await env.DB.prepare("SELECT pass_hash FROM users WHERE id = ?").bind(s.id).first<{ pass_hash: string }>();
  if (!u || !(await verifyPassword(oldPassword, u.pass_hash))) fail(403, "BAD_LOGIN", "Mật khẩu cũ không đúng");
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").bind(await hashPassword(newPassword), s.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(s.id, s.token_hash),
  ]);
  return { ok: true };
}

// ---------- admin routes ----------

async function createKeys(db: D1Database, count: number, days: number, maxDevices: number, note: string, now: number, userId: number | null) {
  const keys: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0; i < count; i++) {
    const key = newLicenseKey();
    keys.push(key);
    const activated = userId !== null ? now : null;
    const expires = userId !== null && days > 0 ? now + days * DAY : null;
    stmts.push(
      db
        .prepare(
          `INSERT INTO licenses (key, user_id, duration_days, max_devices, note, created_at, activated_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(key, userId, days, maxDevices, note, now, activated, expires),
    );
  }
  await db.batch(stmts);
  return keys;
}

async function admin(request: Request, env: Env, parts: string[], body: Row, now: number) {
  const db = env.DB;
  const s = await authenticate(request, env, now);
  if (s.role !== "admin") fail(403, "FORBIDDEN", "Chỉ quản trị viên mới dùng được");
  const m = request.method;
  const [area, id, sub] = parts;

  if (area === "stats" && m === "GET") {
    const one = async (sql: string, ...args: unknown[]) =>
      (await db.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
    return {
      users: await one("SELECT COUNT(*) AS n FROM users WHERE role = 'user'"),
      keys: await one("SELECT COUNT(*) AS n FROM licenses"),
      liveKeys: await one(
        "SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NOT NULL AND (expires_at IS NULL OR expires_at > ?)",
        now,
      ),
      unusedKeys: await one("SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NULL"),
      devices: await one("SELECT COUNT(*) AS n FROM devices"),
      activeToday: await one("SELECT COUNT(*) AS n FROM devices WHERE last_seen > ?", now - DAY),
    };
  }

  if (area === "users") {
    if (!id && m === "GET") {
      const { results } = await db
        .prepare(
          `SELECT u.id, u.username, u.display_name, u.role, u.note, u.disabled, u.created_at, u.last_login_at,
                  (SELECT COUNT(*) FROM licenses l WHERE l.user_id = u.id) AS key_count,
                  (SELECT MAX(COALESCE(l.expires_at, 9e15)) FROM licenses l
                     WHERE l.user_id = u.id AND l.status = 'active') AS expires_at,
                  (SELECT COUNT(*) FROM devices d JOIN licenses l ON l.key = d.license_key WHERE l.user_id = u.id) AS devices
             FROM users u ORDER BY u.created_at DESC`,
        )
        .all();
      return { users: results };
    }
    if (!id && m === "POST") {
      const username = str(body, "username", { required: true });
      if (!USERNAME_RE.test(username)) fail(400, "BAD_INPUT", "Tên đăng nhập 3-64 ký tự: chữ, số, . _ @ -");
      const password = str(body, "password", { required: true, min: 6 });
      const role = body.role === "admin" ? "admin" : "user";
      const exists = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
      if (exists) fail(409, "EXISTS", "Tên đăng nhập đã có");
      const r = await db
        .prepare("INSERT INTO users (username, pass_hash, role, display_name, note, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(username, await hashPassword(password), role, str(body, "displayName", { max: 100 }), str(body, "note", { max: 500 }), now)
        .run();
      const userId = Number(r.meta.last_row_id);
      let keys: string[] = [];
      if (role === "user" && body.withKey) {
        keys = await createKeys(db, 1, int(body, "days", 0, 36500, 30), int(body, "maxDevices", 1, 100, 1), str(body, "keyNote", { max: 500 }), now, userId);
      }
      return { id: userId, username, keys };
    }
    const userId = Number(id);
    if (!Number.isInteger(userId)) fail(404, "NOT_FOUND", "Không tìm thấy");
    if (m === "PATCH") {
      const stmts: D1PreparedStatement[] = [];
      if (body.password !== undefined) {
        const pw = str(body, "password", { required: true, min: 6 });
        stmts.push(db.prepare("UPDATE users SET pass_hash = ? WHERE id = ?").bind(await hashPassword(pw), userId));
        stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId));
      }
      if (body.disabled !== undefined) {
        if (userId === s.id) fail(400, "BAD_INPUT", "Không thể tự khoá chính mình");
        stmts.push(db.prepare("UPDATE users SET disabled = ? WHERE id = ?").bind(body.disabled ? 1 : 0, userId));
        if (body.disabled) stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId));
      }
      if (body.displayName !== undefined)
        stmts.push(db.prepare("UPDATE users SET display_name = ? WHERE id = ?").bind(str(body, "displayName", { max: 100 }), userId));
      if (body.note !== undefined)
        stmts.push(db.prepare("UPDATE users SET note = ? WHERE id = ?").bind(str(body, "note", { max: 500 }), userId));
      if (stmts.length) await db.batch(stmts);
      return { ok: true };
    }
    if (m === "DELETE") {
      if (userId === s.id) fail(400, "BAD_INPUT", "Không thể xoá chính mình");
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM devices WHERE license_key IN (SELECT key FROM licenses WHERE user_id = ?)").bind(userId),
        db.prepare("UPDATE licenses SET status = 'revoked' WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
      ]);
      return { ok: true };
    }
  }

  if (area === "keys") {
    if (!id && m === "GET") {
      const { results } = await db
        .prepare(
          `SELECT l.*, u.username,
                  (SELECT COUNT(*) FROM devices d WHERE d.license_key = l.key) AS devices
             FROM licenses l LEFT JOIN users u ON u.id = l.user_id
            ORDER BY l.created_at DESC LIMIT 2000`,
        )
        .all();
      return { keys: results, now };
    }
    if (!id && m === "POST") {
      let userId: number | null = null;
      const username = str(body, "username", { max: 64 });
      if (username) {
        const u = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first<{ id: number }>();
        if (!u) fail(404, "NOT_FOUND", "Không có tài khoản " + username);
        userId = u!.id;
      }
      const keys = await createKeys(
        db,
        int(body, "count", 1, 100, 1),
        int(body, "days", 0, 36500, 30),
        int(body, "maxDevices", 1, 100, 1),
        str(body, "note", { max: 500 }),
        now,
        userId,
      );
      return { keys };
    }
    const key = normalizeKey(decodeURIComponent(id ?? ""));
    const l = await db.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first<License>();
    if (!l) fail(404, "NOT_FOUND", "Không tìm thấy key");
    if (sub === "devices" && m === "GET") {
      const { results } = await db
        .prepare("SELECT id, device_name, first_seen, last_seen FROM devices WHERE license_key = ? ORDER BY last_seen DESC")
        .bind(key)
        .all();
      return { devices: results };
    }
    if (m === "PATCH") {
      const stmts: D1PreparedStatement[] = [];
      if (body.status !== undefined) {
        if (body.status !== "active" && body.status !== "revoked") fail(400, "BAD_INPUT", "status sai");
        stmts.push(db.prepare("UPDATE licenses SET status = ? WHERE key = ?").bind(body.status, key));
      }
      if (body.maxDevices !== undefined)
        stmts.push(db.prepare("UPDATE licenses SET max_devices = ? WHERE key = ?").bind(int(body, "maxDevices", 1, 100, 1), key));
      if (body.note !== undefined)
        stmts.push(db.prepare("UPDATE licenses SET note = ? WHERE key = ?").bind(str(body, "note", { max: 500 }), key));
      if (body.addDays !== undefined) {
        const add = int(body, "addDays", -36500, 36500, 0);
        if (l!.user_id === null) {
          stmts.push(
            db.prepare("UPDATE licenses SET duration_days = MAX(1, duration_days + ?) WHERE key = ?").bind(add, key),
          );
        } else if (l!.expires_at !== null) {
          const base = Math.max(l!.expires_at, now);
          stmts.push(db.prepare("UPDATE licenses SET expires_at = ? WHERE key = ?").bind(base + add * DAY, key));
        }
      }
      if (body.forever === true) stmts.push(db.prepare("UPDATE licenses SET expires_at = NULL, duration_days = 0 WHERE key = ?").bind(key));
      if (body.unassign === true) {
        stmts.push(db.prepare("DELETE FROM devices WHERE license_key = ?").bind(key));
        stmts.push(db.prepare("UPDATE licenses SET user_id = NULL, activated_at = NULL, expires_at = NULL WHERE key = ?").bind(key));
      }
      if (stmts.length) await db.batch(stmts);
      return { ok: true };
    }
    if (m === "DELETE") {
      await db.batch([
        db.prepare("DELETE FROM devices WHERE license_key = ?").bind(key),
        db.prepare("DELETE FROM licenses WHERE key = ?").bind(key),
      ]);
      return { ok: true };
    }
  }

  if (area === "devices" && id && m === "DELETE") {
    const dev = await db
      .prepare("SELECT d.device_id, l.user_id FROM devices d JOIN licenses l ON l.key = d.license_key WHERE d.id = ?")
      .bind(Number(id))
      .first<{ device_id: string; user_id: number | null }>();
    if (!dev) fail(404, "NOT_FOUND", "Không tìm thấy máy");
    await db.batch([
      db.prepare("DELETE FROM devices WHERE id = ?").bind(Number(id)),
      db.prepare("DELETE FROM sessions WHERE user_id = ? AND device_id = ?").bind(dev!.user_id, dev!.device_id),
    ]);
    return { ok: true };
  }

  return fail(404, "NOT_FOUND", "Không có đường dẫn này");
}

// ---------- router ----------

export const onRequest: PagesFunction<Env, "path"> = async ({ request, env, params }) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const parts = ([] as string[]).concat(params.path ?? []).filter(Boolean);
  const now = Date.now();
  try {
    const body = await readBody(request);
    const [group, action, ...rest] = parts;
    const m = request.method;
    if (group === "auth") {
      if (action === "login" && m === "POST") return json(await login(env, body, now));
      if (action === "me" && m === "GET") return json(await me(request, env, now));
      if (action === "logout" && m === "POST") {
        const header = request.headers.get("authorization") ?? "";
        if (header.startsWith("Bearer ")) {
          await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256(header.slice(7).trim())).run();
        }
        return json({ ok: true });
      }
      if (action === "password" && m === "POST") return json(await changePassword(request, env, body, now));
    }
    if (group === "admin" && action) return json(await admin(request, env, [action, ...rest], body, now));
    if (group === "health") return json({ ok: true, time: now, db: !!env.DB });
    return json({ error: { code: "NOT_FOUND", message: "Không có đường dẫn này" } }, 404);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, e.status);
    console.error(e);
    return json({ error: { code: "SERVER", message: "Lỗi máy chủ, thử lại sau" } }, 500);
  }
};
