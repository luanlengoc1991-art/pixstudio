import { app, BrowserWindow, shell } from "electron";
import { getPlatform } from "./utils/get-device-specs";
import { join } from "path";
import { ELECTRON_COMMANDS } from "../common/electron-commands";
import { fetchLocalStorage } from "./utils/config-variables";
import electronIsDev from "electron-is-dev";
import { format } from "url";
import { autoUpdater } from "electron-updater";

let mainWindow: BrowserWindow | undefined;

const createMainWindow = () => {
  console.log("📂 DIRNAME", __dirname);
  console.log("🚃 App Path: ", app.getAppPath());

  mainWindow = new BrowserWindow({
    title: "PixStudio",
    icon: app.isPackaged
      ? join(process.resourcesPath, "512x512.png")
      : join(app.getAppPath(), "resources", "icons", "512x512.png"),
    width: 1300,
    height: 940,
    minHeight: 500,
    minWidth: 600,
    show: false,
    backgroundColor: "#171717",
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      webSecurity: false,
      // The ChatGPT tab runs as an isolated <webview> guest without Node
      webviewTag: true,
      preload: join(__dirname, "preload.js"),
    },
    titleBarStyle: getPlatform() === "mac" ? "hiddenInset" : "default",
  });

  const url = electronIsDev
    ? "http://localhost:8000"
    : format({
        pathname: join(__dirname, "../../renderer/out/index.html"),
        protocol: "file:",
        slashes: true,
      });

  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow) return;
    mainWindow.show();
  });

  fetchLocalStorage();

  // Auto update stays off until PixStudio has its own release feed;
  // otherwise electron-updater would pull Upscayl releases.
  if (!electronIsDev && process.env.PIXSTUDIO_AUTO_UPDATE === "1") {
    console.log("🚀 Checking for updates");
    autoUpdater.checkForUpdates();
  }

  mainWindow.webContents.send(ELECTRON_COMMANDS.OS, getPlatform());

  mainWindow.setMenuBarVisibility(false);
};

const getMainWindow = () => {
  return mainWindow;
};

export { createMainWindow, getMainWindow };
