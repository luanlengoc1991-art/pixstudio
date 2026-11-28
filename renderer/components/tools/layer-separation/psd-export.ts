import { Layer, LinkedFile, writePsdUint8Array } from "ag-psd";
import { CompositionLayerItem } from "@common/layer-composition";

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Không khởi tạo được canvas để xuất PSD.");
  return { canvas, context };
}

function makeUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Exports the multi-layer composition as a native Adobe Photoshop (.psd) file
 * preserving individual layer names, pixel bounds, visibility, lock state, and
 * embedded raster Smart Objects (`placedLayer` + `linkedFiles`).
 */
export async function buildCompositionPsd(
  width: number,
  height: number,
  layers: CompositionLayerItem[],
): Promise<Uint8Array> {
  const w = Math.round(width);
  const h = Math.round(height);
  if (![w, h].every((v) => Number.isInteger(v) && v > 0 && v <= 30000)) {
    throw new Error("PSD hỗ trợ kích thước tối đa 30.000 pixel mỗi chiều.");
  }
  if (!layers.length || !layers.some((layer) => layer.visible)) {
    throw new Error("Cần ít nhất một layer đang hiển thị để xuất PSD.");
  }

  const composite = makeCanvas(w, h);
  const children: Layer[] = [];
  const linkedFiles: LinkedFile[] = [];

  for (let index = 0; index < layers.length; index++) {
    const layer = layers[index];
    if (
      !/^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(layer.dataUrl) ||
      ![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) ||
      layer.width <= 0 ||
      layer.height <= 0
    ) {
      throw new Error(`Layer ${index + 1} có ảnh hoặc vị trí không hợp lệ.`);
    }
    const img = new Image();
    img.src = layer.dataUrl;
    await img.decode();

    const px = layer.x * w;
    const py = layer.y * h;
    const pw = layer.width * w;
    const ph = layer.height * h;
    const left = Math.floor(px);
    const top = Math.floor(py);
    const boxWidth = Math.max(1, Math.ceil(px + pw) - left);
    const boxHeight = Math.max(1, Math.ceil(py + ph) - top);
    const layerSurface = makeCanvas(boxWidth, boxHeight);
    layerSurface.context.drawImage(img, px - left, py - top, pw, ph);

    if (layer.visible) {
      composite.context.drawImage(img, px, py, pw, ph);
    }

    const fileId = makeUuid();
    const rawBase64 = atob(layer.dataUrl.substring(layer.dataUrl.indexOf(",") + 1));
    const pngBytes = new Uint8Array(rawBase64.length);
    for (let b = 0; b < rawBase64.length; b++) {
      pngBytes[b] = rawBase64.charCodeAt(b);
    }

    linkedFiles.push({
      id: fileId,
      name: `${layer.title.replace(/[\\/:*?"<>|]/g, "_") || `Layer ${index + 1}`}.png`,
      data: pngBytes,
    });

    children.push({
      id: index + 1,
      name: layer.title,
      left,
      top,
      canvas: layerSurface.canvas,
      hidden: !layer.visible,
      blendMode: "normal",
      opacity: 1,
      protected: {
        all: layer.locked,
        position: layer.locked,
        composite: layer.locked,
        transparency: layer.locked,
      },
      placedLayer: {
        id: fileId,
        type: "raster",
        width: img.naturalWidth,
        height: img.naturalHeight,
        transform: [px, py, px + pw, py, px + pw, py + ph, px, py + ph],
      },
    });

    // Yield to event loop so UI stays responsive on 10 high-res layers
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // ag-psd expects bottom-to-top in `children` (index 0 = bottom-most layer)
  return writePsdUint8Array(
    {
      width: w,
      height: h,
      canvas: composite.canvas,
      children,
      linkedFiles,
    },
    { noBackground: true },
  );
}
