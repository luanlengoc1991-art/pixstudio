import {
  app,
  BrowserWindow,
  clipboard,
  IpcMainInvokeEvent,
  Menu,
  nativeImage,
  session,
  shell,
} from "electron";
import fs from "fs";
import { extname, join } from "path";
import { ELECTRON_COMMANDS } from "../../common/electron-commands";
import {
  ChatGptOpenPayload,
  ChatGptResult,
  ChatGptStatus,
} from "../../common/types/types";
import { getMainWindow } from "../main-window";
import logit from "../utils/logit";
import { getToolTempDir, uniqueName } from "../utils/tool-files";

// Phase 2 tools run through the user's own ChatGPT account in a separate
// window. The login is kept in a persistent partition so it survives restarts.
const CHATGPT_URL = "https://chatgpt.com/";
const PARTITION = "persist:chatgpt";
const COMPOSER = "#prompt-textarea";

// Sign-in pages that must stay inside the window (OAuth popups included)
const AUTH_HOSTS = [
  "chatgpt.com",
  "openai.com",
  "auth0.com",
  "accounts.google.com",
  "login.live.com",
  "login.microsoftonline.com",
  "appleid.apple.com",
];

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

let chatWindow: BrowserWindow | undefined;
/** The tool whose request was pasted last receives the downloads */
let currentToolId = "";
let downloadsHooked = false;

const isAuthUrl = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return AUTH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

const sendStatus = (state: ChatGptStatus["state"], message: string) => {
  const status: ChatGptStatus = { toolId: currentToolId, state, message };
  getMainWindow()?.webContents.send(ELECTRON_COMMANDS.CHATGPT_STATUS, status);
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const chatSession = () => {
  const ses = session.fromPartition(PARTITION);
  if (!downloadsHooked) {
    downloadsHooked = true;
    // Sites like Google refuse to sign in from a browser that says "Electron"
    ses.setUserAgent(
      ses.getUserAgent().replace(/ (Electron|pixstudio|PixStudio)\/\S+/g, ""),
    );
    ses.on("will-download", (_event, item) => {
      const toolId = currentToolId;
      let extension = extname(item.getFilename()).toLowerCase();
      if (!IMAGE_EXTENSIONS.includes(extension)) {
        const mime = item.getMimeType();
        extension = mime.includes("jpeg") ? ".jpg" : mime.includes("webp") ? ".webp" : ".png";
      }
      const savePath = join(
        getToolTempDir("chatgpt"),
        uniqueName(toolId || "chatgpt", extension.slice(1)),
      );
      item.setSavePath(savePath);
      item.once("done", (_e, state) => {
        if (state !== "completed") {
          sendStatus("error", "Tải ảnh từ ChatGPT không thành công, hãy thử lại.");
          return;
        }
        const result: ChatGptResult = { toolId, path: savePath };
        getMainWindow()?.webContents.send(ELECTRON_COMMANDS.CHATGPT_RESULT, result);
        sendStatus("ready", "Đã nhận ảnh kết quả về PixStudio.");
      });
    });
  }
  return ses;
};

const createChatWindow = () => {
  const win = new BrowserWindow({
    title: "ChatGPT · PixStudio",
    width: 1100,
    height: 900,
    minWidth: 600,
    minHeight: 500,
    autoHideMenuBar: true,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  chatSession();

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: {
          autoHideMenuBar: true,
          webPreferences: { partition: PARTITION },
        },
      };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Right-clicking a generated image offers to bring it back to PixStudio
  win.webContents.on("context-menu", (_event, params) => {
    const items: Electron.MenuItemConstructorOptions[] = [];
    if (params.mediaType === "image" && params.srcURL) {
      items.push({
        label: "Đưa ảnh này về PixStudio",
        click: () => win.webContents.downloadURL(params.srcURL),
      });
      items.push({ type: "separator" });
    }
    if (params.isEditable) {
      items.push({ role: "cut", label: "Cắt" }, { role: "copy", label: "Sao chép" }, { role: "paste", label: "Dán" });
    } else if (params.selectionText) {
      items.push({ role: "copy", label: "Sao chép" });
    }
    items.push({ role: "reload", label: "Tải lại trang" });
    Menu.buildFromTemplate(items).popup({ window: win });
  });

  win.on("closed", () => {
    chatWindow = undefined;
  });
  return win;
};

const loadNewChat = (win: BrowserWindow) =>
  new Promise<void>((resolve) => {
    win.webContents.once("did-finish-load", () => resolve());
    win.loadURL(CHATGPT_URL).catch(() => resolve());
  });

/** Polls the page until the chat box exists; returns false on timeout. */
const waitForComposer = async (win: BrowserWindow, timeoutMs: number) => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (win.isDestroyed()) return false;
    const found = await win.webContents
      .executeJavaScript(`!!document.querySelector(${JSON.stringify(COMPOSER)})`)
      .catch(() => false);
    if (found) return true;
    await wait(500);
  }
  return false;
};

