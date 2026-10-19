import { getFile } from "./files";

export type Raster = { data: Uint8ClampedArray; width: number; height: number };

/** Decodes an image path with its EXIF rotation applied. */
export const loadBitmap = async (path: string) =>
  createImageBitmap(getFile(path), { imageOrientation: "from-image" } as unknown as ImageBitmapOptions);

export const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
};

export const context2d = (canvas: HTMLCanvasElement) =>
  canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

/** RGBA pixels of a drawable, optionally resized (smooth, high quality). */
export const readPixels = (
  source: CanvasImageSource & { width: number; height: number },
  width = source.width,
  height = source.height,
  background?: string,
): Raster => {
  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.imageSmoothingQuality = "high";
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { data: ctx.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height };
};

export const rasterToCanvas = ({ data, width, height }: Raster) => {
  const canvas = createCanvas(width, height);
  context2d(canvas).putImageData(new ImageData(data, width, height), 0, 0);
  return canvas;
};

/** Resizes a single-channel mask through the canvas scaler. */
export const resizeMask = (mask: Uint8Array | Uint8ClampedArray, w: number, h: number, toW: number, toH: number) => {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < mask.length; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = mask[i];
    rgba[i * 4 + 3] = 255;
  }
  const { data } = readPixels(rasterToCanvas({ data: rgba, width: w, height: h }), toW, toH);
  const out = new Uint8ClampedArray(toW * toH);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4];
  return out;
};

export const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/png", quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Không xuất được ảnh."))), type, quality),
  );

export const hexToRgb = (hex: string) => {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

export const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Lets the page repaint between heavy steps. */
export const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0));
