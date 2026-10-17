import { app, session } from "electron";
import { spawn } from "child_process";
import fs from "fs";
import net from "net";
import { join } from "path";
import { CHATGPT_PARTITION } from "./chatgpt-bridge";
import logit from "../utils/logit";

// Google refuses to sign in inside embedded browsers. This signs the user in to
// ChatGPT in their real Edge or Chrome (own profile, so their everyday browser
// is untouched), then copies the ChatGPT session cookies into the app's
// ChatGPT tab. Google only ever sees a genuine browser and the user typing.

const LOGIN_URL = "https://chatgpt.com/auth/login";
const SESSION_COOKIE = "__Secure-next-auth.session-token";
const COPIED_DOMAINS = ["chatgpt.com", "openai.com"];
const LOGIN_TIMEOUT_MS = 15 * 60 * 1000;

type Browser = { name: "Edge" | "Chrome"; path: string };

const macBrowsers = (): Browser[] => {
  const home = app.getPath("home");
  const inApps = (bundle: string, binary: string) => [
    join("/Applications", bundle, "Contents", "MacOS", binary),
    join(home, "Applications", bundle, "Contents", "MacOS", binary),
  ];
  return [
    ...inApps("Google Chrome.app", "Google Chrome").map((path) => ({ name: "Chrome" as const, path })),
    ...inApps("Microsoft Edge.app", "Microsoft Edge").map((path) => ({ name: "Edge" as const, path })),
  ];
};

const windowsBrowsers = (): Browser[] => {
  const pf = process.env["ProgramFiles"] || "C:\\Program Files";
  const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const local = process.env["LOCALAPPDATA"] || "";
  return [
    { name: "Chrome", path: join(pf, "Google", "Chrome", "Application", "chrome.exe") },
    { name: "Chrome", path: join(pf86, "Google", "Chrome", "Application", "chrome.exe") },
    { name: "Chrome", path: join(local, "Google", "Chrome", "Application", "chrome.exe") },
    { name: "Edge", path: join(pf86, "Microsoft", "Edge", "Application", "msedge.exe") },
    { name: "Edge", path: join(pf, "Microsoft", "Edge", "Application", "msedge.exe") },
  ];
};

// Chrome first (what most users sign in with); Edge is the fallback
const findBrowser = (): Browser | null =>
  (process.platform === "darwin" ? macBrowsers() : windowsBrowsers()).find((c) => fs.existsSync(c.path)) ?? null;

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as net.AddressInfo;
      server.close(() => resolve(port));
    });
  });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fixed per browser so a sign-in window left running can be found again
const STABLE_PORT: Record<Browser["name"], number> = { Edge: 47291, Chrome: 47292 };

/** Debugger websocket of the browser on this port, or "" when none answers. */
const debuggerUrl = async (port: number, name: Browser["name"]) => {
  try {
    const info = await (await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1500) })).json();
    const matches = name === "Edge" ? /Edg\//.test(info.Browser) : /^Chrome\//.test(info.Browser);
    return matches ? String(info.webSocketDebuggerUrl || "") : "";
  } catch {
    return "";
  }
};

const portInUse = (port: number) =>
  new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(false)));
  });

/** Minimal Chrome DevTools Protocol client over the browser websocket. */
const connect = (url: string) =>
  new Promise<{ send: (method: string, params?: object) => Promise<any>; close: () => void }>((resolve, reject) => {
    const socket = new WebSocket(url);
    let nextId = 0;
    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    };
    socket.onclose = () => pending.forEach((w) => w.reject(new Error("Trình duyệt đã đóng.")));
    socket.onerror = () => reject(new Error("Không kết nối được với trình duyệt."));
    socket.onopen = () =>
      resolve({
        send: (method, params = {}) =>
          new Promise((res, rej) => {
            // send() on a closed socket is silently dropped, which would wait forever
            if (socket.readyState !== WebSocket.OPEN) {
              rej(new Error("Trình duyệt đã đóng."));
              return;
            }
            const id = ++nextId;
            const timer = setTimeout(() => {
              pending.delete(id);
              rej(new Error("Trình duyệt không phản hồi."));
            }, 10000);
            pending.set(id, {
              resolve: (v) => (clearTimeout(timer), res(v)),
              reject: (e) => (clearTimeout(timer), rej(e)),
            });
            socket.send(JSON.stringify({ id, method, params }));
          }),
        close: () => socket.close(),
      });
  });

type CdpCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite?: "Strict" | "Lax" | "None";
};

const SAME_SITE = { Strict: "strict", Lax: "lax", None: "no_restriction" } as const;

const isCopied = (domain: string) => {
  const host = domain.replace(/^\./, "");
  return COPIED_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
};

/** Puts the browser's ChatGPT/OpenAI cookies into the app's ChatGPT session. */
const copyCookies = async (cookies: CdpCookie[]) => {
  const target = session.fromPartition(CHATGPT_PARTITION).cookies;
  let copied = 0;
  for (const c of cookies.filter((c) => isCopied(c.domain))) {
    const host = c.domain.replace(/^\./, "");
    try {
      await target.set({
        url: `https://${host}${c.path || "/"}`,
        name: c.name,
        value: c.value,
        // Host-only cookies (no leading dot) must not get a domain attribute
        ...(c.domain.startsWith(".") ? { domain: c.domain } : {}),
        path: c.path || "/",
        secure: c.secure,
        httpOnly: c.httpOnly,
        ...(c.expires > 0 ? { expirationDate: c.expires } : {}),
        sameSite: c.sameSite ? SAME_SITE[c.sameSite] : "unspecified",
      });
      copied++;
    } catch (error) {
      logit("⚠️ Cookie not copied: ", c.name, error instanceof Error ? error.message : error);
    }
  }
  await target.flushStore();
  return copied;
};

let running = false;

/** Opens Edge/Chrome for the ChatGPT sign-in and copies the session back. */
export const loginWithBrowser = async (): Promise<{ ok: boolean; message: string }> => {
  if (running) return { ok: false, message: "Cửa sổ đăng nhập đang mở, hãy hoàn tất đăng nhập ở đó." };
  const browser = findBrowser();
  if (!browser) return { ok: false, message: "Không tìm thấy Microsoft Edge hoặc Google Chrome trên máy." };

  running = true;
  let cdp: Awaited<ReturnType<typeof connect>> | null = null;
  try {
    const profile = join(app.getPath("userData"), "login-browser", browser.name);
    fs.mkdirSync(profile, { recursive: true });

    // A sign-in browser from an earlier attempt may still run in the background
    // with this profile; a second launch would only hand over to it, so reuse it.
    let port = STABLE_PORT[browser.name];
    let wsUrl = await debuggerUrl(port, browser.name);
    const reused = !!wsUrl;
    if (!reused) {
      if (await portInUse(port)) port = await freePort();
      // msedge.exe / chrome.exe hand off to the real browser process and exit at
      // once, so the browser's lifetime is followed through the debugging socket
      spawn(
        browser.path,
        [
          `--remote-debugging-port=${port}`,
          `--user-data-dir=${profile}`,
          "--no-first-run",
          "--no-default-browser-check",
          "--new-window",
          LOGIN_URL,
        ],
        { stdio: "ignore", detached: true },
      ).unref();
      for (let i = 0; i < 60 && !wsUrl; i++) {
        await wait(500);
        wsUrl = await debuggerUrl(port, browser.name);
      }
    }
    if (!wsUrl) return { ok: false, message: `Không mở được ${browser.name}. Hãy thử lại.` };
    cdp = await connect(wsUrl);
    if (reused) await cdp.send("Target.createTarget", { url: LOGIN_URL, newWindow: true });
    logit(`🔐 Waiting for ChatGPT sign-in in ${browser.name}${reused ? " (reused window)" : ""}`);

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      let cookies: CdpCookie[];
      try {
        ({ cookies } = (await cdp.send("Storage.getCookies")) as { cookies: CdpCookie[] });
      } catch {
        return { ok: false, message: `Bạn đã đóng ${browser.name} trước khi đăng nhập xong.` };
      }
      const signedIn = cookies.some((c) => c.name.startsWith(SESSION_COOKIE) && isCopied(c.domain));
      if (signedIn) {
        const copied = await copyCookies(cookies);
        logit(`✅ Copied ${copied} ChatGPT cookies from ${browser.name}`);
        await cdp.send("Browser.close").catch(() => undefined);
        return { ok: true, message: `Đã đăng nhập ChatGPT qua ${browser.name}.` };
      }
      await wait(2000);
    }
    return { ok: false, message: "Hết thời gian chờ đăng nhập (15 phút)." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    cdp?.close();
    running = false;
  }
};
