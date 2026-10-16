import { IpcMainInvokeEvent } from "electron";
import fs from "fs";
import { join } from "path";
import sharp from "sharp";
import { DieCutPayload, DieCutResult } from "../../common/types/types";
import {
  execFileAsync,
  getBinaryPath,
  getToolTempDir,
  uniqueName,
} from "../utils/tool-files";
import {
  getOrientedSize,
  predictForegroundMask,
} from "./remove-background";
import logit from "../utils/logit";

const LINE_WIDTH_MM = { thin: 0.25, medium: 0.5, thick: 1 } as const;
const SMOOTHING = {
  auto: { blur: 1, alphamax: 1, opttolerance: 0.2 },
  smooth: { blur: 2.5, alphamax: 1.2, opttolerance: 0.5 },
  very_smooth: { blur: 5, alphamax: 1.334, opttolerance: 1 },
} as const;
// Masks are processed at this size at most; the cut path is scaled back up
const WORK_SIZE = 1600;

// ---------------------------------------------------------------------------
// Binary mask helpers (1 = object, 0 = empty)

/** Felzenszwalb–Huttenlocher squared distance transform along one line. */
const edt1d = (
  f: Float64Array,
  n: number,
  d: Float64Array,
  v: Int32Array,
  z: Float64Array,
) => {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
};

/** Squared Euclidean distance from every pixel to the nearest pixel equal to `target`. */
const squaredDistanceTo = (mask: Uint8Array, w: number, h: number, target: 0 | 1) => {
  const BIG = 1e20;
  const out = new Float64Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = mask[i] === target ? 0 : BIG;
  const n = Math.max(w, h);
  const f = new Float64Array(n);
  const d = new Float64Array(n);
  const v = new Int32Array(n);
  const z = new Float64Array(n + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = out[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) out[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = out[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) out[y * w + x] = d[x];
  }
  return out;
};

const dilate = (mask: Uint8Array, w: number, h: number, r: number) => {
  const dist = squaredDistanceTo(mask, w, h, 1);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = dist[i] <= r * r ? 1 : 0;
  return out;
};

const erode = (mask: Uint8Array, w: number, h: number, r: number) => {
  const dist = squaredDistanceTo(mask, w, h, 0);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = dist[i] > r * r ? 1 : 0;
  return out;
};

/** Marks enclosed empty areas as object so the cut follows the outer edge only. */
const fillHoles = (mask: Uint8Array, w: number, h: number) => {
  const outside = new Uint8Array(mask.length);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!mask[i] && !outside[i]) {
      outside[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (i >= w) push(i - w);
    if (i < mask.length - w) push(i + w);
  }
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < out.length; i++) out[i] = outside[i] ? 0 : 1;
  return out;
};

const boundingBox = (mask: Uint8Array, w: number, h: number) => {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
};

// ---------------------------------------------------------------------------

/** Object mask at full size: the PNG's own transparency, or the AI mask. */
const getObjectAlpha = async (imagePath: string, width: number, height: number) => {
  const meta = await sharp(imagePath).metadata();
  if (meta.hasAlpha) {
    const alpha = await sharp(imagePath).rotate().ensureAlpha().extractChannel(3).raw().toBuffer();
    let transparent = 0;
    for (const value of alpha) if (value < 128) transparent++;
    // Ignore files whose alpha channel is present but fully opaque
    if (transparent > alpha.length * 0.005) return { alpha, usedAi: false };
  }
  const { alpha } = await predictForegroundMask(imagePath, "general");
  if (alpha.length !== width * height) throw new Error("Mặt nạ AI không khớp kích thước ảnh.");
  return { alpha, usedAi: true };
};

