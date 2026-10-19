import { BackgroundRemovalModel, RemoveBackgroundPayload } from "@common/types/types";
import { newDir, putFile, stem } from "./files";
import { canvasToBlob, context2d, createCanvas, loadBitmap, nextFrame, readPixels, resizeMask } from "./images";
import { loadModel, loadOrt } from "./onnx";

// Same rembg models (MIT) and preprocessing as electron/commands/remove-background.ts
const MODEL_SPECS: Record<BackgroundRemovalModel, { file: string; size: number; mean: number[]; std: number[] }> = {
  general: { file: "isnet-general-use.onnx", size: 1024, mean: [0.5, 0.5, 0.5], std: [1, 1, 1] },
  portrait: { file: "u2net_human_seg.onnx", size: 320, mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225] },
};

/** Foreground mask (0 = background, 255 = subject) at the image's oriented size. */
export const predictForegroundMask = async (
  path: string,
  model: BackgroundRemovalModel,
  onProgress: (message: string) => void,
) => {
  const spec = MODEL_SPECS[model];
  const [ort, net] = await Promise.all([loadOrt(), loadModel(spec.file, onProgress)]);
  onProgress("AI đang tách nền...");
  await nextFrame();
  const bitmap = await loadBitmap(path);
  const { width, height } = bitmap;
  const { data: pixels } = readPixels(bitmap, spec.size, spec.size, "#000000");

  // HWC uint8 -> CHW float32, scaled by the image max like rembg does
  let max = 1e-6;
  for (let i = 0; i < pixels.length; i++) if (i % 4 !== 3 && pixels[i] > max) max = pixels[i];
  const area = spec.size * spec.size;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    for (let c = 0; c < 3; c++) input[c * area + i] = (pixels[i * 4 + c] / max - spec.mean[c]) / spec.std[c];
  }
  const output = await net.run(new ort.Tensor("float32", input, [1, 3, spec.size, spec.size]));
  const prediction = (await output.getData()) as Float32Array;

  let min = Infinity;
  let top = -Infinity;
  for (let i = 0; i < area; i++) {
    if (prediction[i] < min) min = prediction[i];
    if (prediction[i] > top) top = prediction[i];
  }
  const range = top - min || 1;
  const mask = new Uint8ClampedArray(area);
  for (let i = 0; i < area; i++) mask[i] = Math.round(((prediction[i] - min) / range) * 255);

  return { alpha: resizeMask(mask, spec.size, spec.size, width, height), width, height, bitmap };
};

export const removeBackground = async (
  { imagePath, outputPath, model, background }: RemoveBackgroundPayload,
  onProgress: (message: string) => void,
) => {
  const { alpha, width, height, bitmap } = await predictForegroundMask(imagePath, model, onProgress);
  onProgress("Đang hoàn thiện ảnh...");
  await nextFrame();

  const cutout = createCanvas(width, height);
  const ctx = context2d(cutout);
  ctx.drawImage(bitmap, 0, 0);
  const image = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < alpha.length; i++) image.data[i * 4 + 3] = alpha[i];
  ctx.putImageData(image, 0, 0);

  let output = cutout;
  if (background !== "transparent") {
    output = createCanvas(width, height);
    const flat = context2d(output);
    flat.fillStyle = background;
    flat.fillRect(0, 0, width, height);
    flat.drawImage(cutout, 0, 0);
  }

  const suffix = background === "transparent" ? "tach-nen" : "nen-mau";
  const path = putFile(await canvasToBlob(output), `${stem(imagePath)}_${suffix}.png`, outputPath || newDir());
  onProgress("");
  return path;
};
