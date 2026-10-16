import { fileUrl } from "@/components/tools/common";

/** Reads an image file on disk as a data URL (the renderer may load file://). */
export const pathToDataUrl = async (path: string) => {
  const blob = await (await fetch(fileUrl(path))).blob();
  return blobToDataUrl(blob);
};

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const dataUrlToBytes = async (dataUrl: string) => (await fetch(dataUrl)).arrayBuffer();

export const mimeExtension = (dataUrl: string) => {
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"));
  return mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
};

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 10000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });

export const imageSize = async (src: string) => {
  const img = await loadImage(src);
  return img ? { width: img.naturalWidth, height: img.naturalHeight } : null;
};

const thumbnail = async (src: string) => {
  const img = await loadImage(src);
  if (!img) return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 32, 32);
  return ctx.getImageData(0, 0, 32, 32).data;
};

/** True when two images look the same at 32x32 (mean channel difference below threshold). */
export const looksAlike = async (a: string, b: string, threshold = 3) => {
  const [x, y] = await Promise.all([thumbnail(a), thumbnail(b)]);
  if (!x || !y) return false;
  let diff = 0;
  let counted = 0;
  for (let i = 0; i < x.length; i += 4) {
    if (x[i + 3] < 10 && y[i + 3] < 10) continue;
    counted += 1;
    diff += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]) + Math.abs(x[i + 3] - y[i + 3]);
  }
  return counted > 0 && diff / (4 * counted) < threshold;
};
