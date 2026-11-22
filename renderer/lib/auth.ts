// Account + license key client for the LMS backend (web/functions/api).
// Supports 4-tier RBAC, real device identity, active-time heartbeat sync,
// and offline grace with clock-rollback protection.
import { IS_WEB } from "@/lib/platform";

export const AUTH_REQUIRED = !IS_WEB;
export const API_BASE = IS_WEB ? "" : "https://lms.luangroup.asia";
export const ADMIN_URL = `${API_BASE || ""}/admin/`;

/** How long the app keeps working without reaching the server. */
const OFFLINE_GRACE_MS = 72 * 3_600_000;
const CLOCK_ROLLBACK_TOLERANCE_MS = 5 * 60_000;
const STORE = "lms.auth.v1";
const DEVICE = "lms.device.v1";

export type AuthRole = "user" | "staff" | "admin" | "super_admin";

export type AuthUser = {
  id?: number;
  username: string;
  displayName: string;
  role: AuthRole;
  roleLabel?: string;
};

export type AuthLicense = {
  key: string;
  durationDays?: number;
  expiresAt: number | null;
  maxDevices: number;
  devices: number;
  activatedAt: number | null;
  status?: string;
};

export type AuthState = {
  token: string;
  user: AuthUser;
  license: AuthLicense | null;
  checkedAt: number;
  clockOffset?: number;
};

export const isConsoleRole = (role?: string) =>
  role === "super_admin" || role === "admin" || role === "staff";

export const isLicenseExempt = (role?: string) => isConsoleRole(role);

export function roleLabel(role?: string): string {
  if (role === "super_admin") return "Quản trị tối cao";
  if (role === "admin") return "Quản trị viên";
  if (role === "staff") return "Hỗ trợ / CTV";
  return "Người dùng";
}

export class AuthError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

const read = <T,>(k: string): T | null => {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: unknown) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

export function deviceId(): string {
  let id = read<string>(DEVICE);
  if (!id) {
    id =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    write(DEVICE, id);
  }
  return id;
}

type ClientMeta = { deviceName: string; platform: string; appVersion: string };
let cachedClientMeta: Promise<ClientMeta> | null = null;

export function getClientMeta(): Promise<ClientMeta> {
  if (cachedClientMeta) return cachedClientMeta;
  cachedClientMeta = (async () => {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const osGuess = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Máy tính";
    let hostname = "";
    let platform = IS_WEB ? "web" : (typeof window !== "undefined" && window.electron?.platform) || "desktop";
    let arch = "";
    let appVersion = "";

    if (typeof window !== "undefined" && window.electron) {
      try {
        const info = await window.electron.getSystemInfo?.();
        if (info?.hostname) hostname = String(info.hostname).trim();
        if (info?.platform) platform = String(info.platform);
        if (info?.arch) arch = String(info.arch);
      } catch {}
      try {
        const rawVer = await window.electron.getAppVersion?.();
        if (rawVer) appVersion = String(rawVer).trim().split(/\s+/)[0];
      } catch {}
    }

    const osLabel = platform === "win" ? "Windows" : platform === "mac" ? "macOS" : platform === "linux" ? "Linux" : osGuess;
    const suffix = arch ? `${osLabel} ${arch}` : osLabel;
    const deviceName = hostname ? `${hostname} · ${suffix}` : `${suffix} · LMS Studio`;
    return { deviceName: deviceName.slice(0, 120), platform: platform.slice(0, 32), appVersion: appVersion.slice(0, 40) };
  })();
  return cachedClientMeta;
}

export const savedAuth = () => read<AuthState>(STORE);
export const saveAuth = (s: AuthState | null) => write(STORE, s);

async function call<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new AuthError("OFFLINE", "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new AuthError(j?.error?.code ?? "SERVER", j?.error?.message ?? `Lỗi máy chủ (${r.status})`);
  return j as T;
}

export async function login(username: string, password: string, key?: string): Promise<AuthState> {
  const meta = await getClientMeta();
  const r = await call<{ token: string; user: AuthUser; license: AuthLicense | null; serverTime?: number }>("/auth/login", "POST", {
    username,
    password,
    key: key || undefined,
    deviceId: deviceId(),
    deviceName: meta.deviceName,
    platform: meta.platform,
    appVersion: meta.appVersion,
  });
  const now = Date.now();
  const s: AuthState = {
    token: r.token,
    user: r.user,
    license: r.license,
    checkedAt: now,
    clockOffset: r.serverTime ? r.serverTime - now : 0,
  };
  saveAuth(s);
  return s;
}

