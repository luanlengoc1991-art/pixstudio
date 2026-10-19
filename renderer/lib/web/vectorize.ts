import { VectorizePayload, VectorizeResult, VectorType } from "@common/types/types";
import { loadBitmap, nextFrame, readPixels, Raster, toHex } from "./images";

type InkStyle = "fine" | "balanced" | "bold";

type PotraceOptions = { turdsize: number; alphamax: number; opttolerance: number };
type VtracerOptions = {
  preset: "photo" | "poster";
  maxColors: number;
  filterSpeckle: number;
  colorPrecision: number;
  pathPrecision?: number;
  mode: "polygon" | "spline";
};

type Recipe =
  | { engine: "potrace"; ink: InkStyle | "qr"; options: PotraceOptions }
  | { engine: "vtracer"; options: VtracerOptions };

// Same recipes as electron/commands/vectorize.ts, for potrace and vtracer built to WebAssembly
const RECIPES: Record<VectorType, Recipe> = {
  "one-color-logo": { engine: "potrace", ink: "balanced", options: { turdsize: 8, alphamax: 0.9, opttolerance: 0.1 } },
  text: { engine: "potrace", ink: "fine", options: { turdsize: 4, alphamax: 1, opttolerance: 0.1 } },
  // Corners must stay square for the code to scan
  "qr-code": { engine: "potrace", ink: "qr", options: { turdsize: 2, alphamax: 0, opttolerance: 0 } },
  "color-logo": { engine: "vtracer", options: { preset: "photo", maxColors: 24, filterSpeckle: 3, colorPrecision: 6, mode: "polygon" } },
  icon: { engine: "vtracer", options: { preset: "poster", maxColors: 12, filterSpeckle: 6, colorPrecision: 5, mode: "polygon" } },
  anime: { engine: "vtracer", options: { preset: "poster", maxColors: 32, filterSpeckle: 4, colorPrecision: 6, pathPrecision: 3, mode: "spline" } },
  // A compact palette avoids thousands of tiny paths in photographs
  portrait: { engine: "vtracer", options: { preset: "poster", maxColors: 24, filterSpeckle: 8, colorPrecision: 5, pathPrecision: 2, mode: "spline" } },
  artwork: { engine: "vtracer", options: { preset: "poster", maxColors: 48, filterSpeckle: 4, colorPrecision: 6, pathPrecision: 3, mode: "spline" } },
};

// vtracer's built-in presets (visioncortex/vtracer cmdapp)
const VTRACER_PRESETS = {
  photo: { layerDifference: 48, cornerThreshold: 180, lengthThreshold: 4, maxIterations: 10, spliceThreshold: 45, pathPrecision: 8 },
  poster: { layerDifference: 16, cornerThreshold: 60, lengthThreshold: 4, maxIterations: 10, spliceThreshold: 45, pathPrecision: 8 },
};

const INK_THRESHOLDS: Record<InkStyle, { colored: number; neutral: number }> = {
  fine: { colored: 42, neutral: 180 },
  balanced: { colored: 22, neutral: 215 },
  bold: { colored: 8, neutral: 240 },
};

// Tracing in WebAssembly is slower than the native tools; cap the work size
const POTRACE_SIZE = 2400;
const VTRACER_SIZE = 2000;

const fitInside = (width: number, height: number, max: number) => {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

/** Most common non-white colour, used as the fill of one-colour traces. */
const dominantInkColor = ({ data }: Raster) => {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.ceil(data.length / 4 / 250000));
  for (let i = 0; i < data.length; i += 4 * step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const light = (r + g + b) / 3;
    const sat = Math.max(r, g, b) - Math.min(r, g, b);
    if (light > 238 || (light > 200 && sat < 18)) continue;
    const key = [r, g, b].map((v) => Math.round(v / 24)).join(",");
    const bucket = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bucket.n++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const top = Array.from(buckets.values()).sort((a, b) => b.n - a.n)[0];
  return top ? toHex(top.r / top.n, top.g / top.n, top.b / top.n) : "#000000";
};

/** Black-on-white mask of the ink, and the ink colour. */
const buildInkMask = (raster: Raster, ink: InkStyle | "qr") => {
  const { data, width, height } = raster;
  const mask = new Uint8ClampedArray(width * height * 4).fill(255);
  const setInk = (p: number) => {
    mask[p * 4] = mask[p * 4 + 1] = mask[p * 4 + 2] = 0;
  };
  let color = "#000000";
  if (ink === "qr") {
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 128) setInk(p);
    }
  } else {
    color = dominantInkColor(raster);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const primary = Math.max(r, g, b) === r ? 0 : Math.max(r, g, b) === g ? 1 : 2;
    const colored = Math.max(r, g, b) - Math.min(r, g, b) > 36;
    const { colored: colorCut, neutral } = INK_THRESHOLDS[ink];
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const light = (pr + pg + pb) / 3;
      const strength = primary === 0 ? pr - (pg + pb) / 2 : primary === 1 ? pg - (pr + pb) / 2 : pb - (pr + pg) / 2;
      if (colored ? light < 252 && strength >= colorCut : light <= neutral) setInk(p);
    }
  }
  return { mask: new ImageData(mask, width, height), color };
};

