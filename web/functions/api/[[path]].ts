// LMS Studio backend: accounts, 4-tier RBAC, license keys, devices, live sessions,
// usage time tracking and audit logs (Cloudflare D1 "lms-auth").
//
// Auth:
//   POST /api/auth/login       { username, password, deviceId, deviceName?, platform?, appVersion?, key? }
//   GET  /api/auth/me          (Bearer) re-checks account, key, device & permissions
//   POST /api/auth/heartbeat   (Bearer) { activeSeconds?, currentTool?, appVersion?, deviceName?, platform? }
//   POST /api/auth/logout      (Bearer)
//   POST /api/auth/password    (Bearer) { oldPassword, newPassword }
//
// Admin (Bearer, role in staff | admin | super_admin; RBAC enforced per action):
//   GET    /api/admin/stats
//   GET    /api/admin/users
//   POST   /api/admin/users
//   GET    /api/admin/users/:id
//   PATCH  /api/admin/users/:id
//   DELETE /api/admin/users/:id
//   POST   /api/admin/users/:id/logout-all
//   GET    /api/admin/keys
//   POST   /api/admin/keys
//   GET    /api/admin/keys/:key/devices
//   PATCH  /api/admin/keys/:key
//   DELETE /api/admin/keys/:key
//   GET    /api/admin/devices
//   DELETE /api/admin/devices/:id
//   GET    /api/admin/sessions
//   DELETE /api/admin/sessions/:id
//   GET    /api/admin/logs
//   DELETE /api/admin/logs
//   GET    /api/admin/failures
//   DELETE /api/admin/failures/:username
//   GET    /api/admin/roles
//
// Passwords: PBKDF2-SHA256; session tokens are random and stored only as SHA-256.
// Responses are never cached (Cache-Control: no-store).

interface Env {
  DB: D1Database;
  GW_SECRET?: string;
}

type Row = Record<string, unknown>;
type Role = "user" | "staff" | "admin" | "super_admin";

const DAY = 86_400_000;
const VN_OFFSET = 7 * 3_600_000;
const SESSION_DAYS = 30;
const ONLINE_WINDOW_MS = 3 * 60_000; // 3 minutes = currently online
const PBKDF2_ITERATIONS = 100_000;
const MAX_FAILURES = 10;
const FAILURE_WINDOW = 15 * 60_000;
const LOG_RETENTION_MS = 90 * DAY;
const MAX_HEARTBEAT_DELTA_SEC = 180;

const ROLE_RANK: Record<Role, number> = {
  user: 0,
  staff: 1,
  admin: 2,
  super_admin: 3,
};

const ROLE_META: Record<Role, { label: string; badge: string; description: string }> = {
  super_admin: {
    label: "Quản trị tối cao",
    badge: "Tối cao",
    description: "Toàn quyền tuyệt đối: quản lý mọi tài khoản, phân quyền quản trị, key, thiết bị, phiên, nhật ký và dọn hệ thống.",
  },
  admin: {
    label: "Quản trị viên",
    badge: "Quản trị",
    description: "Quản lý toàn bộ khách hàng, nhân sự hỗ trợ, key bản quyền, thiết bị và phiên; không thể chỉnh sửa Quản trị tối cao hoặc Quản trị viên khác.",
  },
  staff: {
    label: "Hỗ trợ / CTV",
    badge: "Hỗ trợ",
    description: "Xem đầy đủ thông tin tài khoản, thời gian, phiên và nhật ký; tạo tài khoản khách, cấp/gia hạn key, gỡ máy và mở chặn đăng nhập; không được xoá tài khoản/key hoặc đổi phân quyền.",
  },
  user: {
    label: "Người dùng",
    badge: "Người dùng",
    description: "Khách hàng sử dụng ứng dụng desktop LMS Studio theo key bản quyền và giới hạn thiết bị được cấp.",
  },
};

function normalizeRole(r: unknown): Role {
  if (r === "super_admin" || r === "admin" || r === "staff" || r === "user") return r;
  return "user";
}
const isConsoleRole = (r: Role) => ROLE_RANK[r] >= ROLE_RANK.staff;
const isLicenseExempt = (r: Role) => ROLE_RANK[r] >= ROLE_RANK.staff;

export interface Permissions {
  viewAll: boolean;
  createUser: boolean;
  editUser: boolean;
  changeRole: boolean;
  resetPassword: boolean;
  lockUser: boolean;
  deleteUser: boolean;
  manageKeys: boolean;
  revokeKey: boolean;
  deleteKey: boolean;
  manageDevices: boolean;
  manageSessions: boolean;
  unlockFailures: boolean;
  pruneLogs: boolean;
  creatableRoles: Role[];
}

function permissionsFor(role: Role): Permissions {
  if (role === "super_admin") {
    return {
      viewAll: true,
      createUser: true,
      editUser: true,
      changeRole: true,
      resetPassword: true,
      lockUser: true,
      deleteUser: true,
      manageKeys: true,
      revokeKey: true,
      deleteKey: true,
      manageDevices: true,
      manageSessions: true,
      unlockFailures: true,
      pruneLogs: true,
      creatableRoles: ["user", "staff", "admin", "super_admin"],
    };
  }
  if (role === "admin") {
    return {
      viewAll: true,
      createUser: true,
      editUser: true,
      changeRole: true,
      resetPassword: true,
      lockUser: true,
      deleteUser: true,
      manageKeys: true,
      revokeKey: true,
      deleteKey: true,
      manageDevices: true,
      manageSessions: true,
      unlockFailures: true,
      pruneLogs: false,
      creatableRoles: ["user", "staff"],
    };
  }
  if (role === "staff") {
    return {
      viewAll: true,
      createUser: true,
      editUser: true,
      changeRole: false,
      resetPassword: false,
      lockUser: false,
      deleteUser: false,
      manageKeys: true,
      revokeKey: false,
      deleteKey: false,
      manageDevices: true,
      manageSessions: true,
      unlockFailures: true,
      pruneLogs: false,
      creatableRoles: ["user"],
    };
  }
  return {
    viewAll: false,
    createUser: false,
    editUser: false,
    changeRole: false,
    resetPassword: false,
    lockUser: false,
    deleteUser: false,
    manageKeys: false,
    revokeKey: false,
    deleteKey: false,
    manageDevices: false,
    manageSessions: false,
    unlockFailures: false,
    pruneLogs: false,
    creatableRoles: [],
  };
}

function canManageTarget(actor: SessionUser, targetRole: Role, targetId: number): boolean {
  if (actor.role === "super_admin") return true;
  if (actor.id === targetId) return false;
  return ROLE_RANK[actor.role] > ROLE_RANK[targetRole];
}

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

// ---------- crypto & date helpers ----------

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

