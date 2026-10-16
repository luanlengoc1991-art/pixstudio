import { BrowserWindow, IpcMainInvokeEvent } from "electron";
import fs from "fs";
import { join } from "path";
import sharp from "sharp";
import {
  ExportPdfPayload,
  VectorizePayload,
  VectorizeResult,
  VectorType,
} from "../../common/types/types";
import {
  execFileAsync,
  getBinaryPath,
  getToolTempDir,
  uniqueName,
} from "../utils/tool-files";
import logit from "../utils/logit";

type InkStyle = "fine" | "balanced" | "bold";

type Recipe =
  | { engine: "potrace"; ink: InkStyle | "qr"; args: string[] }
  | { engine: "vtracer"; args: string[] };

// Each vector type maps to one tracer and a tuned set of options.
const RECIPES: Record<VectorType, Recipe> = {
  "one-color-logo": {
    engine: "potrace",
    ink: "balanced",
    args: ["--turdsize", "8", "--alphamax", "0.9", "--opttolerance", "0.1"],
  },
  text: {
    engine: "potrace",
    ink: "fine",
    args: ["--turdsize", "4", "--alphamax", "1", "--opttolerance", "0.1"],
  },
  "qr-code": {
    engine: "potrace",
    ink: "qr",
    // Corners must stay square for the code to scan
    args: ["--turdsize", "2", "--alphamax", "0", "--opttolerance", "0"],
  },
  "color-logo": {
    engine: "vtracer",
    args: ["--preset", "photo", "--max-colors", "24", "--filter-speckle", "3", "--color-precision", "6", "--optimize", "1", "--mode", "polygon"],
  },
  icon: {
    engine: "vtracer",
    args: ["--preset", "poster", "--max-colors", "12", "--filter-speckle", "6", "--color-precision", "5", "--optimize", "2", "--mode", "polygon"],
  },
  anime: {
    engine: "vtracer",
    args: ["--preset", "poster", "--max-colors", "32", "--filter-speckle", "4", "--color-precision", "6", "--path-precision", "3", "--optimize", "2", "--mode", "spline"],
  },
  portrait: {
    engine: "vtracer",
    // A compact palette avoids thousands of tiny paths in photographs
    args: ["--preset", "poster", "--max-colors", "24", "--filter-speckle", "8", "--color-precision", "5", "--path-precision", "2", "--optimize", "2", "--mode", "spline"],
  },
  artwork: {
    engine: "vtracer",
    args: ["--preset", "poster", "--max-colors", "48", "--filter-speckle", "4", "--color-precision", "6", "--path-precision", "3", "--optimize", "2", "--mode", "spline"],
  },
};

const INK_THRESHOLDS: Record<InkStyle, { colored: number; neutral: number }> = {
  fine: { colored: 42, neutral: 180 },
  balanced: { colored: 22, neutral: 215 },
  bold: { colored: 8, neutral: 240 },
};

const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/** Most common non-white colour, used as the fill of one-colour traces. */
const dominantInkColor = (pixels: Buffer) => {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.ceil(pixels.length / 3 / 250000));
  for (let i = 0; i < pixels.length; i += 3 * step) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
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
  const top = [...buckets.values()].sort((a, b) => b.n - a.n)[0];
  return top ? toHex(top.r / top.n, top.g / top.n, top.b / top.n) : "#000000";
};

/** Builds a binary PGM (ink = black) and picks the ink colour. */
const buildInkMask = async (imagePath: string, ink: InkStyle | "qr") => {
  const { data, info } = await sharp(imagePath)
    .rotate()
    .flatten({ background: "#ffffff" })
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mask = Buffer.alloc(info.width * info.height, 255);
  let color = "#000000";

  if (ink === "qr") {
    for (let i = 0, p = 0; i < data.length; i += 3, p++) {
      if ((data[i] + data[i + 1] + data[i + 2]) / 3 < 128) mask[p] = 0;
    }
  } else {
    color = dominantInkColor(data);
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const primary = Math.max(r, g, b) === r ? 0 : Math.max(r, g, b) === g ? 1 : 2;
    const colored = Math.max(r, g, b) - Math.min(r, g, b) > 36;
    const { colored: colorCut, neutral } = INK_THRESHOLDS[ink];
    for (let i = 0, p = 0; i < data.length; i += 3, p++) {
      const pr = data[i];
      const pg = data[i + 1];
      const pb = data[i + 2];
      const light = (pr + pg + pb) / 3;
      const strength =
        primary === 0
          ? pr - (pg + pb) / 2
          : primary === 1
            ? pg - (pr + pb) / 2
            : pb - (pr + pg) / 2;
      const isInk = colored
        ? light < 252 && strength >= colorCut
        : light <= neutral;
      if (isInk) mask[p] = 0;
    }
  }

  const pgm = Buffer.concat([
    Buffer.from(`P5\n${info.width} ${info.height}\n255\n`),
    mask,
  ]);
  return { pgm, color };
};

