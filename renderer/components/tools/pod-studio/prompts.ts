export const RESTORE_BG_SWATCHES = [
  { id: "original", name: "Theo ảnh gốc", color: "original" },
  { id: "white", name: "Trắng", color: "#FFFFFF" },
  { id: "black", name: "Đen", color: "#111827" },
  { id: "red", name: "Đỏ tươi", color: "#DC2626" },
  { id: "blue", name: "Xanh dương", color: "#2563EB" },
  { id: "green", name: "Xanh lá", color: "#16A34A" },
  { id: "orange", name: "Cam", color: "#EA580C" },
];

export const POD_PRODUCT_PRESETS = [
  "Áo thun trắng cổ tròn",
  "Áo thun Oversize streetwear",
  "Áo Hoodie có mũ",
  "Áo Sweater nỉ",
  "Cốc sứ trắng 11oz",
  "Ly giữ nhiệt Tumbler 20oz",
  "Túi vải Canvas Tote",
  "Tranh Canvas bọc gỗ",
  "Poster lồng khung kính",
  "Mũ lưỡi trai",
  "Ốp lưng điện thoại",
];

export const POD_SCENE_CHIPS = [
  "Chụp phẳng studio (Không người mẫu)",
  "Trải sàn Flat Lay kèm phụ kiện",
  "Treo móc gỗ boutique",
  "Người mẫu mặc dạo phố",
  "Đặt trên bàn làm việc văn phòng",
  "Ánh sáng tự nhiên ấm áp",
  "Gấp gọn gàng tối giản",
];

export const POD_PRODUCT_COLORS = [
  { id: "white", name: "Trắng (White)", color: "#FFFFFF" },
  { id: "black", name: "Đen (Black)", color: "#111827" },
  { id: "heather_grey", name: "Xám tiêu (Grey)", color: "#9CA3AF" },
  { id: "sand", name: "Nâu be (Sand)", color: "#D2B48C" },
  { id: "navy", name: "Xanh Navy", color: "#1E3A8A" },
  { id: "military_green", name: "Xanh rêu", color: "#3F6212" },
  { id: "dark_brown", name: "Nâu đất", color: "#451A03" },
  { id: "light_pink", name: "Hồng pastel", color: "#FBCFE8" },
];

export const POD_PLACEMENTS = [
  { value: "front_center", label: "Giữa ngực lớn", hint: "Khổ in A3/A4 mặt trước nổi bật" },
  { value: "left_chest", label: "Ngực trái nhỏ", hint: "Logo/họa tiết nhỏ góc ngực áo" },
  { value: "back_full", label: "Mặt lưng to", hint: "In toàn bộ mảng lưng áo sau" },
  { value: "full_wrap", label: "In tràn quanh thân", hint: "Bao phủ 360° (cốc/tumbler)" },
];

export const RESTORE_STEPS = [
  "Đang tải ảnh mẫu & nhận diện họa tiết thiết kế...",
  "Đang khử góc nghiêng, bóng mờ & nắn phẳng nét vẽ...",
  "Đang phục hồi font chữ, dấu tiếng Việt & đồ họa sắc nét chuẩn in...",
  "Đang xử lý tách nền PNG trong suốt chuẩn DTG/DTF...",
  "Đang hoàn thiện file in POD chất lượng cao...",
];

export const MOCKUP_STEPS = [
  "Đang nạp Bản vẽ thiết kế & cấu hình phôi sản phẩm...",
  "Đang tạo dựng sản phẩm & chất liệu vải/gốm sứ chuẩn xác...",
  "Đang nắn góc phối cảnh, tính toán độ cong & nếp nhăn bề mặt...",
  "Đang hòa trộn thớ vải in DTG & ánh sáng môi trường thực tế...",
  "Đang hoàn thiện ảnh Mockup POD thương mại điện tử Etsy / Amazon...",
];