let potraceReady: Promise<typeof import("esm-potrace-wasm")> | null = null;
const loadPotrace = () =>
  (potraceReady ??= import("esm-potrace-wasm").then(async (mod) => {
    await mod.init();
    return mod;
  }));

/** Traces a black-on-white mask; returns the outline paths in mask pixels. */
export const potracePaths = async (mask: ImageData, options: PotraceOptions) => {
  const { potrace } = await loadPotrace();
  const svg: string = await potrace(mask, {
    ...options,
    turnpolicy: 4,
    opticurve: options.opttolerance > 0 ? 1 : 0,
    pathonly: false,
    extractcolors: false,
    posterizelevel: 2,
    posterizationalgorithm: 0,
  });
  return { svg, paths: Array.from(svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g), (m) => m[1]) };
};

const tracePotrace = async (raster: Raster, recipe: Extract<Recipe, { engine: "potrace" }>) => {
  const { mask, color } = buildInkMask(raster, recipe.ink);
  const { paths } = await potracePaths(mask, recipe.options);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${raster.width} ${raster.height}"><g fill="${color}" fill-rule="evenodd" stroke="none">${paths
    .map((d) => `<path d="${d}"/>`)
    .join("")}</g></svg>`;
};

/** Median-cut palette reduction, standing in for vtracer's --max-colors. */
const reduceColors = ({ data, width, height }: Raster, maxColors: number): Raster => {
  const step = Math.max(1, Math.floor(data.length / 4 / 60000));
  const samples: number[][] = [];
  for (let i = 0; i < data.length; i += 4 * step) if (data[i + 3] >= 128) samples.push([data[i], data[i + 1], data[i + 2]]);
  if (!samples.length) return { data, width, height };

  let boxes = [samples];
  while (boxes.length < maxColors) {
    let index = -1;
    let channel = 0;
    let spread = -1;
    boxes.forEach((box, i) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255;
        let hi = 0;
        for (const s of box) {
          if (s[c] < lo) lo = s[c];
          if (s[c] > hi) hi = s[c];
        }
        if (hi - lo > spread) {
          spread = hi - lo;
          index = i;
          channel = c;
        }
      }
    });
    if (index < 0 || spread <= 0) break;
    const box = boxes[index].sort((a, b) => a[channel] - b[channel]);
    const half = box.length >> 1;
    boxes = [...boxes.slice(0, index), box.slice(0, half), box.slice(half), ...boxes.slice(index + 1)];
  }
  const palette = boxes.map((box) => {
    const sum = [0, 0, 0];
    for (const s of box) for (let c = 0; c < 3; c++) sum[c] += s[c];
    return sum.map((v) => Math.round(v / box.length));
  });

  const out = new Uint8ClampedArray(data.length);
  const memo = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 2) << 12) | ((data[i + 1] >> 2) << 6) | (data[i + 2] >> 2);
    let best = memo.get(key);
    if (best === undefined) {
      let bestDistance = Infinity;
      best = 0;
      for (let p = 0; p < palette.length; p++) {
        const dr = data[i] - palette[p][0];
        const dg = data[i + 1] - palette[p][1];
        const db = data[i + 2] - palette[p][2];
        const distance = dr * dr * 2 + dg * dg * 4 + db * db * 3;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = p;
        }
      }
      memo.set(key, best);
    }
    out[i] = palette[best][0];
    out[i + 1] = palette[best][1];
    out[i + 2] = palette[best][2];
    out[i + 3] = 255;
  }
  return { data: out, width, height };
};

// vtracer-wasm points at a .wasm name it does not ship, so webpack cannot bundle it;
// scripts/build-web.js copies the package into the site's wasm/ folder instead
let vtracerReady: Promise<typeof import("vtracer-wasm")> | null = null;
const loadVtracer = () =>
  (vtracerReady ??= (async () => {
    const base = new URL("wasm/", document.baseURI).href;
    const mod: typeof import("vtracer-wasm") = await import(/* webpackIgnore: true */ `${base}vtracer.js`);
    await mod.default({ module_or_path: `${base}vtracer.wasm` });
    return mod;
  })());

const traceVtracer = async (raster: Raster, { preset, maxColors, filterSpeckle, colorPrecision, pathPrecision, mode }: VtracerOptions) => {
  const { to_svg } = await loadVtracer();
  const reduced = reduceColors(raster, maxColors);
  const base = VTRACER_PRESETS[preset];
  const svg = to_svg(new Uint8Array(reduced.data.buffer), reduced.width, reduced.height, {
    binary: false,
    mode,
    hierarchical: "stacked",
    filterSpeckle,
    colorPrecision,
    layerDifference: base.layerDifference,
    cornerThreshold: base.cornerThreshold,
    lengthThreshold: base.lengthThreshold,
    maxIterations: base.maxIterations,
    spliceThreshold: base.spliceThreshold,
    pathPrecision: pathPrecision ?? base.pathPrecision,
  });
  return svg.replace(/^\s*<\?xml[^>]*\?>\s*(<!--[^]*?-->\s*)?/, "");
};

/** Declares the source image size, keeping the traced coordinates through a viewBox. */
const setSvgSize = (svg: string, width: number, height: number, traceWidth: number, traceHeight: number) =>
  svg.replace(/<svg\b[^>]*>/i, (open) => {
    let tag = open.replace(/\swidth="[^"]*"/i, "").replace(/\sheight="[^"]*"/i, "");
    if (!/viewBox=/i.test(tag)) tag = tag.replace(/<svg/i, `<svg viewBox="0 0 ${traceWidth} ${traceHeight}"`);
    return tag.replace(/<svg/i, `<svg width="${width}" height="${height}"`);
  });

const addWhiteBackground = (svg: string) =>
  svg.replace(/(<svg\b[^>]*>)/i, `$1<rect data-background="true" width="100%" height="100%" fill="#ffffff"/>`);

export const vectorizeImage = async ({ imagePath, type, background }: VectorizePayload): Promise<VectorizeResult> => {
  const recipe = RECIPES[type];
  const bitmap = await loadBitmap(imagePath);
  const { width, height } = bitmap;
  await nextFrame();

  let svg: string;
  let size: { width: number; height: number };
  if (recipe.engine === "potrace") {
    size = fitInside(width, height, POTRACE_SIZE);
    svg = await tracePotrace(readPixels(bitmap, size.width, size.height, "#ffffff"), recipe);
  } else {
    size = fitInside(width, height, VTRACER_SIZE);
    svg = await traceVtracer(readPixels(bitmap, size.width, size.height), recipe.options);
  }
  svg = setSvgSize(svg, width, height, size.width, size.height);
  if (background === "white") svg = addWhiteBackground(svg);
  return {
    svg,
    pathCount: (svg.match(/<path\b/gi) || []).length,
    bytes: new Blob([svg]).size,
    width,
    height,
  };
};

/** Single-page vector PDF sized to the artwork. */
export const exportSvgToPdf = async (svg: string) => {
  if (!svg.includes("<svg")) throw new Error("SVG không hợp lệ.");
  const [{ jsPDF }] = await Promise.all([import("jspdf"), import("svg2pdf.js")]);
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;visibility:hidden";
  holder.innerHTML = svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
  document.body.appendChild(holder);
  try {
    const element = holder.querySelector("svg") as SVGSVGElement;
    const size = (name: string) => Math.max(1, Math.round(Number(element.getAttribute(name)) || 1024));
    const width = size("width");
    const height = size("height");
    const doc = new jsPDF({ orientation: width > height ? "l" : "p", unit: "px", format: [width, height], hotfixes: ["px_scaling"] });
    await (doc as any).svg(element, { x: 0, y: 0, width, height });
    return new Uint8Array(doc.output("arraybuffer"));
  } finally {
    holder.remove();
  }
};
