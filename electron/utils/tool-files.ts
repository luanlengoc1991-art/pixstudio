import { app, dialog, IpcMainInvokeEvent } from "electron";
import { execFile } from "child_process";
import fs from "fs";
import { dirname, extname, join } from "path";
import { promisify } from "util";
import isDev from "electron-is-dev";
import { getPlatform } from "./get-device-specs";
import { getMainWindow } from "../main-window";
import {
  SaveFilePayload,
  SaveTempImagePayload,
} from "../../common/types/types";

export const execFileAsync = promisify(execFile);

/** Path of a helper executable bundled from resources/{os}/bin. */
export const getBinaryPath = (name: string) => {
  const file = process.platform === "win32" ? `${name}.exe` : name;
  const binPath = isDev
    ? join(app.getAppPath(), "resources", getPlatform()!, "bin", file)
    : join(dirname(app.getAppPath()), "bin", file);
  if (!fs.existsSync(binPath)) {
    throw new Error(`Không tìm thấy ${file}. Hãy cài lại ứng dụng.`);
  }
  return binPath;
};

/** Per-session scratch folder for tool inputs and results. */
export const getToolTempDir = (tool: string) => {
  const dir = join(app.getPath("temp"), "pixstudio", tool);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

export const uniqueName = (prefix: string, extension: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "jfif", "webp"];

/** Writes dropped or pasted image bytes to disk so tools can work on a path. */
export const saveTempImage = async (
  _event: IpcMainInvokeEvent,
  { bytes, name }: SaveTempImagePayload,
) => {
  const extension = extname(name).slice(1).toLowerCase();
  const safeExtension = IMAGE_EXTENSIONS.includes(extension)
    ? extension
    : "png";
  const file = join(getToolTempDir("inputs"), uniqueName("input", safeExtension));
  await fs.promises.writeFile(file, Buffer.from(bytes));
  return file;
};

/** Shows a save dialog and writes text, bytes or a copy of an existing file. */
export const saveFileAs = async (
  _event: IpcMainInvokeEvent,
  { defaultName, sourcePath, text, bytes, filters }: SaveFilePayload,
) => {
  const mainWindow = getMainWindow();
  const options = {
    defaultPath: join(app.getPath("pictures"), defaultName),
    filters,
  };
  const { canceled, filePath } = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options);
  if (canceled || !filePath) return null;

  if (sourcePath) await fs.promises.copyFile(sourcePath, filePath);
  else if (text !== undefined) await fs.promises.writeFile(filePath, text, "utf8");
  else if (bytes) await fs.promises.writeFile(filePath, Buffer.from(bytes));
  return filePath;
};
