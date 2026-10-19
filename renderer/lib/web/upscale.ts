import { BatchUpscaylPayload, ImageUpscaylPayload } from "@common/types/types";
import { isImageName, listDir, putFile, stem } from "./files";
import { canvasToBlob, context2d, createCanvas, loadBitmap, nextFrame, rasterToCanvas, readPixels, Raster } from "./images";
import { loadModel, loadOrt } from "./onnx";

// Real-ESRGAN in ONNX (BSD-3). The desktop app's other models are ncnn-only.
export const WEB_UPSCALE_MODELS: Record<string, string> = {
  "upscayl-standard-4x": "realesrgan-x4plus.onnx",
  "upscayl-lite-4x": "realesr-general-x4v3.onnx",
};
export const DEFAULT_WEB_MODEL = "upscayl-standard-4x";
const MODEL_SCALE = 4;
// Context around each tile hides seams between tiles
const TILE_PAD = 12;

let stopRequested = false;
export const stopUpscale = () => {
  stopRequested = true;
};

class Stopped extends Error {}

type Reporter = (progress: string) => void;

/** Runs the model over the image in tiles; returns RGBA at 4x. */
const upscaleRaster = async (raster: Raster, model: string, tileSize: number, report: Reporter) => {
  const [ort, session] = await Promise.all([
    loadOrt(),
    loadModel(WEB_UPSCALE_MODELS[model] ?? WEB_UPSCALE_MODELS[DEFAULT_WEB_MODEL], report),
  ]);
  const { data, width, height } = raster;
  const outW = width * MODEL_SCALE;
  const outH = height * MODEL_SCALE;
  const out = new Uint8ClampedArray(outW * outH * 4);
  const tile = Math.max(64, Math.min(512, tileSize || 256));
  const cols = Math.ceil(width / tile);
  const rows = Math.ceil(height / tile);
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { hasAlpha = true; break; }

  report("0.00%");
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (stopRequested) throw new Stopped();
      const x0 = col * tile;
      const y0 = row * tile;
      const x1 = Math.min(width, x0 + tile);
      const y1 = Math.min(height, y0 + tile);
      const px0 = Math.max(0, x0 - TILE_PAD);
      const py0 = Math.max(0, y0 - TILE_PAD);
      const px1 = Math.min(width, x1 + TILE_PAD);
      const py1 = Math.min(height, y1 + TILE_PAD);
      const tw = px1 - px0;
      const th = py1 - py0;
      const area = tw * th;
      const input = new Float32Array(3 * area);
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const s = ((py0 + y) * width + px0 + x) * 4;
          const p = y * tw + x;
          input[p] = data[s] / 255;
          input[area + p] = data[s + 1] / 255;
          input[2 * area + p] = data[s + 2] / 255;
        }
      }
      const tensor = await session.run(new ort.Tensor("float32", input, [1, 3, th, tw]));
      const pixels = (await tensor.getData()) as Float32Array;
      const ow = tw * MODEL_SCALE;
      const oarea = ow * th * MODEL_SCALE;
      // Copy only the tile's own area, without the context padding
      const cx0 = (x0 - px0) * MODEL_SCALE;
      const cy0 = (y0 - py0) * MODEL_SCALE;
      const cw = (x1 - x0) * MODEL_SCALE;
      const ch = (y1 - y0) * MODEL_SCALE;
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          const p = (cy0 + y) * ow + cx0 + x;
          const d = ((y0 * MODEL_SCALE + y) * outW + x0 * MODEL_SCALE + x) * 4;
          out[d] = pixels[p] * 255;
          out[d + 1] = pixels[oarea + p] * 255;
          out[d + 2] = pixels[2 * oarea + p] * 255;
          out[d + 3] = 255;
        }
      }
      tensor.dispose?.();
      report(`${(((row * cols + col + 1) / (rows * cols)) * 100).toFixed(2)}%`);
      await nextFrame();
    }
  }

  if (hasAlpha) {
    // The model works on RGB; scale the transparency smoothly
    const alphaCanvas = rasterToCanvas(raster);
    const { data: scaled } = readPixels(alphaCanvas, outW, outH);
    for (let i = 3; i < out.length; i += 4) out[i] = scaled[i];
  }
  return { data: out, width: outW, height: outH };
};

