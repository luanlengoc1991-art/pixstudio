import prepareNext from "electron-next";
import { autoUpdater } from "electron-updater";
import log from "electron-log";
import { app, ipcMain, protocol } from "electron";
import { ELECTRON_COMMANDS } from "../common/electron-commands";
import logit from "./utils/logit";
import openFolder from "./commands/open-folder";
import stop from "./commands/stop";
import selectFolder from "./commands/select-folder";
import selectFile from "./commands/select-file";
import getModelsList from "./commands/get-models-list";
import customModelsSelect from "./commands/custom-models-select";
import imageUpscayl from "./commands/image-upscayl";
import { createMainWindow } from "./main-window";
import electronIsDev from "electron-is-dev";
import { execPath, modelsPath } from "./utils/get-resource-paths";
import batchUpscayl from "./commands/batch-upscayl";
import doubleUpscayl from "./commands/double-upscayl";
import autoUpdate from "./commands/auto-update";
import { FEATURE_FLAGS } from "../common/feature-flags";
import settings from "electron-settings";
import pasteImage from "./commands/paste-image";
import removeBackground from "./commands/remove-background";
import { exportSvgToPdf, vectorizeImage } from "./commands/vectorize";
import dieCut from "./commands/die-cut";
import {
  attachFiles,
  hasChatGptSession,
  nativePasteImage,
  resetChatGptLogin,
  setupChatGpt,
} from "./commands/chatgpt-bridge";
import { saveFileAs, saveFilesToFolder, saveTempImage } from "./utils/tool-files";
import path from "path";
import fs from "fs";
import { getSystemStats } from "./utils/system-stats";

// INITIALIZATION
// The app was renamed from PixStudio: keep using its data folder so settings
// and the saved ChatGPT login carry over
app.setPath("userData", path.join(app.getPath("appData"), "PixStudio"));
log.initialize({ preload: true });

app.on("ready", async () => {
  await prepareNext("./renderer");

  app.whenReady().then(() => {
    protocol.registerFileProtocol("file", (request, callback) => {
      const pathname = decodeURI(request.url.replace("file:///", ""));
      callback(pathname);
    });
    protocol.registerFileProtocol("public", (request, callback) => {
      const filePath = decodeURI(request.url.replace("public:///", ""));
      // Dev runs read renderer/public; packaged builds only have renderer/out
      const fromPublic = path.join(app.getAppPath(), "renderer", "public", filePath);
      const fromOut = path.join(app.getAppPath(), "renderer", "out", filePath);
      callback(fs.existsSync(fromPublic) ? fromPublic : fromOut);
    });
    logit("🚃 App Path: ", app.getAppPath());
  });

  setupChatGpt();
  createMainWindow();

  log.info(
    "🆙 Upscayl version:",
    app.getVersion(),
    FEATURE_FLAGS.APP_STORE_BUILD ? "MAC-APP-STORE" : "FOSS",
  );
  log.info("🚀 UPSCAYL EXEC PATH: ", execPath);
  log.info("🚀 MODELS PATH: ", modelsPath);

  let closeAccess;
  const folderBookmarks = await settings.get("folder-bookmarks");
  if (FEATURE_FLAGS.APP_STORE_BUILD && folderBookmarks) {
    logit("🚨 Folder Bookmarks: ", folderBookmarks);
    try {
      closeAccess = app.startAccessingSecurityScopedResource(
        folderBookmarks as string,
      );
    } catch (error) {
      logit("📁 Folder Bookmarks Error: ", error);
    }
  }
});

// Quit the app once all windows are closed
app.on("window-all-closed", () => {
  app.quit();
});

// ! ENABLE THIS FOR MACOS APP STORE BUILD
if (FEATURE_FLAGS.APP_STORE_BUILD) {
  logit("🚀 APP STORE BUILD ENABLED");
  app.commandLine.appendSwitch("in-process-gpu");
}

ipcMain.on(ELECTRON_COMMANDS.STOP, stop);

ipcMain.on(ELECTRON_COMMANDS.OPEN_FOLDER, openFolder);

ipcMain.handle(ELECTRON_COMMANDS.SELECT_FOLDER, selectFolder);

ipcMain.handle(ELECTRON_COMMANDS.SELECT_FILE, selectFile);

ipcMain.on(ELECTRON_COMMANDS.GET_MODELS_LIST, getModelsList);

ipcMain.handle(
  ELECTRON_COMMANDS.SELECT_CUSTOM_MODEL_FOLDER,
  customModelsSelect,
);

ipcMain.on(ELECTRON_COMMANDS.UPSCAYL, imageUpscayl);

ipcMain.on(ELECTRON_COMMANDS.FOLDER_UPSCAYL, batchUpscayl);

ipcMain.on(ELECTRON_COMMANDS.DOUBLE_UPSCAYL, doubleUpscayl);

ipcMain.on(ELECTRON_COMMANDS.PASTE_IMAGE, pasteImage);

ipcMain.handle(ELECTRON_COMMANDS.REMOVE_BACKGROUND, removeBackground);

ipcMain.handle(ELECTRON_COMMANDS.SAVE_TEMP_IMAGE, saveTempImage);

ipcMain.handle(ELECTRON_COMMANDS.SAVE_FILE_AS, saveFileAs);

ipcMain.handle(ELECTRON_COMMANDS.SAVE_FILES_TO_FOLDER, saveFilesToFolder);

ipcMain.handle(ELECTRON_COMMANDS.VECTORIZE_IMAGE, vectorizeImage);

ipcMain.handle(ELECTRON_COMMANDS.EXPORT_VECTOR_PDF, exportSvgToPdf);

ipcMain.handle(ELECTRON_COMMANDS.DIE_CUT, dieCut);

ipcMain.handle(ELECTRON_COMMANDS.CHATGPT_NATIVE_PASTE, nativePasteImage);

ipcMain.handle(ELECTRON_COMMANDS.CHATGPT_ATTACH_FILES, attachFiles);

ipcMain.handle(ELECTRON_COMMANDS.CHATGPT_LOGOUT, resetChatGptLogin);

ipcMain.handle(ELECTRON_COMMANDS.CHATGPT_SESSION_STATUS, hasChatGptSession);

ipcMain.handle(ELECTRON_COMMANDS.GET_SYSTEM_STATS, getSystemStats);

ipcMain.handle("get-gpu-info", async () => {
  try {
    return await app.getGPUInfo("complete");
  } catch (error) {
    console.error("Failed to get GPU info:", error);
    return null;
  }
});

ipcMain.handle("get-app-version", () => {
  return `${app.getVersion()} ${
    FEATURE_FLAGS.APP_STORE_BUILD ? "MAC-APP-STORE" : "FOSS"
  }`;
});

if (!FEATURE_FLAGS.APP_STORE_BUILD) {
  autoUpdater.on("update-downloaded", autoUpdate);
}
