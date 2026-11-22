import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import {
  CheckCircle2,
  Clock,
  Crown,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  Monitor,
  RefreshCw,
  Shield,
  User,
  X,
} from "lucide-react";
import UpscaylSVGLogo from "@/components/icons/upscayl-logo-svg";
import { activeTabAtom } from "@/atoms/workspace-atom";
import {
  ADMIN_URL,
  AUTH_REQUIRED,
  AuthError,
  AuthState,
  changePassword,
  expired,
  expiryText,
  heartbeat,
  isConsoleRole,
  login,
  logout,
  refresh,
  roleLabel,
  savedAuth,
} from "@/lib/auth";

const HEARTBEAT_MS = 60_000;

type Ctx = {
  auth: AuthState | null;
  signOut: () => void;
  refreshNow: () => Promise<void>;
  syncing: boolean;
};

const AuthContext = createContext<Ctx>({
  auth: null,
  signOut: () => {},
  refreshNow: async () => {},
  syncing: false,
});

export const useAuth = () => useContext(AuthContext);

/** Locks the desktop app until the person signs in with an account that has a live key. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checking, setChecking] = useState(AUTH_REQUIRED);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState("");
  const activeTab = useAtomValue(activeTabAtom);
  const authRef = useRef<AuthState | null>(null);
  const activeTabRef = useRef<string>(activeTab);
  const lastBeatAtRef = useRef<number>(Date.now());
  const inFlightRef = useRef(false);

  authRef.current = auth;
  activeTabRef.current = activeTab;

  const recheck = useCallback(async (s: AuthState) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSyncing(true);
    try {
      const next = await refresh(s);
      lastBeatAtRef.current = Date.now();
      setAuth(next);
    } catch (e) {
      setAuth(null);
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      inFlightRef.current = false;
      setSyncing(false);
    }
  }, []);

  const sendHeartbeat = useCallback(async () => {
    const s = authRef.current;
    if (!s || inFlightRef.current || document.hidden) return;
    inFlightRef.current = true;
    const now = Date.now();
    const elapsedSec = Math.max(0, Math.min(180, Math.round((now - lastBeatAtRef.current) / 1000)));
    lastBeatAtRef.current = now;
    try {
      const next = await heartbeat(s, { activeSeconds: elapsedSec, currentTool: activeTabRef.current });
      setAuth(next);
    } catch (e) {
      setAuth(null);
      setNotice(e instanceof Error ? e.message : String(e));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Initial session validation on startup — waits for server before rejecting an expired cached license
  useEffect(() => {
    if (!AUTH_REQUIRED) return;
    const s = savedAuth();
    if (!s) {
      setChecking(false);
      return;
    }
    if (!expired(s)) setAuth(s);
    recheck(s).finally(() => setChecking(false));
  }, [recheck]);

  // Real-time 60s heartbeat + immediate sync on window focus / visibility / network reconnect
  useEffect(() => {
    if (!AUTH_REQUIRED || !auth) return;
    lastBeatAtRef.current = Date.now();
    const id = window.setInterval(() => {
      if (!document.hidden) sendHeartbeat();
    }, HEARTBEAT_MS);

    const onVisibility = () => {
      if (!document.hidden) {
        lastBeatAtRef.current = Date.now();
        const cur = authRef.current;
        if (cur && Date.now() - cur.checkedAt > HEARTBEAT_MS) sendHeartbeat();
      }
    };
    const onFocus = () => {
      const cur = authRef.current;
      if (cur && Date.now() - cur.checkedAt > HEARTBEAT_MS) sendHeartbeat();
    };
    const onOnline = () => {
      const cur = authRef.current;
      if (cur) recheck(cur);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
    };
  }, [auth?.token, recheck, sendHeartbeat]);

  // Report tool switch immediately when user moves to a new tool (after a short debounce)
  useEffect(() => {
    if (!AUTH_REQUIRED || !authRef.current) return;
    const t = window.setTimeout(() => {
      if (!document.hidden && authRef.current) sendHeartbeat();
    }, 1500);
    return () => window.clearTimeout(t);
  }, [activeTab, sendHeartbeat]);

  const signOut = useCallback(() => {
    logout(authRef.current);
    setAuth(null);
    setNotice("");
  }, []);

  const refreshNow = useCallback(async () => {
    if (authRef.current) await recheck(authRef.current);
  }, [recheck]);

  if (!AUTH_REQUIRED) return <>{children}</>;
  if (checking) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#08090f] text-white">
        <UpscaylSVGLogo className="h-14 w-14" />
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
          Đang kiểm tra bản quyền LMS Studio…
        </div>
      </div>
    );
  }
  if (!auth || expired(auth)) {
    return (
      <LoginScreen
        notice={notice || (auth && expired(auth) ? "Key đã hết hạn. Nhập key mới để gia hạn hoặc liên hệ quản trị viên." : "")}
        presetUser={auth?.user.username}
        onDone={(s) => {
          setNotice("");
          lastBeatAtRef.current = Date.now();
          setAuth(s);
        }}
      />
    );
  }
  return <AuthContext.Provider value={{ auth, signOut, refreshNow, syncing }}>{children}</AuthContext.Provider>;
}

function LoginScreen({ notice, presetUser, onDone }: { notice: string; presetUser?: string; onDone: (s: AuthState) => void }) {
  const [username, setUsername] = useState(presetUser ?? "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (presetUser) setUsername(presetUser);
  }, [presetUser]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onDone(await login(username.trim(), password, key.trim()));
    } catch (err) {
      const code = err instanceof AuthError ? err.code : "";
      if (code === "NEED_KEY" || code === "KEY_EXPIRED") setShowKey(true);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex h-screen items-center justify-center bg-[#05060a] p-4 text-white"
      style={{
        background:
          "radial-gradient(800px 460px at 80% -10%, rgba(246,188,23,.16), transparent 60%), radial-gradient(700px 460px at 10% 90%, rgba(56,189,248,.14), transparent 60%), #05060a",
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-3xl border border-white/15 bg-[#111218]/90 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-6 flex flex-col items-center gap-2.5">
          <div className="relative">
            <span className="absolute inset-1 rounded-2xl bg-amber-400/40 blur-xl" />
            <UpscaylSVGLogo className="relative h-16 w-16" />
          </div>
          <h1 className="text-2xl font-black tracking-tight uppercase">
            LMS <span className="text-amber-400">Studio</span>
          </h1>
          <p className="text-center text-xs text-white/60">Đăng nhập bằng tài khoản được cấp để sử dụng ứng dụng</p>
        </div>

        {notice && (
          <div className="mb-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{notice}</div>
        )}

        <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-3 focus-within:border-amber-400">
          <User className="h-4 w-4 text-white/45" />
          <input
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
            placeholder="Tên đăng nhập"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>

        <label className="mb-3 flex items-center gap-2 rounded-xl border border-white/15 bg-black/50 px-3 focus-within:border-amber-400">
          <KeyRound className="h-4 w-4 text-white/45" />
          <input
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
            type={showPw ? "text" : "password"}
            placeholder="Mật khẩu"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="text-white/45 hover:text-white"
            onClick={() => setShowPw((v) => !v)}
            tabIndex={-1}
            aria-label={showPw ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </label>

        {showKey ? (
          <input
            className="mb-3 h-11 w-full rounded-xl border border-amber-400/50 bg-black/50 px-3 font-mono text-sm uppercase outline-none placeholder:text-white/35 focus:border-amber-400"
            placeholder="LMS-XXXX-XXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        ) : (
          <button type="button" className="mb-3 text-xs font-semibold text-amber-400 hover:underline" onClick={() => setShowKey(true)}>
            + Nhập key bản quyền
          </button>
        )}

        {error && (
          <div className="mb-3 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{error}</div>
        )}

        <button
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-sm font-bold uppercase tracking-wide text-black shadow-[0_8px_28px_-8px_rgba(246,188,23,0.65)] transition hover:bg-amber-300 disabled:opacity-60"
          disabled={busy}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Đăng nhập"}
        </button>

        <p className="mt-4 text-center text-[11px] text-white/45">Chưa có tài khoản hoặc key? Liên hệ quản trị viên LMS Studio.</p>
      </form>
    </div>
  );
}

/** Real React modal for changing password (replaces window.prompt which is unsupported in Electron). */
function ChangePasswordModal({ auth, onClose }: { auth: AuthState; onClose: () => void }) {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (newPw.length < 6) {
      setErr("Mật khẩu mới cần ít nhất 6 ký tự.");
      return;
    }
    if (newPw !== confirmPw) {
      setErr("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    try {
      await changePassword(auth, oldPw, newPw);
      setOk(true);
      window.setTimeout(onClose, 1300);
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#12131a] p-6 text-white shadow-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/15 text-amber-400">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold">Đổi mật khẩu</h3>
              <p className="text-xs text-white/55">{auth.user.username}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {ok ? (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Đã đổi mật khẩu thành công! Các thiết bị khác đã được đăng xuất.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-white/70">Mật khẩu hiện tại</span>
                <input
                  type={showPw ? "text" : "password"}
                  value={oldPw}
                  onChange={(e) => setOldPw(e.target.value)}
                  required
                  autoFocus
                  className="h-10 w-full rounded-xl border border-white/15 bg-black/50 px-3 text-sm outline-none focus:border-amber-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-white/70">Mật khẩu mới (ít nhất 6 ký tự)</span>
                <input
                  type={showPw ? "text" : "password"}
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  required
                  minLength={6}
                  className="h-10 w-full rounded-xl border border-white/15 bg-black/50 px-3 text-sm outline-none focus:border-amber-400"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-white/70">Nhập lại mật khẩu mới</span>
                <input
                  type={showPw ? "text" : "password"}
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  required
                  minLength={6}
                  className="h-10 w-full rounded-xl border border-white/15 bg-black/50 px-3 text-sm outline-none focus:border-amber-400"
                />
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-white/60">
                <input type="checkbox" checked={showPw} onChange={(e) => setShowPw(e.target.checked)} className="rounded" />
                Hiện mật khẩu
              </label>
            </div>

            {err && (
              <div className="mt-3 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 py-2 text-xs text-rose-200">{err}</div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm text-white/70">
                Huỷ
              </button>
              <button
                type="submit"
                disabled={busy}
                className="btn btn-sm border-0 bg-amber-400 font-bold text-black hover:bg-amber-300"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lưu mật khẩu"}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

/** Account button for the top bar: role badge, license countdown, admin portal link, change password modal, sign out. */
export function AccountMenu() {
  const { auth, signOut, refreshNow, syncing } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!AUTH_REQUIRED || !auth) return null;
  const privileged = isConsoleRole(auth.user.role);

  return (
    <>
      <div className="relative" ref={boxRef}>
        <button
          className="btn btn-ghost btn-sm gap-2 rounded-xl px-2.5"
          onClick={() => setOpen((v) => !v)}
          data-tooltip-id="tooltip"
          data-tooltip-content={`${auth.user.displayName} · ${roleLabel(auth.user.role)}`}
        >
          <span className="relative flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/20 text-amber-400">
            {auth.user.role === "super_admin" ? <Crown className="h-3.5 w-3.5" /> : privileged ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-base-100" />
          </span>
          <span className="hidden max-w-[110px] truncate text-xs font-semibold xl:inline">{auth.user.displayName}</span>
        </button>

        {open && (
          <div className="glass absolute right-0 top-11 z-50 w-80 rounded-2xl border border-base-content/15 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-bold">{auth.user.displayName}</div>
                <div className="truncate text-xs text-base-content/60">{auth.user.username}</div>
              </div>
              <span className="shrink-0 rounded-full border border-amber-400/35 bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-400">
                {roleLabel(auth.user.role)}
              </span>
            </div>

            {auth.license ? (
              <div className="mt-3 space-y-1.5 rounded-xl border border-base-content/10 bg-base-200/50 p-3 text-xs">
                <div className="font-mono font-semibold text-amber-400">{auth.license.key}</div>
                <div className="flex items-center gap-1.5 text-base-content/80">
                  <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span>Hạn dùng: {expiryText(auth.license, auth.clockOffset ?? 0)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-base-content/80">
                  <Monitor className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span>
                    Thiết bị: {auth.license.devices}/{auth.license.maxDevices} máy
                  </span>
                </div>
              </div>
            ) : (
              privileged && (
                <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-300">
                  Quyền quản trị · không giới hạn thời gian & thiết bị
                </div>
              )
            )}

            <div className="mt-3 flex flex-col gap-2">
              {privileged && (
                <button
                  className="btn btn-sm w-full border-0 bg-amber-400 font-bold text-black hover:bg-amber-300"
                  onClick={() => {
                    setOpen(false);
                    window.open(ADMIN_URL, "_blank");
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Mở trang quản trị
                </button>
              )}
              <button
                className="btn btn-sm w-full"
                disabled={syncing}
                onClick={() => refreshNow()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Đang đồng bộ…" : "Kiểm tra lại bản quyền"}
              </button>
              <div className="flex gap-2">
                <button
                  className="btn btn-sm flex-1"
                  onClick={() => {
                    setOpen(false);
                    setPwOpen(true);
                  }}
                >
                  Đổi mật khẩu
                </button>
                <button className="btn btn-sm btn-error flex-1" onClick={signOut}>
                  <LogOut className="h-3.5 w-3.5" /> Đăng xuất
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {pwOpen && <ChangePasswordModal auth={auth} onClose={() => setPwOpen(false)} />}
    </>
  );
}
