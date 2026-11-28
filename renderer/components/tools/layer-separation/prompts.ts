import { ExclusionZone } from "@common/sequential-layers";
import { TEXT_LAYER_TRANSPARENCY_RULES } from "@common/text-layer-prompt";

export type Region = { id: string; x: number; y: number; width: number; height: number; name: string };

export type AnnotationVariant = "target" | "text" | "exclude";

export const AUTO_LAYER_COUNT = 10;

export const autoPrompt = (exclusions: ExclusionZone[] = []) => {
  if (!exclusions.length) {
    return "Đóng vai là 1 chuyên gia thiết kế bóc tách các lớp layer từ 1 ảnh JPG. Tách cho tôi 9 đối tượng chính trong ảnh này và trả về file PNG không nền. Bắt buộc cần có 1 ảnh nền background. Mỗi đối tượng là 1 file ảnh PNG độc lập (tổng cộng 10 file ảnh).";
  }
  const count = exclusions.length;
  const vnList = exclusions
    .map((e, i) => {
      const name = e.name?.trim();
      return `- Vùng loại trừ ${i + 1}: ${name ? `"${name}"` : `Chi tiết trong khung vàng cam KHÔNG TÁCH ${i + 1}`}`;
    })
    .join("\n");
  const enList = exclusions
    .map((e, i) => `  - Exclusion Box ${i + 1}: "${e.name?.trim() || `Region in amber box ${i + 1}`}"`)
    .join("\n");

  return `# QUY TẮC BÓC TÁCH LAYER VÀ ĐIỀU KIỆN LOẠI TRỪ (EXCLUSION MASK)

Bạn là chuyên gia đồ họa bóc tách layer hình ảnh chuyên nghiệp cấp cao.
Nhiệm vụ: Phân tách bức ảnh tôi gửi kèm thành **đúng 10 file ảnh vật lý độc lập** (gồm 9 file ảnh đối tượng PNG trong suốt + 1 file ảnh phông nền background).

⚠️ ĐIỀU KIỆN LOẠI TRỪ QUAN TRỌNG (CÁC VÙNG TUYỆT ĐỐI KHÔNG BÓC TÁCH):
Bức ảnh tôi gửi kèm có ${count} khung viền chữ nhật màu VÀNG CAM kèm nhãn "KHÔNG TÁCH 1"${count > 1 ? ', "KHÔNG TÁCH 2"...' : ""} chỉ định các vị trí bắt buộc GIỮ NGUYÊN TRÊN NỀN:
${vnList}

NGUYÊN TẮC BẮT BUỘC:
1. MẶT NẠ LOẠI TRỪ (EXCLUSION MASK):
- Các khung viền màu vàng cam CHỈ LÀ MẶT NẠ LOẠI TRỪ (EXCLUSION MASK).
- TUYỆT ĐỐI KHÔNG bóc tách riêng bất kỳ chi tiết nào nằm trong các khung vàng cam thành file PNG riêng.
- Các chi tiết trong khung vàng cam PHẢI ĐƯỢC GIỮ NGUYÊN VẸN trên ảnh phông nền (background).

2. CHỌN 9 ĐỐI TƯỢNG CHÍNH KHÁC ĐỂ BÓC TÁCH:
- Hãy tự động phân tích và chọn 9 đối tượng chính KHÁC trong bức ảnh (nằm hoàn toàn bên ngoài các vùng màu vàng cam trên) để xuất 9 file ảnh PNG độc lập với nền trong suốt (transparent background, alpha = 0).
- Cắt sát mép thật từng đối tượng, viền mịn tự nhiên, loại bỏ hoàn toàn nền xung quanh.

3. FILE THỨ 10 — PHÔNG NỀN (BACKGROUND):
- Đây là ảnh phông nền gốc đã bóc 9 đối tượng trên, nhưng PHẢI GIỮ NGUYÊN TOÀN BỘ các chi tiết nằm trong khung vàng cam.
- Tái tạo và lấp đầy tự nhiên (inpainting) các khoảng trống nơi 9 đối tượng bị tách ra.

4. TUYỆT ĐỐI KHÔNG VẼ LẠI ĐƯỜNG VIỀN MÀU VÀNG CAM:
- Xóa sạch 100% mọi đường viền, nhãn đánh dấu, vệt màu vàng cam trên tất cả 10 file ảnh kết quả!

[CRITICAL EXCLUSION DIRECTIVE FOR IMAGE GENERATION:
You MUST generate exactly 10 separate images in total:
- Files 1 to 9: Transparent PNG cutouts of 9 distinct main objects found OUTSIDE the amber/orange boxes. No borders, clean alpha cutouts.
- File 10: Clean background scene with the 9 extracted objects removed and inpainted, BUT with all elements inside the amber boxes kept intact.
The amber/orange boxes labeled "KHÔNG TÁCH" on the input image are EXCLUSION MASKS:
${enList}
DO NOT extract or isolate any elements inside the amber boxes.
DO NOT draw or include any amber/orange borders, lines, or tags in any output images.
ABSOLUTELY ZERO amber/orange borders on all 10 images.]`;
};

