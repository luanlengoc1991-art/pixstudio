// In-memory files for the website. Tools pass file paths around exactly as in
// the desktop app; on the web a path such as "/web/k3x9/anh.png" names a Blob
// kept here, and folders picked with the File System Access API are mirrored
// to disk.

const files = new Map<string, Blob>();
const objectUrls = new Map<string, string>();
/** Folders the user picked on disk (Chrome/Edge), keyed by virtual directory */
const diskFolders = new Map<string, any>();

let counter = 0;
export const newDir = () => `/web/${Date.now().toString(36)}${(counter++).toString(36)}`;

export const dirOf = (path: string) => path.slice(0, path.lastIndexOf("/"));
export const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);
export const stem = (path: string) => baseName(path).replace(/\.[^.]+$/, "") || "anh";

/** Keeps the name readable but safe inside a path. */
const cleanName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "anh.png";

export const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  jfif: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  txt: "text/plain",
};
export const mimeFor = (name: string) => MIME[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";

/** Stores a file and returns its path; also writes it to disk when the folder is a picked one. */
export const putFile = (blob: Blob, name: string, dir = newDir()) => {
  let path = `${dir}/${cleanName(name)}`;
  if (files.has(path)) {
    const dot = path.lastIndexOf(".");
    path = `${path.slice(0, dot)}-${(counter++).toString(36)}${path.slice(dot)}`;
  }
  files.set(path, blob);
  const folder = diskFolders.get(dir);
  if (folder) writeToFolder(folder, baseName(path), blob).catch(() => undefined);
  return path;
};

export const getFile = (path: string) => {
  const blob = files.get(path) ?? files.get(decodePath(path));
  if (!blob) throw new Error("Không tìm thấy tệp ảnh, vui lòng chọn lại ảnh.");
  return blob;
};

export const hasFile = (path: string) => files.has(path) || files.has(decodePath(path));

export const listDir = (dir: string) => Array.from(files.keys()).filter((path) => dirOf(path) === dir);

const decodePath = (path: string) => path.split("/").map((part) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}).join("/");

/** Object URL for an image path (paths may arrive URI-encoded segment by segment). */
export const fileUrl = (path: string) => {
  const key = files.has(path) ? path : decodePath(path);
  let url = objectUrls.get(key);
  if (!url) {
    const blob = files.get(key);
    if (!blob) return "";
    url = URL.createObjectURL(blob);
    objectUrls.set(key, url);
  }
  return url;
};

export const registerDiskFolder = (dir: string, handle: any) => diskFolders.set(dir, handle);
export const isDiskFolder = (dir: string) => diskFolders.has(dir);

const writeToFolder = async (folder: any, name: string, blob: Blob) => {
  const handle = await folder.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  await writable.write(blob);
  await writable.close();
};

export const supportsFolderAccess = () => typeof (window as any).showDirectoryPicker === "function";

/** Asks for a folder on disk (Chrome/Edge). Null when cancelled or unsupported. */
export const pickDiskFolder = async (mode: "read" | "readwrite") => {
  if (!supportsFolderAccess()) return null;
  try {
    return await (window as any).showDirectoryPicker({ mode });
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Downloads

const triggerDownload = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** Save dialog where the browser has one, otherwise a normal download. Returns the saved name or null. */
export const saveBlob = async (
  blob: Blob,
  name: string,
  filters?: { name: string; extensions: string[] }[],
) => {
  const picker = (window as any).showSaveFilePicker;
  if (typeof picker === "function") {
    try {
      const types = filters?.map((filter) => ({
        description: filter.name,
        accept: { [mimeFor(`x.${filter.extensions[0]}`)]: filter.extensions.map((ext) => `.${ext}`) },
      }));
      const handle = await picker({ suggestedName: name, types });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return handle.name as string;
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return null;
      // Some types are rejected by the picker; fall back to a download
    }
  }
  triggerDownload(blob, name);
  return name;
};

/** Writes several files into a folder the user picks, or downloads them as one ZIP. Returns the count. */
export const saveManyFiles = async (items: { blob: Blob; name: string }[], folderName = "LMS") => {
  if (!items.length) return 0;
  const folder = await pickDiskFolder("readwrite");
  if (folder) {
    const target = await folder.getDirectoryHandle(cleanName(folderName), { create: true });
    for (const item of items) await writeToFolder(target, cleanName(item.name), item.blob);
    return items.length;
  }
  if (supportsFolderAccess()) return 0; // cancelled
  const { zipSync } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const item of items) entries[`${cleanName(folderName)}/${cleanName(item.name)}`] = new Uint8Array(await item.blob.arrayBuffer());
  triggerDownload(new Blob([zipSync(entries, { level: 0 })], { type: "application/zip" }), `${cleanName(folderName)}.zip`);
  return items.length;
};

// ---------------------------------------------------------------------------
// Pickers

const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,.jfif";

/** Opens the browser file chooser; resolves null when cancelled. */
export const chooseFiles = (options: { multiple?: boolean; directory?: boolean } = {}) =>
  new Promise<File[] | null>((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = IMAGE_ACCEPT;
    input.multiple = !!options.multiple;
    if (options.directory) (input as any).webkitdirectory = true;
    input.style.display = "none";
    let done = false;
    const finish = (value: File[] | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(value);
    };
    input.addEventListener("change", () => finish(input.files?.length ? Array.from(input.files) : null));
    input.addEventListener("cancel", () => finish(null));
    document.body.appendChild(input);
    input.click();
  });

export const isImageName = (name: string) => /\.(png|jpe?g|jfif|webp)$/i.test(name);
