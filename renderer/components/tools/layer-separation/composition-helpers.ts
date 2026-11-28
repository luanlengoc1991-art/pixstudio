import {
  BackgroundDetection,
  CompositionLayerItem,
  detectCompositionBackground,
  findLayerPlacement,
  getAlphaBounds,
  layerCropPixels,
  LayerPlacement,
  RasterPixels,
} from "@common/layer-composition";

export interface RawLayerInput {
  id: string;
  title: string;
  source: string;
  isBackground?: boolean;
}

export interface ComposedScene {
  width: number;
  height: number;
  originalUrl: string;
  layers: CompositionLayerItem[];
  backgroundDetection: BackgroundDetection;
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Không đọc được ảnh layer. Hãy kiểm tra lại ảnh đầu vào."));
    img.src = src;
  });
}

function drawToCanvas(source: HTMLImageElement | HTMLCanvasElement, width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Không khởi tạo được khung ghép ảnh.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

function sampleRaster(source: HTMLImageElement | HTMLCanvasElement, maxSide: number): RasterPixels {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH, 1));
  const { canvas, context } = drawToCanvas(source, srcW * scale, srcH * scale);
  return {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

function cropLayerWithImage(
  layer: CompositionLayerItem,
  crop: LayerPlacement,
  img: HTMLImageElement,
): Partial<CompositionLayerItem> {
  const { source, placement } = layerCropPixels(layer, crop, {
    width: img.naturalWidth,
    height: img.naturalHeight,
  });
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không tạo được ảnh cắt.");
  ctx.drawImage(img, source.x, source.y, source.width, source.height, 0, 0, source.width, source.height);
  try {
    getAlphaBounds({ width: canvas.width, height: canvas.height, data: ctx.getImageData(0, 0, canvas.width, canvas.height).data }, 0);
  } catch {
    throw new Error("Khung cắt không có nội dung. Hãy kéo khung bao quanh phần chữ hoặc đối tượng cần giữ.");
  }
  return { ...placement, dataUrl: canvas.toDataURL("image/png") };
}

export async function cropCompositionLayer(
  layer: CompositionLayerItem,
  crop: LayerPlacement,
): Promise<Partial<CompositionLayerItem>> {
  const img = await loadImageElement(layer.dataUrl);
  return cropLayerWithImage(layer, crop, img);
}

/** Trims transparent padding around a cutout without moving or scaling visible pixels on the canvas. */
export async function autoTrimLayerFrame(
  layer: CompositionLayerItem,
): Promise<Partial<CompositionLayerItem> | null> {
  const img = await loadImageElement(layer.dataUrl);
  const { canvas, context } = drawToCanvas(img, img.naturalWidth, img.naturalHeight);
  const raster: RasterPixels = {
    width: canvas.width,
    height: canvas.height,
    data: context.getImageData(0, 0, canvas.width, canvas.height).data,
  };
  let coarse;
  try {
    coarse = getAlphaBounds(raster, 12);
  } catch {
    coarse = getAlphaBounds(raster, 0);
  }
  const padX = Math.max(0, coarse.x - 2);
  const padY = Math.max(0, coarse.y - 2);
  const padW = Math.min(canvas.width, coarse.x + coarse.width + 2) - padX;
  const padH = Math.min(canvas.height, coarse.y + coarse.height + 2) - padY;
  const fine = getAlphaBounds(
    { width: padW, height: padH, data: context.getImageData(padX, padY, padW, padH).data },
    0,
  );
  const bounds = { x: padX + fine.x, y: padY + fine.y, width: fine.width, height: fine.height };
  if (bounds.x === 0 && bounds.y === 0 && bounds.width === canvas.width && bounds.height === canvas.height) {
    return null;
  }
  return cropLayerWithImage(
    layer,
    {
      x: layer.x + (bounds.x / canvas.width) * layer.width,
      y: layer.y + (bounds.y / canvas.height) * layer.height,
      width: (bounds.width / canvas.width) * layer.width,
      height: (bounds.height / canvas.height) * layer.height,
    },
    img,
  );
}

/**
 * Loads the original source image and all separated layer images, detects the
 * background layer, trims alpha borders, and snaps each object cutout onto its
 * exact coordinates on the original design.
 */
export async function composeExtractedLayers(
  originalUrl: string,
  inputs: RawLayerInput[],
  onProgress: (done: number) => void,
  isCancelled: () => boolean,
  backgroundOverrideId?: string,
): Promise<ComposedScene> {
  const originalImg = await loadImageElement(originalUrl);
  const width = originalImg.naturalWidth;
  const height = originalImg.naturalHeight;
  const coarseTarget = sampleRaster(originalImg, 192);
  const detailTarget = sampleRaster(originalImg, 512);

  const loaded: { input: RawLayerInput; image: HTMLImageElement; sample: RasterPixels }[] = [];
  for (const input of inputs) {
    if (isCancelled()) throw new Error("Đã hủy ghép layer.");
    const image = await loadImageElement(input.source);
    loaded.push({ input, image, sample: sampleRaster(image, 128) });
  }

  if (backgroundOverrideId && !inputs.some((i) => i.id === backgroundOverrideId)) {
    throw new Error("Layer nền đã chọn không còn tồn tại.");
  }

  const backgroundDetection: BackgroundDetection = backgroundOverrideId
    ? { backgroundId: backgroundOverrideId, status: "manual" }
    : detectCompositionBackground(
        coarseTarget,
        loaded.map(({ input, sample }) => ({ id: input.id, pixels: sample, hint: input.isBackground })),
      );

  const ordered = [
    ...loaded.filter((item) => item.input.id === backgroundDetection.backgroundId),
    ...loaded.filter((item) => item.input.id !== backgroundDetection.backgroundId),
  ];

  const layers: CompositionLayerItem[] = [];
  for (const { input, image } of ordered) {
    if (isCancelled()) throw new Error("Đã hủy ghép layer.");
    const isBg = input.id === backgroundDetection.backgroundId;
    const full = drawToCanvas(image, image.naturalWidth, image.naturalHeight);
    let trimmedCanvas = full.canvas;
    let canvasHint: LayerPlacement | undefined;

    if (!isBg) {
      const alphaBox = getAlphaBounds(
        {
          width: full.canvas.width,
          height: full.canvas.height,
          data: full.context.getImageData(0, 0, full.canvas.width, full.canvas.height).data,
        },
        0,
      );
      const sx = Math.max(0, alphaBox.x - 1);
      const sy = Math.max(0, alphaBox.y - 1);
      const sw = Math.min(image.naturalWidth - sx, alphaBox.x + alphaBox.width + 1 - sx);
      const sh = Math.min(image.naturalHeight - sy, alphaBox.y + alphaBox.height + 1 - sy);
      trimmedCanvas = document.createElement("canvas");
      trimmedCanvas.width = sw;
      trimmedCanvas.height = sh;
      const ctx = trimmedCanvas.getContext("2d");
      if (!ctx) throw new Error("Không cắt được layer.");
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);

      if (Math.abs(image.naturalWidth / image.naturalHeight / (width / height) - 1) < 0.03) {
        canvasHint = {
          x: sx / image.naturalWidth,
          y: sy / image.naturalHeight,
          width: sw / image.naturalWidth,
          height: sh / image.naturalHeight,
        };
      }
    }

    const placement = isBg
      ? { x: 0, y: 0, width: 1, height: 1 }
      : backgroundDetection.backgroundId
        ? findLayerPlacement(coarseTarget, sampleRaster(trimmedCanvas, 64), detailTarget, canvasHint)
        : { x: 0, y: 0, width: 1, height: 1 };

    layers.push({
      id: input.id,
      title: input.title,
      isBackground: isBg,
      locked: false,
      visible: true,
      dataUrl: trimmedCanvas.toDataURL("image/png"),
      ...placement,
    });
    onProgress(layers.length);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  return { width, height, originalUrl, layers, backgroundDetection };
}

export async function buildCompositionJpg(
  width: number,
  height: number,
  layers: CompositionLayerItem[],
): Promise<Uint8Array> {
  const visible: { layer: CompositionLayerItem; img: HTMLImageElement }[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    const img = await loadImageElement(layer.dataUrl);
    visible.push({ layer, img });
  }
  if (!visible.length) {
    throw new Error("Cần ít nhất một layer đang hiển thị để xuất JPG.");
  }

  let bestScale = 1;
  for (const { layer, img } of visible) {
    const w = Math.max(1, layer.width * width);
    const h = Math.max(1, layer.height * height);
    const ratio = Math.max(img.naturalWidth / w, img.naturalHeight / h);
    if (Number.isFinite(ratio) && ratio > bestScale) bestScale = ratio;
  }
  const scale = Math.min(bestScale, Math.max(1, 12000 / Math.max(width, height, 1)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Không khởi tạo được canvas để xuất JPG.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const { layer, img } of visible) {
    ctx.drawImage(img, layer.x * canvas.width, layer.y * canvas.height, layer.width * canvas.width, layer.height * canvas.height);
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.98));
  if (!blob) throw new Error("Không tạo được file JPG.");
  return new Uint8Array(await blob.arrayBuffer());
}
