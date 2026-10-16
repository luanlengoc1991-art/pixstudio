import { app, IpcMainInvokeEvent } from "electron";
import fs from "fs";
import https from "https";
import { join, parse } from "path";
import sharp from "sharp";
import * as ort from "onnxruntime-node";
import { getMainWindow } from "../main-window";
import logit from "../utils/logit";
import { ELECTRON_COMMANDS } from "../../common/electron-commands";
import {
  BackgroundRemovalModel,
  RemoveBackgroundPayload,
} from "../../common/types/types";

type ModelSpec = {
  file: string;
  url: string;
  size: number;
  mean: [number, number, number];
  std: [number, number, number];
};

// Models published with rembg (MIT): https://github.com/danielgatis/rembg
const MODEL_SPECS: Record<BackgroundRemovalModel, ModelSpec> = {
  general: {
    file: "isnet-general-use.onnx",
    url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-general-use.onnx",
    size: 1024,
    mean: [0.5, 0.5, 0.5],
    std: [1, 1, 1],
  },
  portrait: {
    file: "u2net_human_seg.onnx",
    url: "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net_human_seg.onnx",
    size: 320,
    mean: [0.485, 0.456, 0.406],
    std: [0.229, 0.224, 0.225],
  },
};

const sessions = new Map<BackgroundRemovalModel, ort.InferenceSession>();

const sendProgress = (message: string) =>
  getMainWindow()?.webContents.send(
    ELECTRON_COMMANDS.REMOVE_BACKGROUND_PROGRESS,
    message,
  );

const download = (url: string, dest: string): Promise<void> =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.headers.location) {
          res.resume();
          download(res.headers.location, dest).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`Tải model thất bại (HTTP ${res.statusCode})`));
          return;
        }
        const total = Number(res.headers["content-length"] || 0);
        let received = 0;
        let lastPercent = -1;
        const tmp = `${dest}.part`;
        const out = fs.createWriteStream(tmp);
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          const percent = total ? Math.floor((received / total) * 100) : 0;
          if (percent !== lastPercent) {
            lastPercent = percent;
            sendProgress(`Đang tải model AI ${percent}%`);
          }
        });
        res.pipe(out);
        out.on("finish", () => {
          out.close();
          fs.renameSync(tmp, dest);
          resolve();
        });
        out.on("error", (error) => {
          fs.rmSync(tmp, { force: true });
          reject(error);
        });
      })
      .on("error", reject);
  });

const getSession = async (model: BackgroundRemovalModel) => {
  const cached = sessions.get(model);
  if (cached) return cached;
  const spec = MODEL_SPECS[model];
  const dir = join(app.getPath("userData"), "models", "background-removal");
  fs.mkdirSync(dir, { recursive: true });
  const modelPath = join(dir, spec.file);
  if (!fs.existsSync(modelPath)) {
    logit("⬇️ Downloading background removal model: ", spec.url);
    await download(spec.url, modelPath);
  }
  sendProgress("Đang nạp model AI...");
  const session = await ort.InferenceSession.create(modelPath);
  sessions.set(model, session);
  return session;
};

const parseHexColor = (hex: string) => {
  const value = hex.replace("#", "");
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const removeBackground = async (
  _event: IpcMainInvokeEvent,
  payload: RemoveBackgroundPayload,
): Promise<string> => {
  const { imagePath, outputPath, model, background } = payload;
  const spec = MODEL_SPECS[model];
  const session = await getSession(model);

  sendProgress("AI đang tách nền...");
  const source = sharp(imagePath).rotate();
  const { width, height } = await source.metadata().then(async (meta) => {
    // EXIF orientations 5–8 swap width and height after rotate()
    const swapped = (meta.orientation ?? 1) >= 5;
    return {
      width: swapped ? meta.height! : meta.width!,
      height: swapped ? meta.width! : meta.height!,
    };
  });

  const { data: pixels } = await source
    .clone()
    .removeAlpha()
    .resize(spec.size, spec.size, { fit: "fill", kernel: "lanczos3" })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // HWC uint8 -> CHW float32, scaled by the image max like rembg does
  let max = 1e-6;
  for (const value of pixels) if (value > max) max = value;
  const area = spec.size * spec.size;
  const input = new Float32Array(3 * area);
  for (let i = 0; i < area; i++) {
    for (let c = 0; c < 3; c++) {
      input[c * area + i] =
        (pixels[i * 3 + c] / max - spec.mean[c]) / spec.std[c];
    }
  }

  const feeds = {
    [session.inputNames[0]]: new ort.Tensor("float32", input, [
      1,
      3,
      spec.size,
      spec.size,
    ]),
  };
  const results = await session.run(feeds);
  const prediction = results[session.outputNames[0]].data as Float32Array;

  let min = Infinity;
  let top = -Infinity;
  for (let i = 0; i < area; i++) {
    if (prediction[i] < min) min = prediction[i];
    if (prediction[i] > top) top = prediction[i];
  }
  const range = top - min || 1;
  const mask = Buffer.alloc(area);
  for (let i = 0; i < area; i++) {
    mask[i] = Math.round(((prediction[i] - min) / range) * 255);
  }

  sendProgress("Đang hoàn thiện ảnh...");
  const alpha = await sharp(mask, {
    raw: { width: spec.size, height: spec.size, channels: 1 },
  })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .toColourspace("b-w")
    .raw()
    .toBuffer();

  // sharp applies removeAlpha() after joinChannel() regardless of call
  // order, so flatten to raw RGB first and attach the mask to that.
  const rgb = await source.clone().removeAlpha().raw().toBuffer();
  const cutout = sharp(rgb, { raw: { width, height, channels: 3 } }).joinChannel(
    alpha,
    { raw: { width, height, channels: 1 } },
  );

  const { name } = parse(imagePath);
  const suffix = background === "transparent" ? "tach-nen" : "nen-mau";
  const outFile = join(outputPath, `${name}_${suffix}.png`);

  if (background === "transparent") {
    await cutout.png().toFile(outFile);
  } else {
    const cutoutPng = await cutout.png().toBuffer();
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: parseHexColor(background),
      },
    })
      .composite([{ input: cutoutPng }])
      .removeAlpha()
      .png()
      .toFile(outFile);
  }

  logit("✅ Background removed: ", outFile);
  sendProgress("");
  return outFile;
};

export default removeBackground;
