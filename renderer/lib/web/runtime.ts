// Stand-in for the Electron preload bridge (electron/preload.ts) on the website.
// Each command the renderer sends to the main process is handled here in the
// browser, so the tool screens run unchanged.
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import type {
  DieCutPayload,
  RemoveBackgroundPayload,
  SaveFilePayload,
  SaveFilesToFolderPayload,
  SaveTempImagePayload,
  VectorizePayload,
} from "@common/types/types";
import {
  baseName,
  chooseFiles,
  fileUrl,
  getFile,
  isDiskFolder,
  isImageName,
  listDir,
  mimeFor,
  newDir,
  pickDiskFolder,
  putFile,
  registerDiskFolder,
  saveBlob,
  saveManyFiles,
  supportsFolderAccess,
} from "./files";

type Listener = (event: unknown, data?: any) => void;
const listeners = new Map<string, Set<Listener>>();

const emit = (channel: string, data?: unknown) =>
  listeners.get(channel)?.forEach((listener) => {
    try {
      listener({}, data);
    } catch (error) {
      console.error(error);
    }
  });

const desktopOnly = () => {
  throw new Error("Tính năng này chỉ có trong app LMS trên máy tính.");
};

/** Folders picked on disk stay linked so results are written back into them. */
const selectFolder = async () => {
  if (supportsFolderAccess()) {
    const handle = await pickDiskFolder("readwrite");
    if (!handle) return null;
    const dir = `${newDir()}/${handle.name}`;
    for await (const entry of handle.values()) {
      if (entry.kind === "file" && isImageName(entry.name)) putFile(await entry.getFile(), entry.name, dir);
    }
    // Linked after reading, so only new files are written back to disk
    registerDiskFolder(dir, handle);
    return dir;
  }
  const chosen = await chooseFiles({ directory: true });
  if (!chosen) return null;
  const folderName = (chosen[0] as any).webkitRelativePath?.split("/")[0] || "thu-muc";
  const dir = `${newDir()}/${folderName}`;
  for (const file of chosen) if (isImageName(file.name)) putFile(file, file.name, dir);
  return dir;
};

const blobFromSave = (payload: SaveFilePayload) => {
  const type = mimeFor(payload.defaultName);
  if (payload.sourcePath) return getFile(payload.sourcePath);
  if (payload.text !== undefined) return new Blob([payload.text], { type });
  if (payload.bytes) return new Blob([payload.bytes as ArrayBuffer], { type });
  throw new Error("Không có dữ liệu để lưu.");
};

const base64ToBlob = (base64: string, type: string) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
};

const upscaleChannels = {
  single: { progress: ELECTRON_COMMANDS.UPSCAYL_PROGRESS, done: ELECTRON_COMMANDS.UPSCAYL_DONE, error: ELECTRON_COMMANDS.UPSCAYL_ERROR },
  double: { progress: ELECTRON_COMMANDS.DOUBLE_UPSCAYL_PROGRESS, done: ELECTRON_COMMANDS.DOUBLE_UPSCAYL_DONE, error: ELECTRON_COMMANDS.UPSCAYL_ERROR },
  folder: { progress: ELECTRON_COMMANDS.FOLDER_UPSCAYL_PROGRESS, done: ELECTRON_COMMANDS.FOLDER_UPSCAYL_DONE, error: ELECTRON_COMMANDS.UPSCAYL_ERROR },
};

const progressTo = (channel: string) => (message: string) => emit(channel, message);

const invokeHandlers: Record<string, (payload: any) => Promise<unknown> | unknown> = {
  [ELECTRON_COMMANDS.SELECT_FILE]: async () => {
    const chosen = await chooseFiles();
    return chosen ? putFile(chosen[0], chosen[0].name) : null;
  },
  [ELECTRON_COMMANDS.SELECT_FOLDER]: selectFolder,
  [ELECTRON_COMMANDS.SAVE_TEMP_IMAGE]: ({ bytes, name }: SaveTempImagePayload) =>
    putFile(new Blob([bytes], { type: mimeFor(name) }), name),
  [ELECTRON_COMMANDS.SAVE_FILE_AS]: (payload: SaveFilePayload) =>
    saveBlob(blobFromSave(payload), payload.defaultName, payload.filters),
  [ELECTRON_COMMANDS.SAVE_FILES_TO_FOLDER]: async ({ files, folderName }: SaveFilesToFolderPayload) => ({
    count: await saveManyFiles(files.map((file) => ({ blob: getFile(file.sourcePath), name: file.name })), folderName),
  }),
  [ELECTRON_COMMANDS.REMOVE_BACKGROUND]: async (payload: RemoveBackgroundPayload) =>
    (await import("./remove-background")).removeBackground(payload, progressTo(ELECTRON_COMMANDS.REMOVE_BACKGROUND_PROGRESS)),
  [ELECTRON_COMMANDS.VECTORIZE_IMAGE]: async (payload: VectorizePayload) =>
    (await import("./vectorize")).vectorizeImage(payload),
  [ELECTRON_COMMANDS.EXPORT_VECTOR_PDF]: async ({ svg }: { svg: string }) =>
    (await import("./vectorize")).exportSvgToPdf(svg),
  [ELECTRON_COMMANDS.DIE_CUT]: async (payload: DieCutPayload) =>
    (await import("./die-cut")).dieCut(payload, progressTo(ELECTRON_COMMANDS.REMOVE_BACKGROUND_PROGRESS)),
  [ELECTRON_COMMANDS.GET_SYSTEM_STATS]: () => null,
  [ELECTRON_COMMANDS.CHATGPT_SESSION_STATUS]: () => false,
};

