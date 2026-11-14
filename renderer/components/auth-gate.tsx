import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { KeyRound, Loader2, LogOut, User } from "lucide-react";
import UpscaylSVGLogo from "@/components/icons/upscayl-logo-svg";
import {
  AUTH_REQUIRED,
  AuthError,
  AuthState,
  changePassword,
  expired,
  expiryText,
  login,
  logout,
  refresh,
  savedAuth,
} from "@/lib/auth";

const RECHECK_MS = 30 * 60_000;

type Ctx = { auth: AuthState | null; signOut: () => void };
const AuthContext = createContext<Ctx>({ auth: null, signOut: () => {} });
export const useAuth = () => useContext(AuthContext);

/** Locks the desktop app until the person signs in with an account that has a live key. */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [checking, setChecking] = useState(AUTH_REQUIRED);
  const [notice, setNotice] = useState("");

  const recheck = useCallback(async (s: AuthState) => {
    try {
      setAuth(await refresh(s));
    } catch (e) {
      setAuth(null);
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!AUTH_REQUIRED) return;
    const s = savedAuth();
    if (!s) {
      setChecking(false);
      return;
    }
    setAuth(s);
    recheck(s).finally(() => setChecking(false));
  }, [recheck]);

  useEffect(() => {
    if (!AUTH_REQUIRED || !auth) return;
    const id = setInterval(() => recheck(auth), RECHECK_MS);
    const onFocus = () => {
      if (Date.now() - auth.checkedAt > 5 * 60_000) recheck(auth);
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [auth, recheck]);

  const signOut = useCallback(() => {
    logout(auth);
    setAuth(null);
    setNotice("");
  }, [auth]);

  if (!AUTH_REQUIRED) return <>{children}</>;
  if (checking && !auth) {
    return (
      <div className="flex h-screen items-center justify-center bg-base-300">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!auth || expired(auth)) {
    return (
      <LoginScreen
        notice={notice || (auth && expired(auth) ? "Key đã hết hạn. Nhập key mới để gia hạn." : "")}
        presetUser={auth?.user.username}
        onDone={(s) => {
          setNotice("");
          setAuth(s);
        }}
      />
    );
  }
  return <AuthContext.Provider value={{ auth, signOut }}>{children}</AuthContext.Provider>;
}

function LoginScreen({ notice, presetUser, onDone }: { notice: string; presetUser?: string; onDone: (s: AuthState) => void }) {
  const [username, setUsername] = useState(presetUser ?? "");
  const [password, setPassword] = useState("");
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      className="flex h-screen items-center justify-center bg-base-300 p-4"
      style={{ background: "radial-gradient(circle at 30% 20%, rgba(124,92,255,.25), transparent 50%), radial-gradient(circle at 80% 80%, rgba(56,189,248,.18), transparent 50%)" }}
    >
      <form onSubmit={submit} className="glass w-full max-w-sm rounded-3xl p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <UpscaylSVGLogo className="h-16 w-16" />
          <h1 className="text-xl font-black tracking-wide">LMS Studio</h1>
          <p className="text-center text-sm text-base-content/60">Đăng nhập bằng tài khoản được cấp để dùng app</p>
        </div>
        {notice && <div className="mb-4 rounded-xl bg-warning/15 px-3 py-2 text-sm text-warning">{notice}</div>}
        <label className="mb-3 flex items-center gap-2 rounded-xl border border-base-content/15 bg-base-100 px-3">
          <User className="h-4 w-4 opacity-60" />
          <input
            className="h-11 flex-1 bg-transparent outline-none"
            placeholder="Tên đăng nhập"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="mb-3 flex items-center gap-2 rounded-xl border border-base-content/15 bg-base-100 px-3">
          <KeyRound className="h-4 w-4 opacity-60" />
          <input
            className="h-11 flex-1 bg-transparent outline-none"
            type="password"
            placeholder="Mật khẩu"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {showKey ? (
          <input
            className="mb-3 h-11 w-full rounded-xl border border-primary/40 bg-base-100 px-3 font-mono uppercase outline-none"
            placeholder="LMS-XXXX-XXXX-XXXX-XXXX"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        ) : (
          <button type="button" className="mb-3 text-sm text-primary hover:underline" onClick={() => setShowKey(true)}>
            Nhập key bản quyền
          </button>
        )}
        {error && <div className="mb-3 rounded-xl bg-error/15 px-3 py-2 text-sm text-error">{error}</div>}
        <button className="btn btn-primary h-11 w-full rounded-xl" disabled={busy}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Đăng nhập"}
        </button>
        <p className="mt-4 text-center text-xs text-base-content/50">Chưa có tài khoản hoặc key? Liên hệ quản trị viên.</p>
      </form>
    </div>
  );
}

/** Account button for the top bar: who is signed in, key expiry, change password, sign out. */
export function AccountMenu() {
  const { auth, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  if (!AUTH_REQUIRED || !auth) return null;

  const changePw = async () => {
    const oldPw = window.prompt("Mật khẩu hiện tại:");
    if (!oldPw) return;
    const newPw = window.prompt("Mật khẩu mới (ít nhất 6 ký tự):");
    if (!newPw) return;
    try {
      await changePassword(auth, oldPw, newPw);
      setMsg("Đã đổi mật khẩu");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="relative">
      <button
        className="btn btn-ghost btn-sm btn-square"
        onClick={() => setOpen((v) => !v)}
        data-tooltip-id="tooltip"
        data-tooltip-content={auth.user.displayName}
      >
        <User className="h-5 w-5" />
      </button>
      {open && (
        <div className="glass absolute right-0 top-10 z-50 w-72 rounded-2xl p-4 shadow-2xl">
          <div className="font-bold">{auth.user.displayName}</div>
          <div className="text-xs text-base-content/60">
            {auth.user.username}
            {auth.user.role === "admin" ? " · Quản trị viên" : ""}
          </div>
          {auth.license && (
            <div className="mt-3 space-y-1 text-sm">
              <div className="font-mono text-xs">{auth.license.key}</div>
              <div>Hạn dùng: {expiryText(auth.license)}</div>
              <div>
                Máy: {auth.license.devices}/{auth.license.maxDevices}
              </div>
            </div>
          )}
          {msg && <div className="mt-2 text-xs text-primary">{msg}</div>}
          <div className="mt-4 flex gap-2">
            <button className="btn btn-sm flex-1" onClick={changePw}>
              Đổi mật khẩu
            </button>
            <button className="btn btn-sm btn-error flex-1" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