export function buildPodRestorePrompt(
  mode: "transparent" | "solid",
  solidColor = "original",
  colorLabel?: string,
): string {
  const base = `You are an elite vector artist, print production specialist, and Print-On-Demand (POD) graphic restoration master.

Analyze the uploaded image (which may be a photo of an old shirt, mug, poster, low-res artwork, or angled decal). Recreate the artwork as a crisp, ultra-high-resolution, perfectly flat graphic ready for direct POD manufacturing.

GRAPHIC FIDELITY & DETAIL PRESERVATION:
- Faithfully preserve all text, typography, lettering styles, quotes, names, numbers, illustrations, and brand graphics.
- Correct any blurred letters or artifacts while strictly preserving accurate Vietnamese diacritics and English spelling.
- Render all line art, contours, and graphic elements with vector-like sharpness and clean edges.
- Ensure the design is perfectly flat, front-facing, undistorted, without tilts, lens curve, wrinkles, or photograph artifacts.`;

  if (mode === "transparent") {
    return `${base}

BACKGROUND ISOLATION (TRANSPARENT PNG):
- Completely REMOVE the background fabric, shirt texture, paper, photo backdrop, and all background noise.
- Output ONLY the isolated graphic and typography elements on a pure, clean transparent background (alpha PNG, NOT checkerboard).
- No background color blocks, no bounding boxes, no stray pixels around the contours. Ready for DTG / DTF garment printing.
Generate the final result as an image. Do not ask follow-up questions.`;
  }

  if (solidColor && solidColor !== "original") {
    const desc = colorLabel ? `${colorLabel} (${solidColor})` : solidColor;
    return `${base}

BACKGROUND COLOR SPECIFICATION:
- Reconstruct the design with a flat, clean, solid ${desc} background.
- Ensure all typography and graphics have strong, harmonious contrast against the ${desc} background.
Generate the final result as an image. Do not ask follow-up questions.`;
  }

  return `${base}

BACKGROUND SPECIFICATION:
- Faithfully restore the original graphic colors, gradient tones, and clean background styling as a flat high-resolution artwork.
Generate the final result as an image. Do not ask follow-up questions.`;
}

export function buildPodMockupPrompt(opts: {
  productPrompt: string;
  productColorName: string;
  productColorHex: string;
  placement: string;
  hasCustomBlank: boolean;
}): string {
  const placementDesc =
    opts.placement === "left_chest"
      ? "positioned neatly on the left chest pocket area as a subtle, stylish emblem"
      : opts.placement === "back_full"
        ? "prominently centered across the upper back of the garment as a bold full-back print"
        : opts.placement === "full_wrap"
          ? "seamlessly wrapping around the cylindrical surface of the drinkware/tumbler"
          : "prominently centered on the front chest / main surface with realistic proportional scale";

  const description =
    opts.productPrompt.trim() || "Áo thun trắng cổ tròn unisex trải phẳng trên nền studio sạch sẽ, không người mẫu";
  const hasHuman = /người mẫu|model|wearing|person|girl|boy|man|woman/i.test(description);

  const primaryInstruction = opts.hasCustomBlank
    ? `CRITICAL DUAL-IMAGE INSTRUCTION:
- Use Image 1 strictly as the 2D artwork / graphic design reference.
- Use Image 2 strictly as the target product / blank item / scene.
- Seamlessly install the artwork from Image 1 onto the blank product in Image 2.`
    : `PRIMARY INSTRUCTION:
- Use Image 1 strictly as the 2D artwork / graphic design reference.
- Generate a brand new, ultra-realistic commercial POD mockup matching the following description:
"${description}"`;

  return `${primaryInstruction}

PRODUCT SPECIFICATION & CONTEXT:
- User Description: "${description}"
- Product Base Color: ${opts.productColorName} (${opts.productColorHex})
STRICT COLOR ACCURACY: The fabric / base surface of the product MUST be strictly ${opts.productColorName} (${opts.productColorHex}).${
    hasHuman
      ? ""
      : "\nABSOLUTE NEGATIVE CONSTRAINT: NO HUMAN MODEL, NO PERSON, NO BODY, NO HEAD, NO FACE, NO HANDS, NO LIMBS, NO MANNEQUIN. Feature ONLY the standalone product item."
  }
- Print Placement: ${placementDesc}

ARTWORK INTEGRITY PRIORITY (NON-NEGOTIABLE):
- Perfectly preserve all text (including Vietnamese diacritics), typography, fonts, brand illustrations, characters, and colors from Image 1.
- Do not distort, alter, misspell, or invent new graphics. 100% faithful to the artwork in Image 1.

PHYSICAL REALISM & FABRIC INTEGRATION:
- The artwork must look authentically printed using professional Direct-to-Garment (DTG) or sublimation technique.
- Naturally bend, wrap, and deform along organic wrinkles, folds, and cylindrical curves.
- Subtly show natural textile weave texture through the ink layer so it appears physically manufactured, never like a flat digital sticker.
- Harmonize with ambient light, cast realistic drop shadows, and soft ambient occlusion.

OUTPUT:
One photorealistic, commercial-grade e-commerce mockup photograph ready to convert sales on Etsy, Shopify, and Amazon. Do not ask follow-up questions.`;
}