function vnDayKey(ms: number): string {
  const d = new Date(ms + VN_OFFSET);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function clientMeta(request: Request, env: Env) {
  const secret = env.GW_SECRET;
  const viaGw = !!secret && request.headers.get("x-lms-gw") === secret;
  const ip =
    (viaGw ? request.headers.get("x-lms-client-ip") : null) ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  const country =
    (viaGw ? request.headers.get("x-lms-client-country") : null) ||
    request.headers.get("cf-ipcountry") ||
    "";
  const userAgent = (request.headers.get("user-agent") || "").slice(0, 240);
  return { ip: ip.slice(0, 64), country: country.slice(0, 8), userAgent };
}

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
  if (!Number.isInteger(n) || n < min || n > max) fail(400, "BAD_INPUT", `${name} phải là số nguyên từ ${min} đến ${max}`);
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

// ---------- audit logging ----------

async function logActivity(
  db: D1Database,
  entry: {
    now: number;
    actorId?: number | null;
    actorUsername?: string;
    actorRole?: string;
    targetType?: string;
    targetId?: string;
    action: string;
    summary: string;
    ip?: string;
    meta?: Record<string, unknown>;
  },
) {
  try {
    await db
      .prepare(
        `INSERT INTO activity_logs (created_at, actor_id, actor_username, actor_role, target_type, target_id, action, summary, ip, meta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        entry.now,
        entry.actorId ?? null,
        entry.actorUsername ?? "",
        entry.actorRole ?? "",
        entry.targetType ?? "",
        entry.targetId ?? "",
        entry.action,
        entry.summary.slice(0, 400),
        (entry.ip ?? "").slice(0, 64),
        entry.meta ? JSON.stringify(entry.meta).slice(0, 1000) : "",
      )
      .run();
  } catch {
    // Logging must never break an auth/admin transaction
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

const isForeverLicense = (l: License) => l.status === "active" && l.expires_at === null && l.duration_days === 0;
const isPendingLicense = (l: License) =>
  l.status === "active" && l.user_id !== null && l.activated_at === null && l.expires_at === null && l.duration_days > 0;
const isLiveLicense = (l: License, now: number) =>
  l.status === "active" && (isForeverLicense(l) || isPendingLicense(l) || (l.expires_at !== null && l.expires_at > now));

/**
 * Picks the account's best active license:
 * 1) Forever (duration_days = 0, expires_at = null)
 * 2) Active with furthest expires_at > now
 * 3) Pending first-login (activated_at = null, duration_days > 0), longest duration first
 */
async function currentLicense(db: D1Database, userId: number, now: number): Promise<{ live?: License; expired?: License }> {
  const { results } = await db.prepare("SELECT * FROM licenses WHERE user_id = ?").bind(userId).all<License>();
  const active = results.filter((l) => l.status === "active");
  const forever = active.find((l) => isForeverLicense(l));
  if (forever) return { live: forever };
  const expiringLive = active
    .filter((l) => l.expires_at !== null && l.expires_at > now)
    .sort((a, b) => (b.expires_at ?? 0) - (a.expires_at ?? 0));
  if (expiringLive.length) return { live: expiringLive[0] };
  const pending = active.filter((l) => isPendingLicense(l)).sort((a, b) => b.duration_days - a.duration_days);
  if (pending.length) return { live: pending[0] };
  const expired = active
    .filter((l) => l.expires_at !== null && l.expires_at <= now)
    .sort((a, b) => (b.expires_at ?? 0) - (a.expires_at ?? 0));
  return { expired: expired[0] };
}

/** Activates a pending first-login license on first actual use. */
async function activatePendingLicense(db: D1Database, l: License, now: number, actor: { id: number; username: string; role: string }, ip: string): Promise<License> {
  if (!isPendingLicense(l)) return l;
  const expires = l.duration_days > 0 ? now + l.duration_days * DAY : null;
  const res = await db
    .prepare("UPDATE licenses SET activated_at = ?, expires_at = ? WHERE key = ? AND activated_at IS NULL")
    .bind(now, expires, l.key)
    .run();
  if ((res.meta?.changes ?? 0) > 0) {
    l.activated_at = now;
    l.expires_at = expires;
    await logActivity(db, {
      now,
      actorId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      targetType: "license",
      targetId: l.key,
      action: "key_activate",
      summary: `Kích hoạt key ${l.key} (${l.duration_days ? l.duration_days + " ngày" : "vĩnh viễn"}) cho ${actor.username}`,
      ip,
    });
  } else {
    const fresh = await db.prepare("SELECT * FROM licenses WHERE key = ?").bind(l.key).first<License>();
    if (fresh) return fresh;
  }
  return l;
}

async function deviceCount(db: D1Database, key: string): Promise<number> {
  const r = await db.prepare("SELECT COUNT(*) AS n FROM devices WHERE license_key = ?").bind(key).first<{ n: number }>();
  return r?.n ?? 0;
}

async function licenseView(db: D1Database, l: License) {
  return {
    key: l.key,
    durationDays: l.duration_days,
    expiresAt: l.expires_at,
    maxDevices: l.max_devices,
    devices: await deviceCount(db, l.key),
    activatedAt: l.activated_at,
    status: l.status,
  };
}

/** If a regular user no longer holds any live license, kick all their sessions immediately. */
async function revokeSessionsIfNoLiveLicense(db: D1Database, userId: number | null, now: number) {
  if (userId === null) return;
  const u = await db.prepare("SELECT role FROM users WHERE id = ?").bind(userId).first<{ role: string }>();
  if (!u || isLicenseExempt(normalizeRole(u.role))) return;
  const { live } = await currentLicense(db, userId, now);
  if (!live) {
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
  }
}

// ---------- sessions ----------

interface SessionUser {
  id: number;
  username: string;
  role: Role;
  display_name: string;
  disabled: number;
  device_id: string;
  device_name: string;
  platform: string;
  token_hash: string;
  session_rowid: number;
}

async function authenticate(request: Request, env: Env, now: number): Promise<SessionUser> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) fail(401, "NO_SESSION", "Chưa đăng nhập");
  const tokenHash = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.role, u.display_name, u.disabled,
            s.rowid AS session_rowid, s.device_id, s.device_name, s.platform, s.token_hash
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
  )
    .bind(tokenHash, now)
    .first<Record<string, unknown>>();
  if (!row) fail(401, "NO_SESSION", "Phiên đăng nhập đã hết hoặc đã bị đăng xuất, hãy đăng nhập lại");
  if (row!.disabled) fail(403, "DISABLED", "Tài khoản đã bị khoá. Liên hệ quản trị viên.");
  return {
    id: Number(row!.id),
    username: String(row!.username),
    role: normalizeRole(row!.role),
    display_name: String(row!.display_name ?? ""),
    disabled: Number(row!.disabled ?? 0),
    device_id: String(row!.device_id ?? ""),
    device_name: String(row!.device_name ?? ""),
    platform: String(row!.platform ?? ""),
    token_hash: String(row!.token_hash),
    session_rowid: Number(row!.session_rowid),
  };
}

const userView = (u: { id?: number; username: string; role: Role; display_name: string }) => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name || u.username,
  role: u.role,
  roleLabel: ROLE_META[u.role].label,
  permissions: isConsoleRole(u.role) ? permissionsFor(u.role) : undefined,
});

// ---------- auth routes ----------

async function login(request: Request, env: Env, body: Row, now: number) {
  const db = env.DB;
  const meta = clientMeta(request, env);
  const username = str(body, "username", { required: true, max: 64 });
  const password = str(body, "password", { required: true, max: 200 });
  const deviceId = str(body, "deviceId", { max: 100 });
  const deviceName = str(body, "deviceName", { max: 120 }) || "Không rõ";
  const platform = str(body, "platform", { max: 32 }) || (deviceName === "Trang quản trị" ? "admin-web" : "desktop");
  const appVersion = str(body, "appVersion", { max: 40 });
  const keyInput = normalizeKey(body.key);

  const failures = await db
    .prepare("SELECT count, first_at FROM login_failures WHERE username = ?")
    .bind(username)
    .first<{ count: number; first_at: number }>();
  if (failures && failures.count >= MAX_FAILURES && now - failures.first_at < FAILURE_WINDOW) {
    await logActivity(db, {
      now,
      actorUsername: username,
      targetType: "auth",
      targetId: username,
      action: "login_blocked",
      summary: `Bị chặn đăng nhập tạm thời (quá ${MAX_FAILURES} lần sai): ${username}`,
      ip: meta.ip,
    });
    fail(429, "TOO_MANY", "Sai mật khẩu quá nhiều lần. Thử lại sau 15 phút hoặc liên hệ quản trị viên mở chặn.");
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
    await logActivity(db, {
      now,
      actorId: user ? Number(user.id) : null,
      actorUsername: username,
      actorRole: user ? normalizeRole(user.role) : "",
      targetType: "auth",
      targetId: username,
      action: "login_fail",
      summary: `Đăng nhập thất bại (sai tên/mật khẩu): ${username}`,
      ip: meta.ip,
      meta: { deviceName, platform },
    });
    fail(401, "BAD_LOGIN", "Sai tên đăng nhập hoặc mật khẩu");
  }
  const u = user!;
  const role = normalizeRole(u.role);
  const userId = Number(u.id);
  const canonicalUsername = String(u.username);
  if (u.disabled) {
    await logActivity(db, {
      now,
      actorId: userId,
      actorUsername: canonicalUsername,
      actorRole: role,
      targetType: "auth",
      targetId: canonicalUsername,
      action: "login_fail",
      summary: `Tài khoản bị khoá thử đăng nhập: ${canonicalUsername}`,
      ip: meta.ip,
    });
    fail(403, "DISABLED", "Tài khoản đã bị khoá. Liên hệ quản trị viên.");
  }
  await db.prepare("DELETE FROM login_failures WHERE username = ?").bind(username).run();

  let license: License | undefined;
  if (!isLicenseExempt(role)) {
    if (keyInput) {
      const l = await db.prepare("SELECT * FROM licenses WHERE key = ?").bind(keyInput).first<License>();
      if (!l || l.status !== "active") fail(403, "KEY_INVALID", "Key không đúng hoặc đã bị thu hồi");
      if (l!.user_id !== null && l!.user_id !== userId) fail(403, "KEY_USED", "Key này đã được dùng cho tài khoản khác");
      if (l!.expires_at !== null && l!.expires_at <= now) fail(403, "KEY_EXPIRED", "Key đã hết hạn");
      if (l!.user_id === null) {
        const expires = l!.expires_at ?? (l!.duration_days > 0 ? now + l!.duration_days * DAY : null);
        const upd = await db
          .prepare("UPDATE licenses SET user_id = ?, activated_at = ?, expires_at = ? WHERE key = ? AND user_id IS NULL")
          .bind(userId, now, expires, l!.key)
          .run();
        if ((upd.meta?.changes ?? 0) === 0) fail(403, "KEY_USED", "Key này vừa được kích hoạt bởi tài khoản khác");
        l!.user_id = userId;
        l!.activated_at = now;
        l!.expires_at = expires;
        await logActivity(db, {
          now,
          actorId: userId,
          actorUsername: canonicalUsername,
          actorRole: role,
          targetType: "license",
          targetId: l!.key,
          action: "key_activate",
          summary: `${canonicalUsername} kích hoạt key ${l!.key} (${l!.duration_days ? l!.duration_days + " ngày" : "vĩnh viễn"})`,
          ip: meta.ip,
        });
      } else if (isPendingLicense(l!)) {
        license = await activatePendingLicense(db, l!, now, { id: userId, username: canonicalUsername, role }, meta.ip);
      }
      license = license ?? l!;
    } else {
      const { live, expired } = await currentLicense(db, userId, now);
      if (!live) {
        if (expired) fail(403, "KEY_EXPIRED", "Key của tài khoản đã hết hạn. Nhập key mới để gia hạn.");
        fail(403, "NEED_KEY", "Tài khoản chưa có key. Nhập key bản quyền để kích hoạt.");
      }
      license = await activatePendingLicense(db, live!, now, { id: userId, username: canonicalUsername, role }, meta.ip);
    }

    if (deviceId.length < 8) fail(400, "BAD_INPUT", "Thiếu mã máy");
    const known = await db
      .prepare("SELECT id FROM devices WHERE license_key = ? AND device_id = ?")
      .bind(license!.key, deviceId)
      .first<{ id: number }>();
    if (known) {
      await db
        .prepare("UPDATE devices SET last_seen = ?, device_name = ?, user_id = ?, platform = ?, app_version = ?, last_ip = ? WHERE id = ?")
        .bind(now, deviceName, userId, platform, appVersion, meta.ip, known.id)
        .run();
    } else {
      if ((await deviceCount(db, license!.key)) >= license!.max_devices) {
        await logActivity(db, {
          now,
          actorId: userId,
          actorUsername: canonicalUsername,
          actorRole: role,
          targetType: "license",
          targetId: license!.key,
          action: "login_fail",
          summary: `${canonicalUsername} vượt giới hạn ${license!.max_devices} máy trên key ${license!.key} (${deviceName})`,
          ip: meta.ip,
        });
        fail(
          403,
          "DEVICE_LIMIT",
          `Key này đã dùng đủ ${license!.max_devices} máy. Liên hệ quản trị viên để gỡ máy cũ.`,
        );
      }
      await db
        .prepare(
          `INSERT INTO devices (license_key, user_id, device_id, device_name, platform, app_version, last_ip, first_seen, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(license!.key, userId, deviceId, deviceName, platform, appVersion, meta.ip, now, now)
        .run();
    }
  }

  const token = randomToken();
  const dayKey = vnDayKey(now);
  await db.batch([
    db
      .prepare(
        `INSERT INTO sessions (token_hash, user_id, device_id, device_name, platform, app_version, ip, country, user_agent, created_at, expires_at, last_seen_at, active_seconds, current_tool)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')`,
      )
      .bind(await sha256(token), userId, deviceId, deviceName, platform, appVersion, meta.ip, meta.country, meta.userAgent, now, now + SESSION_DAYS * DAY, now),
    db
      .prepare(
        `UPDATE users
            SET last_login_at = ?, last_active_at = ?, last_ip = ?, last_device = ?, login_count = COALESCE(login_count, 0) + 1
          WHERE id = ?`,
      )
      .bind(now, now, meta.ip, deviceName, userId),
    db
      .prepare(
        `INSERT INTO daily_usage (user_id, day, active_seconds, sessions_count, last_seen_at)
         VALUES (?, ?, 0, 1, ?)
         ON CONFLICT(user_id, day) DO UPDATE SET sessions_count = sessions_count + 1, last_seen_at = excluded.last_seen_at`,
      )
      .bind(userId, dayKey, now),
    db.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(now),
    db.prepare("DELETE FROM activity_logs WHERE created_at < ?").bind(now - LOG_RETENTION_MS),
  ]);

  await logActivity(db, {
    now,
    actorId: userId,
    actorUsername: canonicalUsername,
    actorRole: role,
    targetType: "auth",
    targetId: canonicalUsername,
    action: "login_ok",
    summary: `${canonicalUsername} đăng nhập từ ${deviceName}${appVersion ? " (v" + appVersion + ")" : ""}`,
    ip: meta.ip,
    meta: { platform, country: meta.country, key: license?.key ?? null },
  });

  return {
    token,
    user: userView({ id: userId, username: canonicalUsername, role, display_name: String(u.display_name ?? "") }),
    license: license ? await licenseView(db, license) : null,
    serverTime: now,
  };
}

async function validateActiveSession(request: Request, env: Env, now: number) {
  const db = env.DB;
  const s = await authenticate(request, env, now);
  const meta = clientMeta(request, env);
  let license: License | undefined;
  let deviceRowId: number | null = null;
  if (!isLicenseExempt(s.role)) {
    const { live, expired } = await currentLicense(db, s.id, now);
    if (!live) {
      await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(s.token_hash).run();
      if (expired) fail(403, "KEY_EXPIRED", "Key của tài khoản đã hết hạn. Nhập key mới để gia hạn.");
      fail(403, "NEED_KEY", "Tài khoản chưa có key còn hiệu lực.");
    }
    license = await activatePendingLicense(db, live!, now, { id: s.id, username: s.username, role: s.role }, meta.ip);
    const dev = await db
      .prepare("SELECT id FROM devices WHERE license_key = ? AND device_id = ?")
      .bind(license!.key, s.device_id)
      .first<{ id: number }>();
    if (!dev) {
      await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(s.token_hash).run();
      fail(403, "DEVICE_REMOVED", "Máy này đã bị gỡ khỏi key. Đăng nhập lại.");
    }
    deviceRowId = dev!.id;
  }
  return { s, meta, license, deviceRowId };
}

async function me(request: Request, env: Env, now: number) {
  const db = env.DB;
  const { s, meta, license, deviceRowId } = await validateActiveSession(request, env, now);
  const stmts: D1PreparedStatement[] = [
    db
      .prepare("UPDATE sessions SET expires_at = ?, last_seen_at = ?, ip = CASE WHEN ? != '' THEN ? ELSE ip END WHERE token_hash = ?")
      .bind(now + SESSION_DAYS * DAY, now, meta.ip, meta.ip, s.token_hash),
    db
      .prepare("UPDATE users SET last_active_at = ?, last_ip = CASE WHEN ? != '' THEN ? ELSE last_ip END WHERE id = ?")
      .bind(now, meta.ip, meta.ip, s.id),
  ];
  if (deviceRowId !== null) {
    stmts.push(
      db
        .prepare("UPDATE devices SET last_seen = ?, last_ip = CASE WHEN ? != '' THEN ? ELSE last_ip END WHERE id = ?")
        .bind(now, meta.ip, meta.ip, deviceRowId),
    );
  }
  await db.batch(stmts);
  return { user: userView(s), license: license ? await licenseView(db, license) : null, serverTime: now };
}

async function heartbeat(request: Request, env: Env, body: Row, now: number) {
  const db = env.DB;
  const { s, meta, license, deviceRowId } = await validateActiveSession(request, env, now);
  const delta = int(body, "activeSeconds", 0, MAX_HEARTBEAT_DELTA_SEC, 0);
  const currentTool = str(body, "currentTool", { max: 64 });
  const appVersion = str(body, "appVersion", { max: 40 });
  const deviceName = str(body, "deviceName", { max: 120 });
  const platform = str(body, "platform", { max: 32 });
  const dayKey = vnDayKey(now);

  const stmts: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE sessions
            SET expires_at = ?,
                last_seen_at = ?,
                active_seconds = COALESCE(active_seconds, 0) + ?,
                current_tool = CASE WHEN ? != '' THEN ? ELSE current_tool END,
                app_version = CASE WHEN ? != '' THEN ? ELSE app_version END,
                device_name = CASE WHEN ? != '' THEN ? ELSE device_name END,
                platform = CASE WHEN ? != '' THEN ? ELSE platform END,
                ip = CASE WHEN ? != '' THEN ? ELSE ip END,
                country = CASE WHEN ? != '' THEN ? ELSE country END
          WHERE token_hash = ?`,
      )
      .bind(
        now + SESSION_DAYS * DAY,
        now,
        delta,
        currentTool,
        currentTool,
        appVersion,
        appVersion,
        deviceName,
        deviceName,
        platform,
        platform,
        meta.ip,
        meta.ip,
        meta.country,
        meta.country,
        s.token_hash,
      ),
    db
      .prepare(
        `UPDATE users
            SET last_active_at = ?,
                total_active_seconds = COALESCE(total_active_seconds, 0) + ?,
                last_tool = CASE WHEN ? != '' THEN ? ELSE last_tool END,
                last_device = CASE WHEN ? != '' THEN ? ELSE last_device END,
                last_ip = CASE WHEN ? != '' THEN ? ELSE last_ip END
          WHERE id = ?`,
      )
      .bind(now, delta, currentTool, currentTool, deviceName, deviceName, meta.ip, meta.ip, s.id),
    db
      .prepare(
        `INSERT INTO daily_usage (user_id, day, active_seconds, sessions_count, last_seen_at)
         VALUES (?, ?, ?, 0, ?)
         ON CONFLICT(user_id, day) DO UPDATE
           SET active_seconds = active_seconds + excluded.active_seconds,
               last_seen_at = excluded.last_seen_at`,
      )
      .bind(s.id, dayKey, delta, now),
  ];

  if (deviceRowId !== null) {
    stmts.push(
      db
        .prepare(
          `UPDATE devices
              SET last_seen = ?,
                  total_active_seconds = COALESCE(total_active_seconds, 0) + ?,
                  app_version = CASE WHEN ? != '' THEN ? ELSE app_version END,
                  device_name = CASE WHEN ? != '' THEN ? ELSE device_name END,
                  platform = CASE WHEN ? != '' THEN ? ELSE platform END,
                  last_ip = CASE WHEN ? != '' THEN ? ELSE last_ip END
            WHERE id = ?`,
        )
        .bind(now, delta, appVersion, appVersion, deviceName, deviceName, platform, platform, meta.ip, meta.ip, deviceRowId),
    );
  }
  await db.batch(stmts);
  return { ok: true, user: userView(s), license: license ? await licenseView(db, license) : null, serverTime: now };
}

async function changePassword(request: Request, env: Env, body: Row, now: number) {
  const s = await authenticate(request, env, now);
  const meta = clientMeta(request, env);
  const oldPassword = str(body, "oldPassword", { required: true });
  const newPassword = str(body, "newPassword", { required: true, min: 6 });
  const u = await env.DB.prepare("SELECT pass_hash FROM users WHERE id = ?").bind(s.id).first<{ pass_hash: string }>();
  if (!u || !(await verifyPassword(oldPassword, u.pass_hash))) fail(403, "BAD_LOGIN", "Mật khẩu cũ không đúng");
  await env.DB.batch([
    env.DB.prepare("UPDATE users SET pass_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(newPassword), now, s.id),
    env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(s.id, s.token_hash),
  ]);
  await logActivity(env.DB, {
    now,
    actorId: s.id,
    actorUsername: s.username,
    actorRole: s.role,
    targetType: "user",
    targetId: String(s.id),
    action: "password_change",
    summary: `${s.username} tự đổi mật khẩu (đã đăng xuất các thiết bị khác)`,
    ip: meta.ip,
  });
  return { ok: true };
}

// ---------- admin helpers ----------

async function createKeys(
  db: D1Database,
  count: number,
  days: number,
  maxDevices: number,
  note: string,
  now: number,
  userId: number | null,
  activateMode: "immediate" | "first_login",
) {
  const keys: string[] = [];
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0; i < count; i++) {
    const key = newLicenseKey();
    keys.push(key);
    const startNow = userId !== null && (activateMode === "immediate" || days === 0);
    const activated = startNow ? now : null;
    const expires = startNow && days > 0 ? now + days * DAY : null;
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

async function countActiveSuperAdmins(db: D1Database): Promise<number> {
  const r = await db
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'super_admin' AND disabled = 0")
    .first<{ n: number }>();
  return r?.n ?? 0;
}

// ---------- admin routes ----------

async function admin(request: Request, env: Env, parts: string[], body: Row, now: number, existingSession?: SessionUser) {
  const db = env.DB;
  const s = existingSession ?? (await authenticate(request, env, now));
  if (!isConsoleRole(s.role)) fail(403, "FORBIDDEN", "Tài khoản này không có quyền truy cập trang quản trị");
  const perms = permissionsFor(s.role);
  const meta = clientMeta(request, env);
  const m = request.method;
  const [area, id, sub] = parts;
  const onlineCutoff = now - ONLINE_WINDOW_MS;
  const todayKey = vnDayKey(now);
  const weekCutoffKey = vnDayKey(now - 6 * DAY);

  // Refresh admin's own activity once per HTTP request (skipped for internal snapshot fan-out)
  if (!existingSession) {
    await db
      .prepare("UPDATE sessions SET last_seen_at = ?, expires_at = ?, ip = CASE WHEN ? != '' THEN ? ELSE ip END WHERE token_hash = ?")
      .bind(now, now + SESSION_DAYS * DAY, meta.ip, meta.ip, s.token_hash)
      .run();
  }

  // Single-roundtrip dashboard snapshot: 1 auth + 1 session update instead of 9 HTTP calls
  if (area === "snapshot" && m === "GET") {
    const [stats, users, keys, sessions, devices, logs, failures, roles] = await Promise.all([
      admin(request, env, ["stats"], {}, now, s),
      admin(request, env, ["users"], {}, now, s),
      admin(request, env, ["keys"], {}, now, s),
      admin(request, env, ["sessions"], {}, now, s),
      admin(request, env, ["devices"], {}, now, s),
      admin(request, env, ["logs"], {}, now, s),
      admin(request, env, ["failures"], {}, now, s),
      admin(request, env, ["roles"], {}, now, s),
    ]);
    return {
      me: userView(s),
      stats,
      users: (users as { users: unknown[] }).users,
      keys: (keys as { keys: unknown[] }).keys,
      sessions: (sessions as { sessions: unknown[] }).sessions,
      devices: (devices as { devices: unknown[] }).devices,
      logs: (logs as { logs: unknown[] }).logs,
      failures: (failures as { failures: unknown[] }).failures,
      roles,
      serverTime: now,
    };
  }

  if (area === "stats" && m === "GET") {
    const one = async (sql: string, ...args: unknown[]) =>
      (await db.prepare(sql).bind(...args).first<{ n: number }>())?.n ?? 0;
    const soonCutoff = now + 7 * DAY;
    return {
      totalUsers: await one("SELECT COUNT(*) AS n FROM users"),
      users: await one("SELECT COUNT(*) AS n FROM users WHERE role = 'user'"),
      admins: await one("SELECT COUNT(*) AS n FROM users WHERE role IN ('super_admin','admin','staff')"),
      lockedUsers: await one("SELECT COUNT(*) AS n FROM users WHERE disabled = 1"),
      onlineUsers: await one("SELECT COUNT(DISTINCT user_id) AS n FROM sessions WHERE expires_at > ? AND last_seen_at >= ?", now, onlineCutoff),
      activeTodayUsers: await one("SELECT COUNT(*) AS n FROM users WHERE last_active_at >= ? OR last_login_at >= ?", now - DAY, now - DAY),
      keys: await one("SELECT COUNT(*) AS n FROM licenses"),
      liveKeys: await one(
        "SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NOT NULL AND (expires_at IS NULL OR expires_at > ?)",
        now,
      ),
      unusedKeys: await one("SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NULL"),
      expiredKeys: await one(
        "SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NOT NULL AND expires_at IS NOT NULL AND expires_at <= ?",
        now,
      ),
      revokedKeys: await one("SELECT COUNT(*) AS n FROM licenses WHERE status != 'active'"),
      expiringSoonKeys: await one(
        "SELECT COUNT(*) AS n FROM licenses WHERE status = 'active' AND user_id IS NOT NULL AND expires_at IS NOT NULL AND expires_at > ? AND expires_at <= ?",
        now,
        soonCutoff,
      ),
      devices: await one("SELECT COUNT(*) AS n FROM devices"),
      activeToday: await one("SELECT COUNT(*) AS n FROM devices WHERE last_seen >= ?", now - DAY),
      activeSessions: await one("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?", now),
      onlineSessions: await one("SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ? AND last_seen_at >= ?", now, onlineCutoff),
      todayActiveSeconds: await one("SELECT COALESCE(SUM(active_seconds), 0) AS n FROM daily_usage WHERE day = ?", todayKey),
      totalActiveSeconds: await one("SELECT COALESCE(SUM(total_active_seconds), 0) AS n FROM users"),
      blockedLogins: await one("SELECT COUNT(*) AS n FROM login_failures WHERE count >= ? AND first_at > ?", MAX_FAILURES, now - FAILURE_WINDOW),
      serverTime: now,
    };
  }

  if (area === "roles" && m === "GET") {
    const { results: staffList } = await db
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.role, u.disabled, u.created_at, u.last_login_at, u.last_active_at, u.last_ip, u.login_count,
                (SELECT COUNT(*) FROM sessions se WHERE se.user_id = u.id AND se.expires_at > ? AND se.last_seen_at >= ?) AS online_sessions
           FROM users u
          WHERE u.role IN ('super_admin', 'admin', 'staff')
          ORDER BY CASE u.role WHEN 'super_admin' THEN 3 WHEN 'admin' THEN 2 WHEN 'staff' THEN 1 ELSE 0 END DESC, u.created_at ASC`,
      )
      .bind(now, onlineCutoff)
      .all();
    return {
      roles: (["super_admin", "admin", "staff", "user"] as Role[]).map((r) => ({
        role: r,
        ...ROLE_META[r],
        permissions: permissionsFor(r),
      })),
      members: staffList,
      myRole: s.role,
      myPermissions: perms,
      serverTime: now,
    };
  }

  if (area === "users") {
    if (!id && m === "GET") {
      const [{ results: users }, { results: allKeys }, { results: sessAgg }, { results: devAgg }, { results: usageAgg }, { results: failAgg }] =
        await Promise.all([
          db
            .prepare(
              `SELECT id, username, display_name, role, note, disabled, created_at, updated_at,
                      last_login_at, last_active_at, last_ip, last_device, last_tool,
                      COALESCE(login_count, 0) AS login_count,
                      COALESCE(total_active_seconds, 0) AS total_active_seconds
                 FROM users
                ORDER BY created_at DESC`,
            )
            .all<Row>(),
          db.prepare("SELECT * FROM licenses WHERE user_id IS NOT NULL").all<License>(),
          db
            .prepare(
              `SELECT user_id,
                      COUNT(*) AS active_sessions,
                      SUM(CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END) AS online_sessions,
                      MAX(last_seen_at) AS session_last_seen
                 FROM sessions
                WHERE expires_at > ?
                GROUP BY user_id`,
            )
            .bind(onlineCutoff, now)
            .all<Row>(),
          db
            .prepare(
              `SELECT COALESCE(d.user_id, l.user_id) AS uid, COUNT(*) AS devices, MAX(d.last_seen) AS device_last_seen
                 FROM devices d LEFT JOIN licenses l ON l.key = d.license_key
                GROUP BY uid`,
            )
            .all<Row>(),
          db
            .prepare(
              `SELECT user_id,
                      SUM(CASE WHEN day = ? THEN active_seconds ELSE 0 END) AS today_seconds,
                      SUM(CASE WHEN day >= ? THEN active_seconds ELSE 0 END) AS week_seconds
                 FROM daily_usage
                WHERE day >= ?
                GROUP BY user_id`,
            )
            .bind(todayKey, weekCutoffKey, weekCutoffKey)
            .all<Row>(),
          db
            .prepare("SELECT LOWER(username) AS uname, count, first_at FROM login_failures WHERE first_at > ?")
            .bind(now - FAILURE_WINDOW)
            .all<Row>(),
        ]);

      const keysByUser = new Map<number, License[]>();
      for (const l of allKeys) {
        if (l.user_id === null) continue;
        const arr = keysByUser.get(l.user_id) ?? [];
        arr.push(l);
        keysByUser.set(l.user_id, arr);
      }
      const sessMap = new Map<number, Row>(sessAgg.map((r) => [Number(r.user_id), r]));
      const devMap = new Map<number, Row>(devAgg.filter((r) => r.uid != null).map((r) => [Number(r.uid), r]));
      const useMap = new Map<number, Row>(usageAgg.map((r) => [Number(r.user_id), r]));
      const failMap = new Map<string, Row>(failAgg.map((r) => [String(r.uname), r]));

      const enriched = users.map((u) => {
        const uid = Number(u.id);
        const role = normalizeRole(u.role);
        const uKeys = keysByUser.get(uid) ?? [];
        const activeKeys = uKeys.filter((k) => k.status === "active");
        const forever = activeKeys.find((k) => isForeverLicense(k));
        const liveExpiring = activeKeys
          .filter((k) => k.expires_at !== null && k.expires_at > now)
          .sort((a, b) => (b.expires_at ?? 0) - (a.expires_at ?? 0));
        const pending = activeKeys.filter((k) => isPendingLicense(k)).sort((a, b) => b.duration_days - a.duration_days);
        const expired = activeKeys
          .filter((k) => k.expires_at !== null && k.expires_at <= now)
          .sort((a, b) => (b.expires_at ?? 0) - (a.expires_at ?? 0));

        let license_state: "exempt" | "forever" | "live" | "pending" | "expired" | "none" = "none";
        let expires_at: number | null = null;
        let activated_at: number | null = null;
        let active_key: string | null = null;
        let pending_days = 0;

        if (forever) {
          license_state = "forever";
          active_key = forever.key;
          activated_at = forever.activated_at;
        } else if (liveExpiring.length) {
          license_state = "live";
          active_key = liveExpiring[0].key;
          expires_at = liveExpiring[0].expires_at;
          activated_at = liveExpiring[0].activated_at;
        } else if (pending.length) {
          license_state = "pending";
          active_key = pending[0].key;
          pending_days = pending[0].duration_days;
        } else if (expired.length) {
          license_state = "expired";
          active_key = expired[0].key;
          expires_at = expired[0].expires_at;
          activated_at = expired[0].activated_at;
        } else if (isLicenseExempt(role)) {
          license_state = "exempt";
        }

        const se = sessMap.get(uid);
        const dv = devMap.get(uid);
        const us = useMap.get(uid);
        const fl = failMap.get(String(u.username).toLowerCase());
        const onlineSessions = Number(se?.online_sessions ?? 0);
        const lastActive = Math.max(
          Number(u.last_active_at ?? 0),
          Number(u.last_login_at ?? 0),
          Number(se?.session_last_seen ?? 0),
          Number(dv?.device_last_seen ?? 0),
        );

        return {
          ...u,
          role,
          role_label: ROLE_META[role].label,
          key_count: uKeys.length,
          live_key_count: activeKeys.filter((k) => isLiveLicense(k, now)).length,
          active_key,
          license_state,
          expires_at,
          activated_at,
          pending_days,
          devices: Number(dv?.devices ?? 0),
          active_sessions: Number(se?.active_sessions ?? 0),
          online_sessions: onlineSessions,
          is_online: onlineSessions > 0 ? 1 : 0,
          last_active_at: lastActive || null,
          today_active_seconds: Number(us?.today_seconds ?? 0),
          week_active_seconds: Number(us?.week_seconds ?? 0),
          failed_logins: fl ? Number(fl.count) : 0,
          login_blocked: fl && Number(fl.count) >= MAX_FAILURES ? 1 : 0,
        };
      });

      return { users: enriched, now };
    }

    if (!id && m === "POST") {
      if (!perms.createUser) fail(403, "FORBIDDEN", "Bạn không có quyền tạo tài khoản");
      const username = str(body, "username", { required: true });
      if (!USERNAME_RE.test(username)) fail(400, "BAD_INPUT", "Tên đăng nhập 3-64 ký tự: chữ, số, . _ @ -");
      const password = str(body, "password", { required: true, min: 6 });
      const role = normalizeRole(body.role ?? "user");
      if (!perms.creatableRoles.includes(role)) {
        fail(403, "FORBIDDEN", `Vai trò "${ROLE_META[s.role].label}" không thể tạo tài khoản vai trò "${ROLE_META[role].label}"`);
      }
      const exists = await db.prepare("SELECT id FROM users WHERE username = ?").bind(username).first();
      if (exists) fail(409, "EXISTS", "Tên đăng nhập đã có");
      const displayName = str(body, "displayName", { max: 100 });
      const note = str(body, "note", { max: 500 });
      const r = await db
        .prepare("INSERT INTO users (username, pass_hash, role, display_name, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(username, await hashPassword(password), role, displayName, note, now, now)
        .run();
      const userId = Number(r.meta.last_row_id);
      let keys: string[] = [];
      const activateMode = body.activateMode === "first_login" ? "first_login" : "immediate";
      const days = int(body, "days", 0, 36500, 30);
      const maxDevices = int(body, "maxDevices", 1, 100, 1);
      if (role === "user" && body.withKey) {
        keys = await createKeys(db, 1, days, maxDevices, str(body, "keyNote", { max: 500 }), now, userId, activateMode);
      }
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "user",
        targetId: String(userId),
        action: "user_create",
        summary: `Tạo tài khoản ${username} (${ROLE_META[role].label})${keys.length ? ` + key ${keys[0]} (${days ? days + " ngày" : "vĩnh viễn"})` : ""}`,
        ip: meta.ip,
        meta: { role, withKey: !!keys.length, days, maxDevices, activateMode },
      });
      return { id: userId, username, role, keys, activateMode };
    }

    const userId = Number(id);
    if (!Number.isInteger(userId) || userId <= 0) fail(404, "NOT_FOUND", "Không tìm thấy tài khoản");
    const target = await db
      .prepare(
        `SELECT id, username, display_name, role, note, disabled, created_at, updated_at,
                last_login_at, last_active_at, last_ip, last_device, last_tool,
                COALESCE(login_count, 0) AS login_count,
                COALESCE(total_active_seconds, 0) AS total_active_seconds
           FROM users WHERE id = ?`,
      )
      .bind(userId)
      .first<Row>();
    if (!target) fail(404, "NOT_FOUND", "Không tìm thấy tài khoản");
    const targetRole = normalizeRole(target!.role);
    const targetUsername = String(target!.username);

    // 360-degree user profile detail
    if (m === "GET" && !sub) {
      const [{ results: keys }, { results: devices }, { results: sessions }, { results: daily }, { results: logs }, failRow] =
        await Promise.all([
          db
            .prepare(
              `SELECT l.*, (SELECT COUNT(*) FROM devices d WHERE d.license_key = l.key) AS devices
                 FROM licenses l WHERE l.user_id = ? ORDER BY l.created_at DESC`,
            )
            .bind(userId)
            .all(),
          db
            .prepare(
              `SELECT d.id, d.license_key, d.device_id, d.device_name, d.platform, d.app_version, d.last_ip,
                      d.first_seen, d.last_seen, COALESCE(d.total_active_seconds, 0) AS total_active_seconds
                 FROM devices d LEFT JOIN licenses l ON l.key = d.license_key
                WHERE d.user_id = ? OR l.user_id = ?
                ORDER BY d.last_seen DESC`,
            )
            .bind(userId, userId)
            .all(),
          db
            .prepare(
              `SELECT rowid AS id, device_id, device_name, platform, app_version, ip, country, user_agent,
                      created_at, expires_at, last_seen_at, COALESCE(active_seconds, 0) AS active_seconds, current_tool,
                      CASE WHEN last_seen_at >= ? THEN 1 ELSE 0 END AS is_online,
                      CASE WHEN token_hash = ? THEN 1 ELSE 0 END AS is_current
                 FROM sessions
                WHERE user_id = ? AND expires_at > ?
                ORDER BY last_seen_at DESC`,
            )
            .bind(onlineCutoff, s.token_hash, userId, now)
            .all(),
          db
            .prepare("SELECT day, active_seconds, sessions_count, last_seen_at FROM daily_usage WHERE user_id = ? ORDER BY day DESC LIMIT 14")
            .bind(userId)
            .all(),
          db
            .prepare(
              `SELECT id, created_at, actor_username, actor_role, target_type, target_id, action, summary, ip
                 FROM activity_logs
                WHERE actor_id = ? OR (target_type = 'user' AND target_id = ?) OR (target_type = 'auth' AND LOWER(target_id) = LOWER(?))
                ORDER BY created_at DESC LIMIT 50`,
            )
            .bind(userId, String(userId), targetUsername)
            .all(),
          db
            .prepare("SELECT count, first_at FROM login_failures WHERE username = ? AND first_at > ?")
            .bind(targetUsername, now - FAILURE_WINDOW)
            .first<{ count: number; first_at: number }>(),
        ]);
      return {
        user: { ...target, role: targetRole, role_label: ROLE_META[targetRole].label },
        keys,
        devices,
        sessions,
        daily,
        logs,
        failure: failRow ?? null,
        now,
      };
    }

    if (sub === "logout-all" && m === "POST") {
      if (!perms.manageSessions) fail(403, "FORBIDDEN", "Bạn không có quyền đăng xuất phiên người dùng");
      if (userId !== s.id && !canManageTarget(s, targetRole, userId)) {
        fail(403, "FORBIDDEN", "Bạn không có quyền tác động lên tài khoản có cấp quyền cao hơn hoặc ngang cấp");
      }
      const res =
        userId === s.id
          ? await db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(userId, s.token_hash).run()
          : await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId).run();
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "user",
        targetId: String(userId),
        action: "session_revoke",
        summary: `Đăng xuất toàn bộ phiên của ${targetUsername} (${res.meta?.changes ?? 0} phiên)`,
        ip: meta.ip,
      });
      return { ok: true, revoked: res.meta?.changes ?? 0 };
    }

    if (m === "PATCH" && !sub) {
      const isSelf = userId === s.id;
      const canMutate = isSelf || canManageTarget(s, targetRole, userId);
      if (!canMutate) {
        fail(403, "FORBIDDEN", `Bạn không có quyền sửa tài khoản vai trò "${ROLE_META[targetRole].label}"`);
      }

      const stmts: D1PreparedStatement[] = [];
      const changes: string[] = [];

      if (body.role !== undefined) {
        if (!perms.changeRole) fail(403, "FORBIDDEN", "Bạn không có quyền thay đổi vai trò phân quyền");
        const newRole = normalizeRole(body.role);
        if (body.role !== newRole) fail(400, "BAD_INPUT", "Vai trò không hợp lệ");
        if (newRole !== targetRole) {
          if (isSelf && s.role === "super_admin" && newRole !== "super_admin") {
            if ((await countActiveSuperAdmins(db)) <= 1) {
              fail(400, "BAD_INPUT", "Không thể hạ quyền Quản trị tối cao cuối cùng");
            }
          }
          if (s.role !== "super_admin") {
            if (!perms.creatableRoles.includes(newRole) || ROLE_RANK[targetRole] >= ROLE_RANK[s.role]) {
              fail(403, "FORBIDDEN", "Bạn chỉ có thể đổi phân quyền cho cấp thấp hơn quyền của mình");
            }
          } else if (targetRole === "super_admin" && newRole !== "super_admin" && (await countActiveSuperAdmins(db)) <= 1) {
            fail(400, "BAD_INPUT", "Phải giữ lại ít nhất 1 Quản trị tối cao hoạt động");
          }
          stmts.push(db.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind(newRole, now, userId));
          changes.push(`vai trò: ${ROLE_META[targetRole].label} → ${ROLE_META[newRole].label}`);
        }
      }

      if (body.password !== undefined) {
        if (!isSelf && !perms.resetPassword) fail(403, "FORBIDDEN", "Bạn không có quyền đặt lại mật khẩu");
        const pw = str(body, "password", { required: true, min: 6 });
        stmts.push(db.prepare("UPDATE users SET pass_hash = ?, updated_at = ? WHERE id = ?").bind(await hashPassword(pw), now, userId));
        if (isSelf) {
          stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(userId, s.token_hash));
        } else {
          stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId));
        }
        stmts.push(db.prepare("DELETE FROM login_failures WHERE username = ?").bind(targetUsername));
        changes.push("đặt lại mật khẩu");
      }

      if (body.disabled !== undefined) {
        if (!perms.lockUser) fail(403, "FORBIDDEN", "Bạn không có quyền khoá/mở khoá tài khoản");
        if (isSelf) fail(400, "BAD_INPUT", "Không thể tự khoá chính mình");
        const disableFlag = body.disabled ? 1 : 0;
        if (disableFlag === 1 && targetRole === "super_admin" && (await countActiveSuperAdmins(db)) <= 1) {
          fail(400, "BAD_INPUT", "Không thể khoá Quản trị tối cao cuối cùng");
        }
        stmts.push(db.prepare("UPDATE users SET disabled = ?, updated_at = ? WHERE id = ?").bind(disableFlag, now, userId));
        if (disableFlag) stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId));
        changes.push(disableFlag ? "khoá tài khoản" : "mở khoá tài khoản");
      }

      if (body.displayName !== undefined) {
        if (!isSelf && !perms.editUser) fail(403, "FORBIDDEN", "Bạn không có quyền sửa tài khoản");
        stmts.push(db.prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?").bind(str(body, "displayName", { max: 100 }), now, userId));
        changes.push("cập nhật tên hiển thị");
      }

      if (body.note !== undefined) {
        if (!isSelf && !perms.editUser) fail(403, "FORBIDDEN", "Bạn không có quyền sửa ghi chú");
        stmts.push(db.prepare("UPDATE users SET note = ?, updated_at = ? WHERE id = ?").bind(str(body, "note", { max: 500 }), now, userId));
        changes.push("cập nhật ghi chú");
      }

      if (body.unlockLogin === true) {
        if (!perms.unlockFailures) fail(403, "FORBIDDEN", "Bạn không có quyền mở chặn đăng nhập");
        stmts.push(db.prepare("DELETE FROM login_failures WHERE username = ?").bind(targetUsername));
        changes.push("mở chặn đăng nhập sai");
      }

      if (stmts.length) {
        await db.batch(stmts);
        await logActivity(db, {
          now,
          actorId: s.id,
          actorUsername: s.username,
          actorRole: s.role,
          targetType: "user",
          targetId: String(userId),
          action: body.role !== undefined ? "user_role" : body.disabled !== undefined ? (body.disabled ? "user_lock" : "user_unlock") : body.password !== undefined ? "password_reset" : "user_update",
          summary: `Cập nhật ${targetUsername}: ${changes.join(", ")}`,
          ip: meta.ip,
        });
      }
      return { ok: true };
    }

    if (m === "DELETE" && !sub) {
      if (!perms.deleteUser) fail(403, "FORBIDDEN", "Bạn không có quyền xoá tài khoản");
      if (userId === s.id) fail(400, "BAD_INPUT", "Không thể xoá chính mình");
      if (!canManageTarget(s, targetRole, userId)) {
        fail(403, "FORBIDDEN", `Bạn không có quyền xoá tài khoản vai trò "${ROLE_META[targetRole].label}"`);
      }
      if (targetRole === "super_admin" && (await countActiveSuperAdmins(db)) <= 1) {
        fail(400, "BAD_INPUT", "Không thể xoá Quản trị tối cao cuối cùng");
      }
      await db.batch([
        db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM daily_usage WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM login_failures WHERE username = ?").bind(targetUsername),
        db.prepare("DELETE FROM devices WHERE user_id = ? OR license_key IN (SELECT key FROM licenses WHERE user_id = ?)").bind(userId, userId),
        db.prepare("UPDATE licenses SET status = 'revoked' WHERE user_id = ?").bind(userId),
        db.prepare("DELETE FROM users WHERE id = ?").bind(userId),
      ]);
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "user",
        targetId: String(userId),
        action: "user_delete",
        summary: `Xoá tài khoản ${targetUsername} (${ROLE_META[targetRole].label})`,
        ip: meta.ip,
      });
      return { ok: true };
    }
  }

  if (area === "keys") {
    if (!id && m === "GET") {
      const { results } = await db
        .prepare(
          `SELECT l.*, u.username, u.display_name, u.role AS user_role, u.disabled AS user_disabled,
                  (SELECT COUNT(*) FROM devices d WHERE d.license_key = l.key) AS devices,
                  (SELECT MAX(d.last_seen) FROM devices d WHERE d.license_key = l.key) AS last_seen
             FROM licenses l LEFT JOIN users u ON u.id = l.user_id
            ORDER BY l.created_at DESC LIMIT 2000`,
        )
        .all();
      return { keys: results, now };
    }
    if (!id && m === "POST") {
      if (!perms.manageKeys) fail(403, "FORBIDDEN", "Bạn không có quyền tạo key");
      let userId: number | null = null;
      const username = str(body, "username", { max: 64 });
      if (username) {
        const u = await db.prepare("SELECT id, username FROM users WHERE username = ?").bind(username).first<{ id: number; username: string }>();
        if (!u) fail(404, "NOT_FOUND", "Không có tài khoản " + username);
        userId = u!.id;
      }
      const count = int(body, "count", 1, 100, 1);
      const days = int(body, "days", 0, 36500, 30);
      const maxDevices = int(body, "maxDevices", 1, 100, 1);
      const note = str(body, "note", { max: 500 });
      const activateMode = body.activateMode === "first_login" ? "first_login" : "immediate";
      const keys = await createKeys(db, count, days, maxDevices, note, now, userId, activateMode);
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "license",
        targetId: keys[0] ?? "",
        action: "key_create",
        summary: `Tạo ${keys.length} key (${days ? days + " ngày" : "vĩnh viễn"}, ${maxDevices} máy)${username ? " gắn cho " + username : " (key rời)"}`,
        ip: meta.ip,
        meta: { count: keys.length, days, maxDevices, username: username || null, activateMode },
      });
      return { keys, activateMode };
    }
    const key = normalizeKey(decodeURIComponent(id ?? ""));
    const l = await db.prepare("SELECT * FROM licenses WHERE key = ?").bind(key).first<License>();
    if (!l) fail(404, "NOT_FOUND", "Không tìm thấy key");
    if (sub === "devices" && m === "GET") {
      const { results } = await db
        .prepare(
          `SELECT id, device_id, device_name, platform, app_version, last_ip, first_seen, last_seen,
                  COALESCE(total_active_seconds, 0) AS total_active_seconds
             FROM devices WHERE license_key = ? ORDER BY last_seen DESC`,
        )
        .bind(key)
        .all();
      return { devices: results, now };
    }
    if (m === "PATCH" && !sub) {
      if (!perms.manageKeys) fail(403, "FORBIDDEN", "Bạn không có quyền sửa key");
      const stmts: D1PreparedStatement[] = [];
      const changes: string[] = [];
      let checkRevokeUserId: number | null = null;

      if (body.status !== undefined) {
        if (!perms.revokeKey) fail(403, "FORBIDDEN", "Vai trò Hỗ trợ không được thu hồi/khôi phục key");
        if (body.status !== "active" && body.status !== "revoked") fail(400, "BAD_INPUT", "Trạng thái key không hợp lệ");
        stmts.push(db.prepare("UPDATE licenses SET status = ? WHERE key = ?").bind(body.status, key));
        if (body.status === "revoked") checkRevokeUserId = l!.user_id;
        changes.push(body.status === "revoked" ? "thu hồi key" : "khôi phục key");
      }

      if (body.maxDevices !== undefined) {
        const md = int(body, "maxDevices", 1, 100, 1);
        stmts.push(db.prepare("UPDATE licenses SET max_devices = ? WHERE key = ?").bind(md, key));
        changes.push(`số máy tối đa → ${md}`);
      }

      if (body.note !== undefined) {
        stmts.push(db.prepare("UPDATE licenses SET note = ? WHERE key = ?").bind(str(body, "note", { max: 500 }), key));
        changes.push("sửa ghi chú");
      }

      if (body.assignUsername !== undefined) {
        const assignName = str(body, "assignUsername", { required: true, max: 64 });
        if (l!.user_id !== null) fail(400, "BAD_INPUT", "Key này đã gắn cho một tài khoản, hãy gỡ trước khi gán lại");
        if (l!.status !== "active") fail(400, "BAD_INPUT", "Key đã bị thu hồi, hãy khôi phục trước khi gán");
        const u = await db.prepare("SELECT id, username FROM users WHERE username = ?").bind(assignName).first<{ id: number; username: string }>();
        if (!u) fail(404, "NOT_FOUND", "Không tìm thấy tài khoản " + assignName);
        const startNow = body.activateMode !== "first_login" || l!.duration_days === 0;
        const activated = startNow ? now : null;
        const expires = startNow && l!.duration_days > 0 ? now + l!.duration_days * DAY : null;
        stmts.push(
          db
            .prepare("UPDATE licenses SET user_id = ?, activated_at = ?, expires_at = ? WHERE key = ? AND user_id IS NULL")
            .bind(u!.id, activated, expires, key),
        );
        changes.push(`gán cho ${u!.username}`);
      }

      if (body.forever === true) {
        stmts.push(db.prepare("UPDATE licenses SET expires_at = NULL, duration_days = 0, activated_at = COALESCE(activated_at, CASE WHEN user_id IS NOT NULL THEN ? ELSE NULL END) WHERE key = ?").bind(now, key));
        changes.push("chuyển thành vĩnh viễn");
      } else if (body.expiresAt !== undefined && body.expiresAt !== null && body.expiresAt !== "") {
        const ts = Number(body.expiresAt);
        if (!Number.isFinite(ts) || ts < 1_000_000_000_000) fail(400, "BAD_INPUT", "Mốc hết hạn không hợp lệ");
        const dDays = Math.max(1, Math.ceil((ts - now) / DAY));
        stmts.push(
          db
            .prepare("UPDATE licenses SET expires_at = ?, duration_days = ?, activated_at = COALESCE(activated_at, ?) WHERE key = ?")
            .bind(Math.round(ts), dDays, now, key),
        );
        changes.push(`đặt hạn đến ${new Date(ts).toLocaleDateString("vi-VN")}`);
      } else if (body.setDays !== undefined && body.setDays !== null && body.setDays !== "") {
        const d = int(body, "setDays", 0, 36500, 30);
        if (d === 0) {
          stmts.push(db.prepare("UPDATE licenses SET expires_at = NULL, duration_days = 0 WHERE key = ?").bind(key));
          changes.push("đặt vĩnh viễn");
        } else if (l!.user_id === null || isPendingLicense(l!)) {
          stmts.push(db.prepare("UPDATE licenses SET duration_days = ?, expires_at = NULL WHERE key = ?").bind(d, key));
          changes.push(`đặt thời lượng ${d} ngày`);
        } else {
          stmts.push(
            db
              .prepare("UPDATE licenses SET expires_at = ?, duration_days = ?, activated_at = COALESCE(activated_at, ?) WHERE key = ?")
              .bind(now + d * DAY, d, now, key),
          );
          changes.push(`đặt còn ${d} ngày từ hôm nay`);
        }
      } else if (body.addDays !== undefined) {
        const add = int(body, "addDays", -36500, 36500, 0);
        if (add === 0) fail(400, "BAD_INPUT", "Số ngày thay đổi phải khác 0");
        if (l!.user_id === null || isPendingLicense(l!)) {
          stmts.push(db.prepare("UPDATE licenses SET duration_days = MAX(1, duration_days + ?) WHERE key = ?").bind(add, key));
          changes.push(`${add > 0 ? "+" : ""}${add} ngày thời lượng`);
        } else if (l!.expires_at === null) {
          // Key was forever: positive addDays switches it to a finite expiry from now
          if (add < 0) fail(400, "BAD_INPUT", "Key đang vĩnh viễn; hãy nhập số ngày dương hoặc đặt ngày hết hạn cụ thể");
          stmts.push(
            db
              .prepare("UPDATE licenses SET expires_at = ?, duration_days = ?, activated_at = COALESCE(activated_at, ?) WHERE key = ?")
              .bind(now + add * DAY, add, now, key),
          );
          changes.push(`đổi từ vĩnh viễn sang ${add} ngày`);
        } else {
          const base = add > 0 ? Math.max(l!.expires_at, now) : l!.expires_at;
          stmts.push(db.prepare("UPDATE licenses SET expires_at = ? WHERE key = ?").bind(base + add * DAY, key));
          changes.push(`${add > 0 ? "+" : ""}${add} ngày hạn dùng`);
        }
      }

      if (body.unassign === true) {
        if (!perms.revokeKey) fail(403, "FORBIDDEN", "Vai trò Hỗ trợ không được gỡ key khỏi tài khoản");
        checkRevokeUserId = l!.user_id;
        stmts.push(db.prepare("DELETE FROM devices WHERE license_key = ?").bind(key));
        stmts.push(db.prepare("UPDATE licenses SET user_id = NULL, activated_at = NULL, expires_at = NULL WHERE key = ?").bind(key));
        changes.push("gỡ khỏi tài khoản");
      }

      if (stmts.length) {
        await db.batch(stmts);
        if (checkRevokeUserId !== null) await revokeSessionsIfNoLiveLicense(db, checkRevokeUserId, now);
        await logActivity(db, {
          now,
          actorId: s.id,
          actorUsername: s.username,
          actorRole: s.role,
          targetType: "license",
          targetId: key,
          action:
            body.status === "revoked"
              ? "key_revoke"
              : body.status === "active"
                ? "key_restore"
                : body.unassign
                  ? "key_unassign"
                  : body.assignUsername
                    ? "key_assign"
                    : "key_extend",
          summary: `Cập nhật key ${key}: ${changes.join(", ")}`,
          ip: meta.ip,
        });
      }
      return { ok: true };
    }
    if (m === "DELETE" && !sub) {
      if (!perms.deleteKey) fail(403, "FORBIDDEN", "Bạn không có quyền xoá key");
      await db.batch([
        db.prepare("DELETE FROM devices WHERE license_key = ?").bind(key),
        db.prepare("DELETE FROM licenses WHERE key = ?").bind(key),
      ]);
      await revokeSessionsIfNoLiveLicense(db, l!.user_id, now);
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "license",
        targetId: key,
        action: "key_delete",
        summary: `Xoá vĩnh viễn key ${key}`,
        ip: meta.ip,
      });
      return { ok: true };
    }
  }

  if (area === "devices") {
    if (!id && m === "GET") {
      const { results } = await db
        .prepare(
          `SELECT d.id, d.license_key, d.device_id, d.device_name, d.platform, d.app_version, d.last_ip,
                  d.first_seen, d.last_seen, COALESCE(d.total_active_seconds, 0) AS total_active_seconds,
                  u.id AS user_id, u.username, u.display_name, u.role AS user_role,
                  CASE WHEN d.last_seen >= ? THEN 1 ELSE 0 END AS is_online
             FROM devices d
             LEFT JOIN licenses l ON l.key = d.license_key
             LEFT JOIN users u ON u.id = COALESCE(d.user_id, l.user_id)
            ORDER BY d.last_seen DESC LIMIT 1000`,
        )
        .bind(onlineCutoff)
        .all();
      return { devices: results, now };
    }
    if (id && m === "DELETE") {
      if (!perms.manageDevices) fail(403, "FORBIDDEN", "Bạn không có quyền gỡ thiết bị");
      const devId = Number(id);
      if (!Number.isInteger(devId)) fail(404, "NOT_FOUND", "Không tìm thấy máy");
      const dev = await db
        .prepare(
          `SELECT d.id, d.device_id, d.device_name, d.license_key,
                  COALESCE(d.user_id, l.user_id) AS user_id, u.username, u.role
             FROM devices d
             LEFT JOIN licenses l ON l.key = d.license_key
             LEFT JOIN users u ON u.id = COALESCE(d.user_id, l.user_id)
            WHERE d.id = ?`,
        )
        .bind(devId)
        .first<{ id: number; device_id: string; device_name: string; license_key: string; user_id: number | null; username: string | null; role: string | null }>();
      if (!dev) fail(404, "NOT_FOUND", "Không tìm thấy máy");
      if (dev!.user_id !== null && dev!.role && !canManageTarget(s, normalizeRole(dev!.role), dev!.user_id) && dev!.user_id !== s.id) {
        fail(403, "FORBIDDEN", "Bạn không có quyền gỡ máy của tài khoản cấp cao hơn");
      }
      const stmts: D1PreparedStatement[] = [db.prepare("DELETE FROM devices WHERE id = ?").bind(devId)];
      if (dev!.user_id !== null) {
        stmts.push(db.prepare("DELETE FROM sessions WHERE user_id = ? AND device_id = ?").bind(dev!.user_id, dev!.device_id));
      }
      await db.batch(stmts);
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "device",
        targetId: String(devId),
        action: "device_remove",
        summary: `Gỡ máy "${dev!.device_name}" khỏi key ${dev!.license_key}${dev!.username ? " (" + dev!.username + ")" : ""}`,
        ip: meta.ip,
      });
      return { ok: true };
    }
  }

  if (area === "sessions") {
    if (!id && m === "GET") {
      const { results } = await db
        .prepare(
          `SELECT s.rowid AS id, s.user_id, u.username, u.display_name, u.role AS user_role,
                  s.device_id, s.device_name, s.platform, s.app_version, s.ip, s.country,
                  s.created_at, s.expires_at, s.last_seen_at,
                  COALESCE(s.active_seconds, 0) AS active_seconds, s.current_tool,
                  CASE WHEN s.last_seen_at >= ? THEN 1 ELSE 0 END AS is_online,
                  CASE WHEN s.token_hash = ? THEN 1 ELSE 0 END AS is_current
             FROM sessions s
             JOIN users u ON u.id = s.user_id
            WHERE s.expires_at > ?
            ORDER BY s.last_seen_at DESC LIMIT 500`,
        )
        .bind(onlineCutoff, s.token_hash, now)
        .all();
      return { sessions: results, now };
    }
    if (id && m === "DELETE") {
      if (!perms.manageSessions) fail(403, "FORBIDDEN", "Bạn không có quyền đăng xuất phiên");
      const rowId = Number(id);
      if (!Number.isInteger(rowId)) fail(404, "NOT_FOUND", "Không tìm thấy phiên");
      const sess = await db
        .prepare(
          `SELECT s.rowid AS id, s.user_id, s.device_name, s.token_hash, u.username, u.role
             FROM sessions s JOIN users u ON u.id = s.user_id
            WHERE s.rowid = ?`,
        )
        .bind(rowId)
        .first<{ id: number; user_id: number; device_name: string; token_hash: string; username: string; role: string }>();
      if (!sess) fail(404, "NOT_FOUND", "Không tìm thấy phiên");
      if (sess!.token_hash === s.token_hash) fail(400, "BAD_INPUT", "Không thể tự đá phiên hiện tại, hãy dùng nút Đăng xuất");
      if (sess!.user_id !== s.id && !canManageTarget(s, normalizeRole(sess!.role), sess!.user_id)) {
        fail(403, "FORBIDDEN", "Bạn không có quyền đăng xuất phiên của cấp quyền cao hơn hoặc ngang cấp");
      }
      await db.prepare("DELETE FROM sessions WHERE rowid = ?").bind(rowId).run();
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "session",
        targetId: String(rowId),
        action: "session_revoke",
        summary: `Đăng xuất phiên #${rowId} của ${sess!.username} (${sess!.device_name || "Không rõ"})`,
        ip: meta.ip,
      });
      return { ok: true };
    }
  }

  if (area === "logs") {
    if (!id && m === "GET") {
      const url = new URL(request.url);
      const limit = Math.min(300, Math.max(10, Number(url.searchParams.get("limit")) || 150));
      const { results } = await db
        .prepare(
          `SELECT id, created_at, actor_id, actor_username, actor_role, target_type, target_id, action, summary, ip
             FROM activity_logs
            ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(limit)
        .all();
      return { logs: results, now };
    }
    if (!id && m === "DELETE") {
      if (!perms.pruneLogs) fail(403, "FORBIDDEN", "Chỉ Quản trị tối cao mới được dọn nhật ký");
      const url = new URL(request.url);
      const qKeep = url.searchParams.get("keepDays");
      const keepDays = int({ keepDays: qKeep ?? body.keepDays }, "keepDays", 0, 365, 30);
      const cutoff = keepDays === 0 ? now : now - keepDays * DAY;
      const res = await db.prepare("DELETE FROM activity_logs WHERE created_at < ?").bind(cutoff).run();
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "system",
        targetId: "logs",
        action: "logs_prune",
        summary: `Dọn ${res.meta?.changes ?? 0} dòng nhật ký cũ hơn ${keepDays} ngày`,
        ip: meta.ip,
      });
      return { ok: true, deleted: res.meta?.changes ?? 0 };
    }
  }

  if (area === "failures") {
    if (!id && m === "GET") {
      const { results } = await db
        .prepare(
          `SELECT username, count, first_at,
                  CASE WHEN count >= ? AND first_at > ? THEN 1 ELSE 0 END AS is_blocked
             FROM login_failures
            ORDER BY first_at DESC LIMIT 200`,
        )
        .bind(MAX_FAILURES, now - FAILURE_WINDOW)
        .all();
      return { failures: results, maxFailures: MAX_FAILURES, windowMs: FAILURE_WINDOW, now };
    }
    if (id && m === "DELETE") {
      if (!perms.unlockFailures) fail(403, "FORBIDDEN", "Bạn không có quyền mở chặn đăng nhập");
      const uname = decodeURIComponent(id);
      await db.prepare("DELETE FROM login_failures WHERE username = ?").bind(uname).run();
      await logActivity(db, {
        now,
        actorId: s.id,
        actorUsername: s.username,
        actorRole: s.role,
        targetType: "auth",
        targetId: uname,
        action: "unlock_ratelimit",
        summary: `Mở chặn giới hạn đăng nhập cho "${uname}"`,
        ip: meta.ip,
      });
      return { ok: true };
    }
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
      if (action === "login" && m === "POST") return json(await login(request, env, body, now));
      if (action === "me" && m === "GET") return json(await me(request, env, now));
      if (action === "heartbeat" && m === "POST") return json(await heartbeat(request, env, body, now));
      if (action === "logout" && m === "POST") {
        const header = request.headers.get("authorization") ?? "";
        if (header.startsWith("Bearer ")) {
          const tokHash = await sha256(header.slice(7).trim());
          const s = await env.DB.prepare(
            "SELECT u.id, u.username, u.role, s.device_name FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?",
          )
            .bind(tokHash)
            .first<{ id: number; username: string; role: string; device_name: string }>();
          await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokHash).run();
          if (s) {
            const meta = clientMeta(request, env);
            await logActivity(env.DB, {
              now,
              actorId: s.id,
              actorUsername: s.username,
              actorRole: normalizeRole(s.role),
              targetType: "auth",
              targetId: s.username,
              action: "logout",
              summary: `${s.username} đăng xuất (${s.device_name || "Không rõ"})`,
              ip: meta.ip,
            });
          }
        }
        return json({ ok: true });
      }
      if (action === "password" && m === "POST") return json(await changePassword(request, env, body, now));
    }
    if (group === "admin" && action) return json(await admin(request, env, [action, ...rest], body, now));
    if (group === "health") return json({ ok: true, time: now, db: !!env.DB, version: 2 });
    return json({ error: { code: "NOT_FOUND", message: "Không có đường dẫn này" } }, 404);
  } catch (e) {
    if (e instanceof ApiError) return json({ error: { code: e.code, message: e.message } }, e.status);
    console.error(e);
    return json({ error: { code: "SERVER", message: "Lỗi máy chủ, thử lại sau" } }, 500);
  }
};
