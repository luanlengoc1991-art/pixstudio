// Account + license key client for the LMS backend (web/functions/api).
// The desktop app is locked until a person signs in with an account that has a
// live key; the session is re-checked with the server periodically, and the app
// keeps working offline for a while after the last successful check.
import { IS_WEB } from "@/lib/platform";

export const AUTH_REQUIRED = !IS_WEB;
export const API_BASE = IS_WEB ? "" : "https://lms.luangroup.asia";
export const ADMIN_URL = `${API_BASE || ""}/admin/`;

/** How long the app keeps working without reaching the server. */
const OFFLINE_GRACE_MS = 72 * 3_600_000;
const STORE = "lms.auth.v1";
const DEVICE = "lms.device.v1";

export type AuthUser = { username: string; displayName: string; role: "user" | "admin" };
export type AuthLicense = { key: string; expiresAt: number | null; maxDevices: number; devices: number; activatedAt: number | null };
export type AuthState = { token: string; user: AuthUser; license: AuthLicense | null; checkedAt: number };

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
    id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    write(DEVICE, id);
  }
  return id;
}

function deviceName(): string {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Máy tính";
  return `${os} · LMS Studio`;
}

export const savedAuth = () => read<AuthState>(STORE);
export const saveAuth = (s: AuthState | null) => write(STORE, s);

async function call<T>(path: string, method: string, body?: unknown, token?: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE}/api${path}`, {
      method,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
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
  const r = await call<Omit<AuthState, "checkedAt">>("/auth/login", "POST", {
    username,
    password,
    key: key || undefined,
    deviceId: deviceId(),
    deviceName: deviceName(),
  });
  const s = { ...r, checkedAt: Date.now() };
  saveAuth(s);
  return s;
}

/** Re-checks the saved session. Offline within the grace period keeps the saved state. */
export async function refresh(s: AuthState): Promise<AuthState> {
  try {
    const r = await call<{ user: AuthUser; license: AuthLicense | null; serverTime: number }>("/auth/me", "GET", undefined, s.token);
    const next = { token: s.token, user: r.user, license: r.license, checkedAt: Date.now() };
    saveAuth(next);
    return next;
  } catch (e) {
    if (e instanceof AuthError && (e.code === "OFFLINE" || e.code === "SERVER")) {
      if (Date.now() - s.checkedAt < OFFLINE_GRACE_MS && !expired(s)) return s;
      throw new AuthError(e.code, "Đã quá 72 giờ không kết nối được máy chủ để kiểm tra bản quyền. Kết nối mạng rồi thử lại.");
    }
    saveAuth(null);
    throw e;
  }
}

export async function logout(s: AuthState | null) {
  saveAuth(null);
  if (s) await call("/auth/logout", "POST", undefined, s.token).catch(() => {});
}

export const changePassword = (s: AuthState, oldPassword: string, newPassword: string) =>
  call("/auth/password", "POST", { oldPassword, newPassword }, s.token);

export const expired = (s: AuthState) =>
  s.user.role !== "admin" && (!s.license || (s.license.expiresAt !== null && s.license.expiresAt <= Date.now()));

export function expiryText(l: AuthLicense | null): string {
  if (!l) return "";
  if (l.expiresAt === null) return "Vĩnh viễn";
  const days = Math.ceil((l.expiresAt - Date.now()) / 86_400_000);
  return `${new Date(l.expiresAt).toLocaleDateString("vi-VN")} · còn ${Math.max(days, 0)} ngày`;
}