export const autoContinuePrompt = (next: number, exclusions: ExclusionZone[] = []) =>
  `Hãy tiếp tục tạo đối tượng thứ ${next} đến ${AUTO_LAYER_COUNT} từ ảnh gốc này thành các file ảnh PNG độc lập không nền.` +
  (exclusions.length
    ? " Lưu ý: Tuyệt đối giữ nguyên các chi tiết trong khung vàng cam (KHÔNG TÁCH) trên ảnh phông nền, không tách chúng thành layer riêng và không vẽ lại viền vàng cam."
    : "");

const regionName = (region: Region, index: number) =>
  region.name.trim() || `Đối tượng trong khung đỏ VÙNG ${index + 1}`;

export const customPrompt = (regions: Region[]) => {
  const e = regions.length;
  const t = e + 1;
  const more = e > 1 ? `, "VÙNG 2"...` : "";
  const list = regions
    .map((r, i) => `- Đối tượng ${i + 1}: ${r.name.trim() ? `"${r.name.trim()}"` : regionName(r, i)} (nằm trong khung đỏ VÙNG ${i + 1})`)
    .join("\n");
  const files = regions
    .map((r, i) => {
      const what = r.name.trim() ? `đối tượng "${r.name.trim()}"` : `đối tượng trong khung đỏ VÙNG ${i + 1}`;
      return `- File ảnh thứ ${i + 1}: Bóc tách CHÍNH XÁC ${what} thành 1 file ảnh PNG độc lập với nền trong suốt (transparent background). Cắt sát mép thật của vật thể, viền mịn tự nhiên (clean alpha border), loại bỏ hoàn toàn khung viền đỏ và nền xung quanh.`;
    })
    .join("\n");
  const english = regions
    .map((r, i) => `  - File ${i + 1}: Transparent PNG of "${r.name.trim() || `Target object in Box ${i + 1}`}". No red borders, clean cut.`)
    .join("\n");

  return `Bạn là một chuyên gia đồ họa bóc tách layer hình ảnh chuyên nghiệp cấp cao.

Bức ảnh tôi gửi kèm có ${e} khung viền chữ nhật/vuông màu đỏ kèm nhãn "VÙNG 1"${more} chỉ định vị trí ${e} đối tượng cần bóc tách:
${list}

NHIỆM VỤ BẮT BUỘC: Bạn PHẢI TẠO TỔNG CỘNG ĐÚNG ${t} FILE ẢNH ĐỘC LẬP (gồm ${e} file ảnh đối tượng được chọn + 1 file ảnh gốc đã mất chỗ tách):

1. ${e} FILE ẢNH ĐỐI TƯỢNG ĐƯỢC CHỌN (FILE 1 ĐẾN FILE ${e}):
${files}

2. FILE THỨ ${t} (ẢNH GỐC ĐÃ MẤT CHỖ TÁCH / BACKGROUND INPAINTING):
- Đây là bức ảnh gốc ban đầu, NHƯNG ĐÃ XÓA BỎ VÀ LẤP ĐẦY TỰ NHIÊN (inpaint/remove) tất cả ${e} đối tượng nằm trong các vùng khoanh đỏ đã chọn ("VÙNG 1"${more}).
- Chỗ các đối tượng bị xóa phải được tái tạo và lấp đầy phông nền liền mạch, tự nhiên như thể các đối tượng đó chưa từng xuất hiện trong ảnh (clean background fill).
- TUYỆT ĐỐI XÓA SẠCH 100% mọi đường viền đỏ, nhãn đỏ, vệt đỏ trên bức ảnh nền này!

⚠️ NGUYÊN TẮC BẮT BUỘC VỀ ĐƯỜNG VIỀN MÀU ĐỎ:
- Các khung viền đỏ trên ảnh gửi kèm CHỈ LÀ MẶT NẠ ĐÁNH DẤU TẠM THỜI (annotation mask).
- TUYỆT ĐỐI KHÔNG ĐƯỢC VẼ LẠI BẤT KỲ ĐƯỜNG VIỀN MÀU ĐỎ NÀO (NO RED BORDER, NO RED OUTLINE, NO RED BOX, NO RED STROKE, NO RED TEXT TAG) trên tất cả ${t} file ảnh kết quả!
- Mọi ảnh kết quả phải 100% sạch sẽ và tự nhiên.

[CRITICAL DIRECTIVE FOR IMAGE GENERATION:
You MUST generate exactly ${t} images in total:
${english}
  - File ${t} (Background scene with target objects removed): The original full image, but with ALL marked target objects cleanly removed and background inpainted naturally (content-aware fill).
The red rectangular bounding boxes and red tags on the input image are ONLY temporary user selection masks.
DO NOT draw or include any red borders, red lines, red boxes, red tags, or red halos in any output images.
ABSOLUTELY ZERO red borders on all ${t} images.]`;
};

