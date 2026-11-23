// Google OAuth 2.0 + PKCE for the Electron desktop app via ephemeral loopback (127.0.0.1:<port>/cb).
// Opens the user's real default browser (Google blocks embedded webviews), receives the auth code
// locally, and hands { code, codeVerifier, redirectUri } to the renderer to exchange on the LMS server.
import crypto from "crypto";
import http from "http";
import { AddressInfo } from "net";
import { IpcMainInvokeEvent, shell } from "electron";

export type GoogleLoginResult = {
  code: string;
  codeVerifier: string;
  redirectUri: string;
};

let activeCancel: ((reason: string) => void) | null = null;

const resultPage = (ok: boolean, title: string, detail: string) => `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LMS Studio · Đăng nhập Google</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05060a;color:#fff;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}
  .card{max-width:420px;padding:32px 28px;border-radius:20px;background:#111218;border:1px solid #2a2c38;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,.7)}
  .dot{width:54px;height:54px;margin:0 auto 14px;border-radius:16px;display:grid;place-items:center;font-size:26px;font-weight:800;
    background:${ok ? "rgba(246,188,23,.16)" : "rgba(251,113,133,.16)"};color:${ok ? "#f6bc17" : "#fb7185"}}
  h2{margin:0 0 6px;font-size:20px;color:${ok ? "#ffd55d" : "#fb7185"}}
  p{margin:0;color:#b9bccb;font-size:14px}
</style></head>
<body><div class="card"><div class="dot">${ok ? "✓" : "!"}</div><h2>${title}</h2><p>${detail}</p></div></body></html>`;

export const startGoogleLogin = (
  _event: IpcMainInvokeEvent,
  payload: { clientId?: string } | undefined,
): Promise<GoogleLoginResult> => {
  const clientId = String(payload?.clientId || "").trim();
  if (!clientId) return Promise.reject(new Error("Máy chủ chưa cấu hình Google Client ID."));

  if (activeCancel) activeCancel("Đã bắt đầu một lượt đăng nhập Google mới.");

  const codeVerifier = crypto.randomBytes(48).toString("base64url");
  const codeChallenge = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const state = crypto.randomBytes(16).toString("base64url");

  return new Promise<GoogleLoginResult>((resolve, reject) => {
    let done = false;
    let redirectUri = "";
    let timer: NodeJS.Timeout | null = null;

    const finish = (err: Error | null, value?: GoogleLoginResult) => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      if (activeCancel === cancel) activeCancel = null;
      setTimeout(() => server.close(), 400).unref();
      if (err) reject(err);
      else resolve(value!);
    };

    const cancel = (reason: string) => finish(new Error(reason));
    activeCancel = cancel;

    const server = http.createServer((req, res) => {
      const u = new URL(req.url || "/", "http://127.0.0.1");
      if (u.pathname !== "/cb" || u.searchParams.get("state") !== state) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      const code = u.searchParams.get("code");
      if (!code) {
        const denied = u.searchParams.get("error") === "access_denied";
        res.end(
          resultPage(
            false,
            denied ? "Đã huỷ đăng nhập" : "Không thể đăng nhập Google",
            denied ? "Bạn có thể đóng tab này và thử lại trong LMS Studio." : "Google trả về lỗi xác thực. Hãy đóng tab này và thử lại.",
          ),
        );
        finish(new Error(denied ? "Đã huỷ đăng nhập Google." : `Google báo lỗi: ${u.searchParams.get("error") || "không rõ"}`));
        return;
      }
      res.end(resultPage(true, "Đã xác nhận tài khoản Google", "Hãy quay lại ứng dụng LMS Studio. Bạn có thể đóng tab này."));
      finish(null, { code, codeVerifier, redirectUri });
    });

    server.on("error", (err) => finish(new Error("Không mở được cổng đăng nhập cục bộ: " + err.message)));

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      redirectUri = `http://127.0.0.1:${addr.port}/cb`;
      const authUrl =
        "https://accounts.google.com/o/oauth2/v2/auth?" +
        new URLSearchParams({
          client_id: clientId,
          redirect_uri: redirectUri,
          response_type: "code",
          scope: "openid email profile",
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          state,
          prompt: "select_account",
        }).toString();

      shell.openExternal(authUrl).catch((err) => finish(new Error("Không mở được trình duyệt: " + err.message)));
    });

    timer = setTimeout(() => finish(new Error("Hết 5 phút chờ chọn tài khoản Google. Hãy bấm thử lại.")), 5 * 60 * 1000);
  });
};

export const cancelGoogleLogin = () => {
  activeCancel?.("Đã huỷ đăng nhập Google.");
  return { ok: true };
};
