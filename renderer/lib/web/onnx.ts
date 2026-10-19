import type { InferenceSession } from "onnxruntime-web";

// Models are mirrored in the site's R2 bucket and served same-origin by
// functions/models/[name].ts; the browser keeps them in Cache Storage.
const MODEL_BASE = "./models/";
const MODEL_CACHE = "lms-models-v1";
// The runtime's .wasm files exceed the Pages 25 MB file limit, so they load from the CDN
const ORT_VERSION = "1.30.0";
const ORT_WASM = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

let ortPromise: Promise<typeof import("onnxruntime-web")> | null = null;
export const loadOrt = () =>
  (ortPromise ??= import("onnxruntime-web").then((ort) => {
    ort.env.wasm.wasmPaths = ORT_WASM;
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(8, navigator.hardwareConcurrency || 4) : 1;
    return ort;
  }));

const formatMb = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

/** Downloads a model once (with progress) and returns its bytes. */
const fetchModel = async (file: string, onProgress: (message: string) => void) => {
  const url = MODEL_BASE + file;
  const cache = await caches.open(MODEL_CACHE).catch(() => null);
  const cached = await cache?.match(url);
  if (cached) return new Uint8Array(await cached.arrayBuffer());

  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Tải model AI thất bại (HTTP ${response.status}).`);
  const total = Number(response.headers.get("content-length") || 0);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  let last = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const percent = total ? Math.floor((received / total) * 100) : -1;
    if (percent !== last) {
      last = percent;
      onProgress(total ? `Đang tải model AI ${percent}% (lần đầu, ${formatMb(total)})` : `Đang tải model AI ${formatMb(received)}`);
    }
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  await cache?.put(url, new Response(bytes, { headers: { "content-type": "application/octet-stream" } })).catch(() => undefined);
  return bytes;
};

type Loaded = { session: InferenceSession; gpu: boolean };
const sessions = new Map<string, Promise<Loaded>>();
/** Models that failed on WebGPU (unsupported kernels) stay on WebAssembly */
const cpuOnly = new Set<string>();

const createSession = async (file: string, onProgress: (message: string) => void): Promise<Loaded> => {
  const [ort, bytes] = await Promise.all([loadOrt(), fetchModel(file, onProgress)]);
  onProgress("Đang nạp model AI...");
  if ("gpu" in navigator && !cpuOnly.has(file)) {
    try {
      return { session: await ort.InferenceSession.create(bytes, { executionProviders: ["webgpu"] }), gpu: true };
    } catch {
      // No usable adapter; use the CPU build
    }
  }
  return { session: await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] }), gpu: false };
};

/** One session per model file; WebGPU when the browser has it, otherwise WebAssembly. */
const getSession = (file: string, onProgress: (message: string) => void) => {
  let loaded = sessions.get(file);
  if (!loaded) {
    loaded = createSession(file, onProgress);
    loaded.catch(() => sessions.delete(file));
    sessions.set(file, loaded);
  }
  return loaded;
};

export type Model = {
  inputName: string;
  outputName: string;
  run: (input: import("onnxruntime-web").Tensor) => Promise<import("onnxruntime-web").Tensor>;
};

/** Loads a model; runs fall back to WebAssembly when a kernel is missing on WebGPU. */
export const loadModel = async (file: string, onProgress: (message: string) => void): Promise<Model> => {
  const { session } = await getSession(file, onProgress);
  return {
    inputName: session.inputNames[0],
    outputName: session.outputNames[0],
    run: async (input) => {
      const current = await getSession(file, onProgress);
      try {
        const result = await current.session.run({ [current.session.inputNames[0]]: input });
        return result[current.session.outputNames[0]];
      } catch (error) {
        if (!current.gpu) throw error;
        cpuOnly.add(file);
        sessions.delete(file);
        current.session.release().catch(() => undefined);
        const cpu = await getSession(file, onProgress);
        const result = await cpu.session.run({ [cpu.session.inputNames[0]]: input });
        return result[cpu.session.outputNames[0]];
      }
    },
  };
};