const MIME_BY_FORMAT: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

/** Final size, format and quality like the desktop upscayl-bin options. */
const encode = async (canvas: HTMLCanvasElement, sourceW: number, payload: { scale: string; useCustomWidth: boolean; customWidth: string; saveImageAs: string; compression: string }) => {
  const targetW = payload.useCustomWidth && Number(payload.customWidth) > 0 ? Number(payload.customWidth) : sourceW * (Number(payload.scale) || MODEL_SCALE);
  let output = canvas;
  if (Math.round(targetW) !== canvas.width) {
    const targetH = Math.round((canvas.height * targetW) / canvas.width);
    output = createCanvas(targetW, targetH);
    const ctx = context2d(output);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(canvas, 0, 0, output.width, output.height);
  }
  const format = payload.saveImageAs in MIME_BY_FORMAT ? payload.saveImageAs : "png";
  const mime = MIME_BY_FORMAT[format];
  // compression 0 = best quality, 100 = smallest file
  const quality = mime === "image/png" ? undefined : Math.max(0.05, 1 - Number(payload.compression || 0) / 100);
  if (mime === "image/jpeg") {
    const flat = createCanvas(output.width, output.height);
    const ctx = context2d(flat);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, flat.width, flat.height);
    ctx.drawImage(output, 0, 0);
    output = flat;
  }
  return { blob: await canvasToBlob(output, mime, quality), format };
};

const outName = (imagePath: string, payload: ImageUpscaylPayload | BatchUpscaylPayload, format: string) =>
  `${stem(imagePath)}_upscayl_${payload.useCustomWidth ? `${payload.customWidth}px_` : `${payload.scale}x_`}${payload.model}.${format}`;

const upscaleFile = async (imagePath: string, payload: ImageUpscaylPayload | BatchUpscaylPayload, passes: number, report: Reporter, outDir: string) => {
  const bitmap = await loadBitmap(imagePath);
  let raster = readPixels(bitmap);
  for (let pass = 0; pass < passes; pass++) {
    raster = await upscaleRaster(raster, payload.model, payload.tileSize, report);
  }
  // Each extra pass multiplies by the chosen scale, like running the desktop upscaler twice
  const scale = Number(payload.scale) || MODEL_SCALE;
  const { blob, format } = await encode(rasterToCanvas(raster), bitmap.width * scale ** (passes - 1), payload);
  return putFile(blob, outName(imagePath, payload, format), outDir);
};

type Emit = (channel: string, data?: unknown) => void;
type Channels = { progress: string; done: string; error: string };

const run = async (emit: Emit, channels: Channels, task: (report: Reporter) => Promise<string>) => {
  stopRequested = false;
  try {
    const result = await task((progress) => emit(channels.progress, progress));
    emit(channels.done, result);
  } catch (error) {
    if (error instanceof Stopped) return;
    const message = error instanceof Error ? error.message : String(error);
    emit(channels.error, /memory|alloc/i.test(message) ? `Trình duyệt hết bộ nhớ khi kích nét ảnh này. Hãy thử ảnh nhỏ hơn hoặc giảm Tile size trong Cài đặt. (${message})` : message);
  }
};

export const imageUpscayl = (payload: ImageUpscaylPayload, emit: Emit, channels: Channels, passes = 1) =>
  run(emit, channels, (report) => upscaleFile(payload.imagePath, payload, passes, report, payload.outputPath));

export const folderUpscayl = (payload: BatchUpscaylPayload, emit: Emit, channels: Channels) =>
  run(emit, channels, async (report) => {
    const images = listDir(payload.batchFolderPath).filter(isImageName);
    if (!images.length) throw new Error("Thư mục không có ảnh JPG, PNG hoặc WEBP.");
    const outDir = payload.outputPath || payload.batchFolderPath;
    for (let i = 0; i < images.length; i++) {
      await upscaleFile(images[i], payload, 1, (progress) => {
        const value = parseFloat(progress);
        report(Number.isNaN(value) ? progress : `${(((i + value / 100) / images.length) * 100).toFixed(2)}%`);
      }, outDir);
    }
    return outDir;
  });