/** Traces a binary mask with potrace and returns the SVG group of outlines. */
const traceMask = async (
  mask: Uint8Array,
  w: number,
  h: number,
  smoothing: (typeof SMOOTHING)[keyof typeof SMOOTHING],
) => {
  const workDir = getToolTempDir("die-cut");
  const pgmPath = join(workDir, uniqueName("mask", "pgm"));
  const svgPath = join(workDir, uniqueName("trace", "svg"));
  const pixels = Buffer.alloc(w * h);
  for (let i = 0; i < pixels.length; i++) pixels[i] = mask[i] ? 0 : 255;
  try {
    await fs.promises.writeFile(
      pgmPath,
      Buffer.concat([Buffer.from(`P5\n${w} ${h}\n255\n`), pixels]),
    );
    await execFileAsync(
      getBinaryPath("potrace"),
      [
        "--svg",
        "--turdsize", "20",
        "--alphamax", String(smoothing.alphamax),
        "--opttolerance", String(smoothing.opttolerance),
        "--output", svgPath,
        pgmPath,
      ],
      { windowsHide: true, maxBuffer: 50 * 1024 * 1024 },
    );
    const svg = await fs.promises.readFile(svgPath, "utf8");
    const transform = svg.match(/<g transform="([^"]+)"/)?.[1] ?? "";
    const quantum = Math.abs(Number(transform.match(/scale\(([-\d.]+)/)?.[1] ?? 1));
    const paths = [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
    if (!paths.length) throw new Error("Không vẽ được đường bế.");
    return { transform, quantum, paths };
  } finally {
    await Promise.all(
      [pgmPath, svgPath].map((f) => fs.promises.unlink(f).catch(() => undefined)),
    );
  }
};

const dieCut = async (
  _event: IpcMainInvokeEvent,
  payload: DieCutPayload,
): Promise<DieCutResult> => {
  const { imagePath, cutType, offsetMm, smoothness, lineWidth, lineColor, background } = payload;
  const { width: W, height: H, density } = await getOrientedSize(imagePath);
  // Most files report 72 DPI by default; assume print resolution then
  const dpi = density && density > 72 ? density : 300;
  const pxPerMm = dpi / 25.4;
  const offsetPx = Math.max(0, offsetMm) * pxPerMm;
  const strokePx = Math.max(1.5, LINE_WIDTH_MM[lineWidth] * pxPerMm);
  const pad = Math.ceil(offsetPx + strokePx + 8);
  const PW = W + pad * 2;
  const PH = H + pad * 2;

  const { alpha, usedAi } = await getObjectAlpha(imagePath, W, H);

  // Work on a reduced copy of the padded mask
  const scale = Math.min(1, WORK_SIZE / Math.max(PW, PH));
  const w = Math.max(1, Math.round(PW * scale));
  const h = Math.max(1, Math.round(PH * scale));
  // sharp runs resize before extend inside one pipeline, so pad in a
  // separate pass; extractChannel keeps the mask single-channel.
  const padded = await sharp(alpha, { raw: { width: W, height: H, channels: 1 } })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0 } })
    .extractChannel(0)
    .raw()
    .toBuffer();
  const small = await sharp(padded, { raw: { width: PW, height: PH, channels: 1 } })
    .resize(w, h, { fit: "fill" })
    .extractChannel(0)
    .raw()
    .toBuffer();
  let mask: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = small[i] > 127 ? 1 : 0;

  const box = boundingBox(mask, w, h);
  if (!box) throw new Error("Không tìm thấy đối tượng trong ảnh để tạo đường bế.");

  const workDir = getToolTempDir("die-cut");
  let cutShape: string;

  if (cutType === "rounded" || cutType === "rect") {
    const x = box.x0 / scale - offsetPx;
    const y = box.y0 / scale - offsetPx;
    const bw = (box.x1 - box.x0) / scale + offsetPx * 2;
    const bh = (box.y1 - box.y0) / scale + offsetPx * 2;
    const radius =
      cutType === "rounded"
        ? Math.min(offsetPx * 2 + Math.min(bw, bh) * 0.06, Math.min(bw, bh) / 2)
        : 0;
    cutShape = `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${bw.toFixed(2)}" height="${bh.toFixed(2)}" rx="${radius.toFixed(2)}" fill="none" stroke="${lineColor}" stroke-width="${strokePx.toFixed(2)}"/>`;
  } else {
    const offset = offsetPx * scale;
    if (cutType === "all") {
      // Closing with a large radius merges separate parts into one outline
      const merge = Math.max(offset, Math.max(w, h) * 0.03);
      mask = erode(dilate(mask, w, h, merge + offset), w, h, merge);
    } else {
      mask = dilate(mask, w, h, offset);
    }
    mask = fillHoles(mask, w, h);

    const smoothing = SMOOTHING[smoothness];
    const blurred = await sharp(Buffer.from(mask.map((v) => v * 255)), {
      raw: { width: w, height: h, channels: 1 },
    })
      .blur(smoothing.blur)
      .extractChannel(0)
      .raw()
      .toBuffer();
    for (let i = 0; i < mask.length; i++) mask[i] = blurred[i] > 127 ? 1 : 0;

    const { transform, quantum, paths } = await traceMask(mask, w, h, smoothing);
    cutShape = `<g transform="scale(${1 / scale}) ${transform}" fill="none" stroke="${lineColor}" stroke-width="${(strokePx * scale) / quantum}" stroke-linejoin="round">${paths
      .map((d) => `<path d="${d.replace(/\s+/g, " ")}"/>`)
      .join("")}</g>`;
  }

  // Cut line alone, in pixels, for raster previews
  const linePng = await sharp(
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PW}" height="${PH}" viewBox="0 0 ${PW} ${PH}">${cutShape}</svg>`,
    ),
  )
    .png()
    .toBuffer();

  const flatBackground = { r: 255, g: 255, b: 255, alpha: background === "white" ? 1 : 0 };
  const designPng = await sharp(imagePath).rotate().png().toBuffer();
  const paddedDesign = await sharp(designPng)
    .ensureAlpha()
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const id = uniqueName("diecut", "x").slice(0, -2);
  const previewPath = join(workDir, `${id}-preview.png`);
  const cutOnlyPath = join(workDir, `${id}-cut.png`);
  const svgPath = join(workDir, `${id}.svg`);

  await sharp({ create: { width: PW, height: PH, channels: 4, background: flatBackground } })
    .composite([{ input: paddedDesign }, { input: linePng }])
    .png()
    .toFile(previewPath);
  await sharp({ create: { width: PW, height: PH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } })
    .composite([{ input: linePng }])
    .png()
    .toFile(cutOnlyPath);

  // Vector file for cutting plotters: physical size in mm, design and cut line on separate layers
  const widthMm = PW / pxPerMm;
  const heightMm = PH / pxPerMm;
  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${widthMm.toFixed(2)}mm" height="${heightMm.toFixed(2)}mm" viewBox="0 0 ${PW} ${PH}">`,
    `<g id="Design">`,
    background === "white" ? `<rect width="${PW}" height="${PH}" fill="#ffffff"/>` : "",
    `<image x="${pad}" y="${pad}" width="${W}" height="${H}" xlink:href="data:image/png;base64,${designPng.toString("base64")}"/>`,
    `</g>`,
    `<g id="CutContour">${cutShape}</g>`,
    `</svg>`,
  ].join("\n");
  await fs.promises.writeFile(svgPath, svg, "utf8");

  logit("✅ Die-cut created: ", svgPath);
  return { previewPath, cutOnlyPath, svgPath, widthMm, heightMm, usedAi };
};

export default dieCut;
