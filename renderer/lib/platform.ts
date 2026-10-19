// The renderer is built twice: for the Electron app, and as the website
// (`npm run build:web`). The flag is fixed at build time so the prerendered
// HTML and the hydrated page agree.
export const IS_WEB = process.env.NEXT_PUBLIC_LMS_WEB === "1";

/** Upscale models with an ONNX build the website can run (see lib/web/upscale.ts) */
export const WEB_UPSCALE_MODEL_IDS = ["upscayl-standard-4x", "upscayl-lite-4x"];

export const DOWNLOAD_APP_URL = "https://github.com/luanlengoc1991-art/pixstudio/releases/latest";

/** URL of a file bundled in renderer/public. */
export const publicSrc = (path: string) => (IS_WEB ? `./${path}` : `public:///${path}`);

/** URL of a file handed out by the app: a path on disk, or an in-memory file on the web. */
export const localFileSrc = (sanitizedPath: string) =>
  IS_WEB ? window.electron.fileUrl(sanitizedPath) : `file:///${sanitizedPath}`;