export const customContinuePrompt = (regions: Region[], next: number) => {
  const total = regions.length + 1;
  if (next <= regions.length) {
    const rest = regions
      .slice(next - 1)
      .map((r, i) => (r.name.trim() ? `"${r.name.trim()}"` : `đối tượng ${next + i}`))
      .join(", ");
    return `Hãy tiếp tục tạo từ ảnh ${next} đến ${total}: gồm các đối tượng PNG không nền (${rest}) và ảnh cuối cùng (${total}) là ảnh gốc đã mất chỗ tách (đã xóa sạch đối tượng được chọn, lấp đầy nền tự nhiên, tuyệt đối không có viền đỏ).`;
  }
  return `Hãy tạo ảnh thứ ${total}: là ảnh gốc đã mất chỗ tách (xóa sạch các đối tượng trong các vùng khoanh đỏ và lấp đầy phông nền tự nhiên, tuyệt đối không có khung viền đỏ).`;
};

export const textPrompt = (regions: Region[]) => {
  const e = regions.length;
  const total = e + 1;
  const files = regions
    .map((r, i) => {
      const name = r.name.trim();
      const target = name
        ? `riêng các nét chữ của khối typography hoặc slogan "${name}" (trong khung đỏ VÙNG ${i + 1}), không lấy mảng nền của nhãn hoặc bảng chữ`
        : `khối chữ, typography, chữ số hoặc cụm text trong khung đỏ VÙNG ${i + 1}`;
      return `## FILE ${i + 1} — CHỮ / TYPOGRAPHY ${name ? name.toUpperCase() : `CHỮ / VÙNG ${i + 1}`}
- Bóc tách ${target}.
- **LƯU Ý QUAN TRỌNG:** Giữ nguyên kích thước canvas, tỉ lệ và vị trí của cụm chữ trên ảnh gốc. KHÔNG phóng to, thu nhỏ, căn giữa chữ hoặc thêm chi tiết; chỉ các nét chữ và hiệu ứng chữ được giữ, phần khác phải trong suốt (alpha = 0).
- BẮT BUỘC: Giữ nguyên 100% từng nét chữ, font chữ, khoảng cách ký tự, dấu tiếng Việt đầy đủ (hỏi, ngã, sắc, huyền, nặng, mũ, móc) và dấu câu, không được sai chính tả.
- BẢO TỒN HIỆU ỨNG CHỮ: Giữ trọn vẹn màu sắc chữ, gradient, viền nét (stroke), hiệu ứng nổi 3D, ánh kim loại hoặc bóng đổ sát chữ gốc.
- HOÀN TOÀN KHÔNG CÓ NỀN: Mặt nạ alpha bám sát viền chữ, kể cả khe và lòng chữ khép kín (O, A, P, B, D, R); không giữ nền trắng/đen hay bàn cờ caro, không vẽ lại khung đỏ.`;
    })
    .join("\n\n");

  const steps = regions
    .map((r, i) => `- Lượt ${i + 1}: Tạo ảnh PNG khối chữ không nền ${r.name.trim() ? `"${r.name.trim()}"` : `VÙNG ${i + 1}`}.`)
    .join("\n");

  return `# QUY TẮC XUẤT ẢNH BẮT BUỘC — BÓC TÁCH CHỮ KHÔNG NỀN

Bạn phải thực hiện nhiệm vụ bóc tách chữ / typography không nền và xóa chữ khôi phục nền, trả về **đúng ${total} file ảnh vật lý độc lập**, không phải một ảnh ghép tổng hợp.

${TEXT_LAYER_TRANSPARENCY_RULES}

Ảnh tham chiếu 1 là ảnh thiết kế gốc sạch. Ảnh tham chiếu 2 là bản đánh dấu ${e} khung đỏ "VÙNG 1"${e > 1 ? `, "VÙNG 2"...` : ""} chỉ dùng để xác định các cụm chữ cần tách.

${files}

## FILE ${total} — BACKGROUND (ĐÃ XÓA SẠCH CHỮ)
- Giữ nguyên 100% bố cục, tỉ lệ, kích thước và vị trí mọi chi tiết khác của ảnh gốc.
- CHỈ xóa bỏ hoàn toàn ${e > 1 ? `tất cả ${e} cụm chữ` : "cụm chữ"} nằm trong các khung đỏ đã chọn và phục hồi hoàn hảo phần phông nền bị chữ che khuất (inpainting tự nhiên, không vết mờ, không bóng chữ).
- Xóa sạch toàn bộ đường viền đỏ và nhãn đánh dấu.

## EXECUTION STRATEGY
Nếu công cụ tạo ảnh không hỗ trợ xuất đồng thời ${total} ảnh độc lập, hãy thực hiện ${total} lượt xử lý riêng biệt:
${steps}
- Lượt ${total}: Tạo ảnh background đã xóa chữ.`;
};