function handleOfflineFallback(s: AuthState, err: unknown): AuthState {
  if (err instanceof AuthError && (err.code === "OFFLINE" || err.code === "SERVER")) {
    const now = Date.now();
    // Guard against rolling the local system clock backwards to bypass expiry or offline grace
    if (now < s.checkedAt - CLOCK_ROLLBACK_TOLERANCE_MS) {
      throw new AuthError("CLOCK_SKEW", "Đồng hồ máy tính bị lệch ngược. Hãy chỉnh lại giờ chuẩn và kết nối mạng để xác thực bản quyền.");
    }
    if (now - s.checkedAt < OFFLINE_GRACE_MS && !expired(s)) return s;
    if (expired(s)) {
      throw new AuthError("KEY_EXPIRED", "Key bản quyền đã hết hạn. Kết nối mạng để gia hạn hoặc nhập key mới.");
    }
    throw new AuthError(err.code, "Đã quá 72 giờ không kết nối được máy chủ để kiểm tra bản quyền. Kết nối mạng rồi thử lại.");
  }
  saveAuth(null);
  throw err;
}

/** Re-checks the saved session. Offline within the grace period keeps the saved state. */
export async function refresh(s: AuthState): Promise<AuthState> {
  try {
    const r = await call<{ user: AuthUser; license: AuthLicense | null; serverTime: number }>("/auth/me", "GET", undefined, s.token);
    const now = Date.now();
    const next: AuthState = {
      token: s.token,
      user: r.user,
      license: r.license,
      checkedAt: now,
      clockOffset: r.serverTime ? r.serverTime - now : s.clockOffset ?? 0,
    };
    saveAuth(next);
    return next;
  } catch (e) {
    return handleOfflineFallback(s, e);
  }
}

/** Reports active usage time & current tool to the server and re-verifies account/key/session status. */
export async function heartbeat(
  s: AuthState,
  payload: { activeSeconds: number; currentTool?: string },
): Promise<AuthState> {
  try {
    const meta = await getClientMeta();
    const r = await call<{ user: AuthUser; license: AuthLicense | null; serverTime: number }>(
      "/auth/heartbeat",
      "POST",
      {
        activeSeconds: Math.max(0, Math.min(180, Math.round(payload.activeSeconds))),
        currentTool: payload.currentTool || "",
        appVersion: meta.appVersion,
        deviceName: meta.deviceName,
        platform: meta.platform,
      },
      s.token,
    );
    const now = Date.now();
    const next: AuthState = {
      token: s.token,
      user: r.user,
      license: r.license,
      checkedAt: now,
      clockOffset: r.serverTime ? r.serverTime - now : s.clockOffset ?? 0,
    };
    saveAuth(next);
    return next;
  } catch (e) {
    return handleOfflineFallback(s, e);
  }
}

export async function logout(s: AuthState | null) {
  saveAuth(null);
  if (s) await call("/auth/logout", "POST", undefined, s.token).catch(() => {});
}

export const changePassword = (s: AuthState, oldPassword: string, newPassword: string) =>
  call("/auth/password", "POST", { oldPassword, newPassword }, s.token);

export const serverNowFor = (s: AuthState) => Date.now() + (s.clockOffset ?? 0);

export const expired = (s: AuthState) => {
  if (isLicenseExempt(s.user.role)) return false;
  if (!s.license) return true;
  if (s.license.expiresAt === null) return false;
  return s.license.expiresAt <= serverNowFor(s);
};

export function expiryText(l: AuthLicense | null, clockOffset = 0): string {
  if (!l) return "";
  if (l.expiresAt === null) return "Vĩnh viễn";
  const now = Date.now() + clockOffset;
  const diff = l.expiresAt - now;
  const dateStr = new Date(l.expiresAt).toLocaleDateString("vi-VN");
  if (diff <= 0) return `Đã hết hạn (${dateStr})`;
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) {
    const remH = hours % 24;
    return `${dateStr} · còn ${days} ngày${remH ? ` ${remH} giờ` : ""}`;
  }
  if (hours >= 1) {
    const remM = mins % 60;
    return `${dateStr} · còn ${hours} giờ${remM ? ` ${remM} phút` : ""}`;
  }
  return `${dateStr} · còn ${Math.max(1, mins)} phút`;
}
