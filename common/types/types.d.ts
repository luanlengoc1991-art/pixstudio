import { ImageFormat } from "@electron/types/types";

export type ImageUpscaylPayload = {
  imagePath: string;
  outputPath: string;
  scale: string;
  model: string;
  gpuId: string;
  saveImageAs: ImageFormat;
  overwrite: boolean;
  compression: string;
  noImageProcessing: boolean;
  customWidth: string;
  useCustomWidth: boolean;
  tileSize: number;
  ttaMode: boolean;
  copyMetadata: boolean;
};

export type DoubleUpscaylPayload = {
  model: string;
  /**
   * The path to the image to upscale.
   */
  imagePath: string;
  outputPath: string;
  scale: string;
  gpuId: string;
  saveImageAs: ImageFormat;
  compression: string;
  noImageProcessing: boolean;
  customWidth: string;
  useCustomWidth: boolean;
  tileSize: number;
  ttaMode: boolean;
  copyMetadata: boolean;
};

export type BackgroundRemovalModel = "general" | "portrait";

export type RemoveBackgroundPayload = {
  imagePath: string;
  outputPath: string;
  model: BackgroundRemovalModel;
  /** "transparent" or a hex colour such as "#ffffff" */
  background: string;
};

export type SaveTempImagePayload = {
  bytes: ArrayBuffer;
  name: string;
};

export type SaveFilePayload = {
  defaultName: string;
  filters: { name: string; extensions: string[] }[];
  /** Exactly one of these is used, in this order */
  sourcePath?: string;
  text?: string;
  bytes?: ArrayBuffer | Uint8Array;
};

export type VectorType =
  | "one-color-logo"
  | "color-logo"
  | "icon"
  | "qr-code"
  | "text"
  | "anime"
  | "portrait"
  | "artwork";

export type VectorizePayload = {
  imagePath: string;
  type: VectorType;
  background: "transparent" | "white";
};

export type VectorizeResult = {
  svg: string;
  pathCount: number;
  bytes: number;
  width: number;
  height: number;
};

export type ExportPdfPayload = { svg: string };

export type DieCutType = "contour" | "all" | "rounded" | "rect";

export type DieCutPayload = {
  imagePath: string;
  cutType: DieCutType;
  offsetMm: number;
  smoothness: "auto" | "smooth" | "very_smooth";
  lineWidth: "thin" | "medium" | "thick";
  lineColor: string;
  background: "transparent" | "white";
};

export type DieCutResult = {
  previewPath: string;
  cutOnlyPath: string;
  svgPath: string;
  widthMm: number;
  heightMm: number;
  usedAi: boolean;
};

export type ChatGptOpenPayload = {
  /** Tool that receives the images downloaded from this request */
  toolId: string;
  imagePaths: string[];
  prompt: string;
};

export type ChatGptStatus = {
  toolId: string;
  state: "loading" | "pasting" | "ready" | "login" | "error";
  message: string;
};

export type ChatGptResult = { toolId: string; path: string };

export type BatchUpscaylPayload = {
  batchFolderPath: string;
  outputPath: string;
  model: string;
  gpuId: string;
  saveImageAs: ImageFormat;
  scale: string;
  compression: string;
  noImageProcessing: boolean;
  customWidth: string;
  useCustomWidth: boolean;
  tileSize: number;
  ttaMode: boolean;
  copyMetadata: boolean;
};