const sendHandlers: Record<string, (payload: any) => void> = {
  [ELECTRON_COMMANDS.UPSCAYL]: (payload) =>
    import("./upscale").then((m) => m.imageUpscayl(payload, emit, upscaleChannels.single)),
  [ELECTRON_COMMANDS.DOUBLE_UPSCAYL]: (payload) =>
    import("./upscale").then((m) => m.imageUpscayl(payload, emit, upscaleChannels.double, 2)),
  [ELECTRON_COMMANDS.FOLDER_UPSCAYL]: (payload) =>
    import("./upscale").then((m) => m.folderUpscayl(payload, emit, upscaleChannels.folder)),
  [ELECTRON_COMMANDS.STOP]: () => import("./upscale").then((m) => m.stopUpscale()),
  [ELECTRON_COMMANDS.OPEN_FOLDER]: async (dir: string) => {
    if (isDiskFolder(dir)) {
      window.alert(`Ảnh đã kích nét được lưu ngay trong thư mục "${baseName(dir)}" trên máy của bạn.`);
      return;
    }
    const results = listDir(dir).filter((path) => baseName(path).includes("_upscayl_"));
    await saveManyFiles(results.map((path) => ({ blob: getFile(path), name: baseName(path) })), `${baseName(dir)}_upscayl`);
  },
  [ELECTRON_COMMANDS.PASTE_IMAGE]: (file: { name: string; extension: string; encodedBuffer: string }) => {
    try {
      const name = file.name.replace(/^\.temp-/, "");
      emit(ELECTRON_COMMANDS.PASTE_IMAGE_SAVE_SUCCESS, putFile(base64ToBlob(file.encodedBuffer, mimeFor(name)), name));
    } catch (error) {
      emit(ELECTRON_COMMANDS.PASTE_IMAGE_SAVE_ERROR, String(error));
    }
  },
  [ELECTRON_COMMANDS.GET_MODELS_LIST]: () => emit(ELECTRON_COMMANDS.CUSTOM_MODEL_FILES_LIST, []),
};

export const installWebRuntime = () => {
  if (typeof window === "undefined" || (window as any).electron) return;

  (window as any).electron = {
    isWeb: true,
    platform: "web",
    on: (channel: string, listener: Listener) => {
      if (!listeners.has(channel)) listeners.set(channel, new Set());
      listeners.get(channel)!.add(listener);
    },
    off: (channel: string, listener: Listener) => listeners.get(channel)?.delete(listener),
    send: (channel: string, payload?: unknown) => {
      const handler = sendHandlers[channel];
      if (handler) Promise.resolve(handler(payload)).catch((error) => emit(ELECTRON_COMMANDS.UPSCAYL_ERROR, String(error?.message ?? error)));
    },
    invoke: async (channel: string, payload?: unknown) => {
      const handler = invokeHandlers[channel];
      if (!handler) desktopOnly();
      return handler(payload);
    },
    fileUrl,
    getSystemInfo: async () => ({
      platform: "web",
      release: navigator.userAgent,
      arch: undefined,
      model: "",
      cpuCount: navigator.hardwareConcurrency || 0,
      gpu: {},
    }),
    getAppVersion: async () => "Web",
  };

  // Electron gives dropped files a disk path; on the web the path names an in-memory copy
  const paths = new WeakMap<File, string>();
  Object.defineProperty(File.prototype, "path", {
    configurable: true,
    get(this: File) {
      let path = paths.get(this);
      if (!path) {
        path = putFile(this, this.name || "anh.png");
        paths.set(this, path);
      }
      return path;
    },
  });
};