const isLoggedOut = (win: BrowserWindow) =>
  win.webContents
    .executeJavaScript(
      `!!document.querySelector('[data-testid="login-button"], [data-testid="signup-button"]')`,
    )
    .catch(() => false);

const focusComposer = (win: BrowserWindow) =>
  win.webContents.executeJavaScript(
    `(() => { const el = document.querySelector(${JSON.stringify(COMPOSER)}); if (el) el.focus(); return !!el; })()`,
  );

/**
 * Opens (or reuses) the ChatGPT window, starts a new chat and pastes the
 * images and the prompt into the chat box. The user reviews and presses Send.
 */
const openChatGpt = async (
  _event: IpcMainInvokeEvent,
  { toolId, imagePaths, prompt }: ChatGptOpenPayload,
) => {
  currentToolId = toolId;
  if (!chatWindow || chatWindow.isDestroyed()) chatWindow = createChatWindow();
  const win = chatWindow;
  win.show();
  win.focus();

  sendStatus("loading", "Đang mở ChatGPT...");
  await loadNewChat(win);
  if (!(await waitForComposer(win, 45000))) {
    sendStatus(
      "login",
      "Chưa thấy ô chat. Hãy đăng nhập ChatGPT trong cửa sổ vừa mở, rồi bấm \"Dán lại vào ChatGPT\".",
    );
    return false;
  }
  if (await isLoggedOut(win)) {
    sendStatus(
      "login",
      "Bạn chưa đăng nhập ChatGPT. Đăng nhập một lần trong cửa sổ vừa mở, rồi bấm \"Dán lại vào ChatGPT\".",
    );
    return false;
  }

  sendStatus("pasting", "Đang dán ảnh và yêu cầu vào ChatGPT...");
  // Pasting goes through the clipboard; put the user's text back afterwards
  const previousText = clipboard.readText();
  try {
    for (const imagePath of imagePaths) {
      const image = nativeImage.createFromPath(imagePath);
      if (image.isEmpty()) throw new Error(`Không đọc được ảnh: ${imagePath}`);
      clipboard.writeImage(image);
      await focusComposer(win);
      win.webContents.paste();
      // Give ChatGPT time to start the upload before the next paste
      await wait(1500);
    }
    await focusComposer(win);
    await win.webContents.insertText(prompt);
  } catch (error) {
    logit("❌ ChatGPT paste error: ", error);
    sendStatus("error", error instanceof Error ? error.message : String(error));
    return false;
  } finally {
    clipboard.writeText(previousText);
  }

  sendStatus(
    "ready",
    "Đã dán xong. Kiểm tra lại trong ChatGPT rồi bấm Gửi. Khi có ảnh, bấm nút tải xuống hoặc chuột phải vào ảnh → \"Đưa ảnh này về PixStudio\".",
  );
  return true;
};

/** Clears the saved ChatGPT login (cookies and storage). */
export const resetChatGptLogin = async () => {
  await session.fromPartition(PARTITION).clearStorageData();
  chatWindow?.close();
};

app.on("before-quit", () => {
  if (chatWindow && !chatWindow.isDestroyed()) chatWindow.destroy();
});

// Keep the scratch folder from growing forever: drop files older than a week
const pruneOldResults = () => {
  try {
    const dir = getToolTempDir("chatgpt");
    const cutoff = Date.now() - 7 * 24 * 3600 * 1000;
    for (const name of fs.readdirSync(dir)) {
      const file = join(dir, name);
      if (fs.statSync(file).mtimeMs < cutoff) fs.rmSync(file, { force: true });
    }
  } catch {}
};
app.whenReady().then(pruneOldResults);

export default openChatGpt;