export const textContinuePrompt = (regions: Region[], next: number) => {
  const total = regions.length + 1;
  if (next <= regions.length) {
    return `Tiếp tục tạo từ ảnh ${next} đến ${total}: mỗi file chữ chỉ chứa nét chữ, dấu tiếng Việt và hiệu ứng chữ trên canvas trong suốt (alpha = 0, kể cả lòng chữ), tuyệt đối không giữ mảng nền phía sau chữ. Giữ nguyên kích thước canvas, vị trí và tỷ lệ chữ. Ảnh cuối cùng (${total}) là file background riêng đã xóa sạch các cụm chữ được chọn. Không tạo lại các file đã có.\n\n${TEXT_LAYER_TRANSPARENCY_RULES}`;
  }
  return `Tạo ảnh thứ ${total}: là ảnh phông nền background đã xóa sạch chữ và phục hồi nền tự nhiên, giữ nguyên 100% bố cục, tỉ lệ, kích thước ảnh gốc và không có khung viền đỏ.`;
};

/** Draws red ("VÙNG n") or amber ("KHÔNG TÁCH n") annotation boxes onto the source image; returns a PNG blob. */
export const annotateImage = async (
  src: string,
  regions: Region[],
  variant: AnnotationVariant = "target",
) => {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const unit = Math.min(canvas.width, canvas.height);
  const line = Math.max(4, Math.round(unit * 0.006));
  const font = Math.max(18, Math.round(unit * 0.028));
  const isExclude = variant === "exclude";
  const boxColor = isExclude ? "#f59e0b" : "#ff0000";
  const textColor = isExclude ? "#0f172a" : "#ffffff";

  regions.forEach((r, i) => {
    const x = r.x * canvas.width;
    const y = r.y * canvas.height;
    const w = r.width * canvas.width;
    const h = r.height * canvas.height;
    ctx.strokeStyle = boxColor;
    ctx.lineWidth = line;
    ctx.strokeRect(x, y, w, h);
    const label = isExclude ? `KHÔNG TÁCH ${i + 1}` : `VÙNG ${i + 1}`;
    ctx.font = `bold ${font}px sans-serif`;
    const pad = Math.round(font * 0.3);
    const tagW = ctx.measureText(label).width + pad * 2;
    const tagH = font + pad * 2;
    const tagY = y - tagH >= 0 ? y - tagH : y;
    ctx.fillStyle = boxColor;
    ctx.fillRect(x - line / 2, tagY, tagW, tagH);
    ctx.fillStyle = textColor;
    ctx.textBaseline = "top";
    ctx.fillText(label, x - line / 2 + pad, tagY + pad);
  });
  return new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
};
