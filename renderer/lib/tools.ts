import {
  Box,
  Eraser,
  History,
  IdCard,
  ImageUpscale,
  Layers,
  LucideIcon,
  Megaphone,
  PackageCheck,
  PenTool,
  Scissors,
  Shirt,
  Store,
  FileImage,
} from "lucide-react";

export type ToolId =
  | "upscayl"
  | "remove-bg"
  | "layer-separation"
  | "print-restoration"
  | "old-photo-restoration"
  | "die-cut"
  | "product-retoucher"
  | "render-2d-to-3d"
  | "fake-model"
  | "signboard-mockup"
  | "id-photo"
  | "ad-designer"
  | "vector";

export type ToolInfo = {
  id: ToolId;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile */
  tint: string;
  /** "soon" tools are listed on the home screen but not usable yet */
  status: "ready" | "soon";
  /** "local" runs on this computer, "chatgpt" goes through the ChatGPT window */
  engine: "local" | "chatgpt";
};

// Order and wording follow the pixAI 1.2.6 home screen
export const TOOLS: ToolInfo[] = [
  {
    id: "upscayl",
    title: "Kích nét ảnh",
    description:
      "Tăng độ sắc nét, cải thiện chi tiết và chất lượng ảnh mờ, thiếu nét.",
    icon: ImageUpscale,
    tint: "bg-sky-500/15 text-sky-600 dark:text-sky-300",
    status: "ready",
    engine: "local",
  },
  {
    id: "remove-bg",
    title: "Xóa Nền PNG",
    description:
      "Tự động tách nền nhanh chóng, chính xác và giữ nguyên chi tiết chủ thể.",
    icon: Eraser,
    tint: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    status: "ready",
    engine: "local",
  },
  {
    id: "layer-separation",
    title: "Bóc Tách Layer",
    description:
      "Tự động phân tách ảnh thành 10 lớp PNG không nền, hoặc khoanh vùng đối tượng cần tách.",
    icon: Layers,
    tint: "bg-violet-500/15 text-violet-600 dark:text-violet-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "print-restoration",
    title: "Phục hồi ấn phẩm",
    description:
      "Tái tạo biển bảng, banner cũ từ ảnh chụp thành bản thiết kế phẳng sắc nét chuẩn in 4K.",
    icon: FileImage,
    tint: "bg-orange-500/15 text-orange-600 dark:text-orange-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "product-retoucher",
    title: "Retoucher sản phẩm",
    description:
      "Xóa tạp chất, tối ưu ánh sáng & thay phông studio chuẩn E-commerce.",
    icon: PackageCheck,
    tint: "bg-teal-500/15 text-teal-600 dark:text-teal-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "render-2d-to-3d",
    title: "Render 2D sang 3D",
    description:
      "Dựng bản vẽ, nhãn mác bao bì 2D thành ảnh sản phẩm 3D thương mại chân thực.",
    icon: Box,
    tint: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "vector",
    title: "Chuyển Vector",
    description:
      "Trace ảnh màu hoặc đen trắng thành file SVG, dùng được cho in ấn và thiết kế.",
    icon: PenTool,
    tint: "bg-pink-500/15 text-pink-600 dark:text-pink-300",
    status: "ready",
    engine: "local",
  },
  {
    id: "ad-designer",
    title: "Thiết kế quảng cáo",
    description:
      "Lên bố cục banner, poster và ấn phẩm quảng cáo trong một studio trực quan.",
    icon: Megaphone,
    tint: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "fake-model",
    title: "Fake Model AI",
    description:
      "Ghép dáng mẫu từ Ảnh 1, giữ nguyên khuôn mặt, vóc dáng & trang phục Ảnh 2.",
    icon: Shirt,
    tint: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "signboard-mockup",
    title: "Phối cảnh biển hiệu",
    description:
      "Gắn bản thiết kế biển hiệu 2D vào ảnh mặt tiền thực tế, chuẩn phối cảnh & bóng đổ 3D.",
    icon: Store,
    tint: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "old-photo-restoration",
    title: "Phục hồi ảnh cũ",
    description:
      "Khử xước, vá rách, tẩy ố mốc, tăng nét chi tiết & tô màu chân dung tự nhiên.",
    icon: History,
    tint: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
    status: "ready",
    engine: "chatgpt",
  },
  {
    id: "die-cut",
    title: "Bế file in ấn",
    description:
      "Tạo đường viền dao cắt decal tự động theo hình, bo tròn hoặc chữ nhật, xuất PNG và SVG.",
    icon: Scissors,
    tint: "bg-red-500/15 text-red-600 dark:text-red-300",
    status: "ready",
    engine: "local",
  },
  {
    id: "id-photo",
    title: "Chỉnh sửa ảnh thẻ",
    description:
      "Cắt ảnh thẻ chuẩn 3x4, 4x6, Visa và xếp in lên khổ 10x15, A4. Đổi trang phục & phông nền bằng AI (sắp có).",
    icon: IdCard,
    tint: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
    status: "ready",
    engine: "local",
  },
];

export const getTool = (id: ToolId) => TOOLS.find((tool) => tool.id === id)!;