/** Forces the SVG to declare the source image size in pixels. */
const setSvgSize = (svg: string, width: number, height: number) =>
  svg.replace(/<svg\b[^>]*>/i, (open) => {
    let tag = open
      .replace(/\swidth="[^"]*"/i, "")
      .replace(/\sheight="[^"]*"/i, "");
    if (!/viewBox=/i.test(tag)) {
      tag = tag.replace(/<svg/i, `<svg viewBox="0 0 ${width} ${height}"`);
    }
    return tag.replace(/<svg/i, `<svg width="${width}" height="${height}"`);
  });

const addWhiteBackground = (svg: string) =>
  svg.replace(
    /(<svg\b[^>]*>)/i,
    `$1<rect data-background="true" width="100%" height="100%" fill="#ffffff"/>`,
  );

export const vectorizeImage = async (
  _event: IpcMainInvokeEvent,
  { imagePath, type, background }: VectorizePayload,
): Promise<VectorizeResult> => {
  const recipe = RECIPES[type];
  const workDir = getToolTempDir("vector");
  const outputPath = join(workDir, uniqueName("output", "svg"));
  const { width, height } = await sharp(imagePath).rotate().metadata().then((m) => {
    const swap = (m.orientation ?? 1) >= 5;
    return { width: swap ? m.height! : m.width!, height: swap ? m.width! : m.height! };
  });

  let inputPath = "";
  try {
    if (recipe.engine === "potrace") {
      const { pgm, color } = await buildInkMask(imagePath, recipe.ink);
      inputPath = join(workDir, uniqueName("input", "pgm"));
      await fs.promises.writeFile(inputPath, pgm);
      await execFileAsync(
        getBinaryPath("potrace"),
        ["--svg", "--blacklevel", "0.5", ...recipe.args, "--color", color, "--output", outputPath, inputPath],
        { windowsHide: true, maxBuffer: 100 * 1024 * 1024 },
      );
    } else {
      // vtracer reads PNG reliably; normalise every input format to PNG
      inputPath = join(workDir, uniqueName("input", "png"));
      await sharp(imagePath).rotate().png().toFile(inputPath);
      await execFileAsync(
        getBinaryPath("vtracer"),
        ["--input", inputPath, "--output", outputPath, ...recipe.args],
        { windowsHide: true, maxBuffer: 100 * 1024 * 1024 },
      );
    }

    let svg = setSvgSize(await fs.promises.readFile(outputPath, "utf8"), width, height);
    if (background === "white") svg = addWhiteBackground(svg);

    logit("✅ Vectorized: ", type, svg.length, "bytes");
    return {
      svg,
      pathCount: (svg.match(/<path\b/gi) || []).length,
      bytes: Buffer.byteLength(svg, "utf8"),
      width,
      height,
    };
  } finally {
    await Promise.all(
      [inputPath, outputPath]
        .filter(Boolean)
        .map((file) => fs.promises.unlink(file).catch(() => undefined)),
    );
  }
};

/** Renders an SVG to a single-page PDF sized to the artwork. */
export const exportSvgToPdf = async (
  _event: IpcMainInvokeEvent,
  { svg }: ExportPdfPayload,
) => {
  if (!svg.includes("<svg")) throw new Error("SVG không hợp lệ.");
  const clean = svg.replace(/^\s*<\?xml[^>]*\?>\s*/i, "");
  const size = (name: string) =>
    Math.max(
      1,
      Math.round(
        Number(clean.match(new RegExp(`<svg\\b[^>]*\\b${name}="([\\d.]+)`, "i"))?.[1]) || 1024,
      ),
    );
  const width = size("width");
  const height = size("height");
  const htmlPath = join(getToolTempDir("vector"), uniqueName("pdf", "html"));
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:${width}px ${height}px;margin:0}html,body{width:${width}px;height:${height}px;margin:0;overflow:hidden}svg{display:block;width:${width}px;height:${height}px}</style></head><body>${clean}</body></html>`;

  const pdfWindow = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  try {
    await fs.promises.writeFile(htmlPath, html, "utf8");
    await pdfWindow.loadFile(htmlPath);
    const pdf = await pdfWindow.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: "none" },
    });
    return new Uint8Array(pdf);
  } finally {
    if (!pdfWindow.isDestroyed()) pdfWindow.destroy();
    await fs.promises.unlink(htmlPath).catch(() => undefined);
  }
};
