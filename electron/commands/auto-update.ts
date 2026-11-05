import { BrowserWindow } from "electron";
import { UpdateDownloadedEvent, autoUpdater } from "electron-updater";
import logit from "../utils/logit";
import { childProcesses } from "../utils/config-variables";

// Tự cập nhật không hỏi: tải xong bản mới thì đợi app rảnh (không có ảnh đang xử lý)
// hai lần kiểm tra liền nhau, báo trước 10 giây rồi tự khởi động lại vào bản mới.
// Đang có việc thì đợi xong mới cài. Đóng app trước thì cài khi đóng.
const EVERY_MS = 30 * 1000;
const WARN_MS = 10 * 1000;

const busy = () => childProcesses.some((c) => c.process.exitCode === null && !c.process.killed);

let timer: NodeJS.Timeout | null = null;
let installing = false;

const notify = (text: string) => {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents
      .executeJavaScript(
        `(() => { const d = document.createElement('div'); d.textContent = ${JSON.stringify(text)}; Object.assign(d.style, { position: 'fixed', right: '18px', bottom: '18px', zIndex: 99999, background: '#1c1e21', color: '#f4f4f4', padding: '10px 14px', borderRadius: '10px', border: '1px solid #383e46', font: '13px system-ui' }); document.body.append(d); setTimeout(() => d.remove(), 10000); })()`,
      )
      .catch(() => {});
  }
};

const autoUpdate = (event: UpdateDownloadedEvent) => {
  autoUpdater.autoInstallOnAppQuit = true;
  logit("✅ Update Downloaded", event.version);
  if (timer || installing) return;
  let idle = 0;
  const tick = () => {
    timer = null;
    if (busy()) { idle = 0; timer = setTimeout(tick, EVERY_MS); return; }
    if (++idle < 2) { timer = setTimeout(tick, EVERY_MS); return; }
    notify(`Đang cập nhật LMS lên bản ${event.version}: app khởi động lại sau 10 giây.`);
    timer = setTimeout(() => {
      timer = null;
      if (busy()) { idle = 0; timer = setTimeout(tick, EVERY_MS); return; }
      installing = true;
      autoUpdater.quitAndInstall(true, true);
    }, WARN_MS);
  };
  timer = setTimeout(tick, EVERY_MS);
};

export default autoUpdate;
