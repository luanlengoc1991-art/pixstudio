import {
  app,
  clipboard,
  ClipboardItem,
  IpcMainInvokeEvent,
  Menu,
  nativeImage,
  session,
  shell,
  webContents,
} from "electron";
import fs from "fs";
import { extname, join } from "path";
import { ELECTRON_COMMANDS } from "../../common/electron-commands";
import { ChatGptAttachFilesPayload, ChatGptNativePastePayload } from "../../common/types/types";
import { getMainWindow } from "../main-window";
import logit from "../utils/logit";
import { getToolTempDir, uniqueName } from "../utils/tool-files";

// The AI tools drive ChatGPT in a <webview> inside the main window, logged in
// with the user's own account. This file sets up that webview's session:
// a browser-like user agent, sign-in popups, a right-click menu and downloads.
export const CHATGPT_PARTITION = "persist:chatgpt";

// Sign-in pages that may open as popups inside the app
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

const isAuthUrl = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return AUTH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
};

const isChatGptContents = (contents: Electron.WebContents) =>
  contents.session === session.fromPartition(CHATGPT_PARTITION);

/** Call once when the app is ready. */
export const setupChatGpt = () => {
  const ses = session.fromPartition(CHATGPT_PARTITION);
  // Sites like Google refuse to sign in from a browser that says "Electron"
  ses.setUserAgent(ses.getUserAgent().replace(/ (Electron|pixstudio|PixStudio|Luan_MKT_Studio|LMS)\/\S+/g, ""));

  // Images saved by hand in the ChatGPT tab come back to the app
  ses.on("will-download", (_event, item) => {
    let extension = extname(item.getFilename()).toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(extension)) {
      const mime = item.getMimeType();
      extension = mime.includes("jpeg") ? ".jpg" : mime.includes("webp") ? ".webp" : ".png";
    }
    const savePath = join(getToolTempDir("chatgpt"), uniqueName("chatgpt", extension.slice(1)));
    item.setSavePath(savePath);
    item.once("done", (_e, state) => {
      if (state === "completed") {
        getMainWindow()?.webContents.send(ELECTRON_COMMANDS.CHATGPT_DOWNLOADED, savePath);
      }
    });
  });

  app.on("web-contents-created", (_event, contents) => {
    if (!isChatGptContents(contents)) return;

    contents.setWindowOpenHandler(({ url }) => {
      if (isAuthUrl(url)) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            autoHideMenuBar: true,
            webPreferences: { partition: CHATGPT_PARTITION },
          },
        };
      }
      shell.openExternal(url);
      return { action: "deny" };
    });

    contents.on("context-menu", (_e, params) => {
      const items: Electron.MenuItemConstructorOptions[] = [];
      if (params.mediaType === "image" && params.srcURL) {
        items.push(
          { label: "Đưa ảnh này về LMS", click: () => contents.downloadURL(params.srcURL) },
          { type: "separator" },
        );
      }
      if (params.isEditable) {
        items.push(
          { role: "cut", label: "Cắt" },
          { role: "copy", label: "Sao chép" },
          { role: "paste", label: "Dán" },
        );
      } else if (params.selectionText) {
        items.push({ role: "copy", label: "Sao chép" });
      }
      items.push({ role: "reload", label: "Tải lại trang" });
      Menu.buildFromTemplate(items).popup();
    });
  });

  pruneOldResults();
};

/**
 * Attaches real files to ChatGPT the way browser automation does: through the
 * DevTools protocol (DOM.setFileInputFiles) on the page's file input. This
 * produces the same trusted change event as picking files in a dialog.
 */
export const attachFiles = async (
  _event: IpcMainInvokeEvent,
  { webContentsId, paths }: ChatGptAttachFilesPayload,
) => {
  const contents = webContents.fromId(webContentsId);
  if (!contents || !isChatGptContents(contents) || !paths.length) return false;
  const dbg = contents.debugger;
  const attachedHere = !dbg.isAttached();
  try {
    if (attachedHere) dbg.attach("1.3");
    const { root } = await dbg.sendCommand("DOM.getDocument", { depth: 0 });
    const { nodeIds } = await dbg.sendCommand("DOM.querySelectorAll", {
      nodeId: root.nodeId,
      selector: 'input[type="file"]',
    });
    if (!nodeIds?.length) return false;

    // Prefer the input that takes images and several files
    let target = nodeIds[0];
    let multiple = false;
    let best = -1;
    for (const nodeId of nodeIds) {
      const { attributes } = await dbg.sendCommand("DOM.getAttributes", { nodeId });
      const attrs: Record<string, string> = {};
      for (let i = 0; i < attributes.length; i += 2) attrs[attributes[i]] = attributes[i + 1];
      const accept = attrs.accept || "";
      const score = (accept === "" || accept.includes("image") ? 2 : 0) + ("multiple" in attrs ? 1 : 0);
      if (score > best) {
        best = score;
        target = nodeId;
        multiple = "multiple" in attrs;
      }
    }

    if (multiple) {
      await dbg.sendCommand("DOM.setFileInputFiles", { nodeId: target, files: paths });
    } else {
      for (const path of paths) {
        await dbg.sendCommand("DOM.setFileInputFiles", { nodeId: target, files: [path] });
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
    }
    return true;
  } catch (error) {
    logit("❌ ChatGPT attach error: ", error);
    return false;
  } finally {
    if (attachedHere && dbg.isAttached()) dbg.detach();
  }
};

/**
 * Fallback attachment: pastes an image into the focused ChatGPT composer
 * through the system clipboard, then restores the user's clipboard text.
 */
export const nativePasteImage = async (
  _event: IpcMainInvokeEvent,
  { webContentsId, imagePath }: ChatGptNativePastePayload,
) => {
  const contents = webContents.fromId(webContentsId);
  if (!contents || !isChatGptContents(contents)) return false;
  const image = nativeImage.createFromPath(imagePath);
  if (image.isEmpty()) return false;
  const previousText = await clipboard.readText().catch(() => "");
  try {
    // Electron 44 clipboard: async, W3C-style ClipboardItem entries
    await clipboard.write([new ClipboardItem({ "image/png": new Blob([image.toPNG()], { type: "image/png" }) })]);
    contents.focus();
    await contents.executeJavaScript(
      `(() => { const el = document.querySelector("#prompt-textarea"); if (el) el.focus(); return !!el; })()`,
    );
    contents.paste();
    await new Promise((resolve) => setTimeout(resolve, 600));
    return true;
  } catch (error) {
    logit("❌ ChatGPT native paste error: ", error);
    return false;
  } finally {
    await clipboard.writeText(previousText).catch(() => undefined);
  }
};

/** True when a ChatGPT login cookie is saved, without loading the page. */
export const hasChatGptSession = async () => {
  const cookies = await session.fromPartition(CHATGPT_PARTITION).cookies.get({ domain: "chatgpt.com" });
  const now = Date.now() / 1000;
  return cookies.some(
    (c) => c.name.startsWith("__Secure-next-auth.session-token") && (!c.expirationDate || c.expirationDate > now),
  );
};

/** Clears the saved ChatGPT login (cookies, storage and cache). */
export const resetChatGptLogin = async () => {
  const ses = session.fromPartition(CHATGPT_PARTITION);
  await ses.clearStorageData();
  await ses.clearCache();
};

// Keep the download folder from growing forever: drop files older than a week
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
