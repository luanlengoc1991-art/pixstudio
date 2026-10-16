export type PhotoSize = {
  key: string;
  label: string;
  hint: string;
  /** Millimetres; null for free cropping */
  widthMm: number | null;
  heightMm: number | null;
};

export const PHOTO_SIZES: PhotoSize[] = [
  { key: "3x4", label: "3x4 cm", hint: "Thẻ SV, bằng lái xe, hồ sơ", widthMm: 30, heightMm: 40 },
  { key: "4x6", label: "4x6 cm", hint: "Hộ chiếu, CCCD, CV xin việc", widthMm: 40, heightMm: 60 },
  { key: "2x3", label: "2x3 cm", hint: "Ảnh thẻ nhỏ, thẻ học sinh", widthMm: 20, heightMm: 30 },
  { key: "visa", label: "Visa 3.5x4.5 cm", hint: "Visa Châu Âu, Hàn, Nhật", widthMm: 35, heightMm: 45 },
  { key: "visa-us", label: "Visa Mỹ 5x5 cm", hint: "Visa Mỹ (2x2 inch), Ấn Độ", widthMm: 50, heightMm: 50 },
  { key: "free", label: "Tự do", hint: "Tùy chỉnh mọi kích thước", widthMm: null, heightMm: null },
];

export type PhotoSource = {
  id: string;
  name: string;
  /** data: or file: URL */
  url: string;
};

export const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

export const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không đọc được ảnh."));
    image.src = url;
  });

export const canvasToBytes = (canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg") =>
  new Promise<ArrayBuffer>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error("Không xuất được ảnh."))),
      type,
      1,
    ),
  );

export const newId = () => Math.random().toString(36).slice(2, 10);
