// Prompts for "Bóc tách layer", taken from pixAI 1.2.6 (AGPL-3.0) so the
// results match what users already get there.

export type Region = { id: string; x: number; y: number; width: number; height: number; name: string };

export const AUTO_LAYER_COUNT = 10;

export const autoPrompt = () =>
  "Đóng vai là 1 chuyên gia thiết kế bóc tách các lớp layer từ 1 ảnh JPG. Tách cho tôi 9 đối tượng chính trong ảnh này và trả về file PNG không nền. Bắt buộc cần có 1 ảnh nền background. Mỗi đối tượng là 1 file ảnh PNG độc lập (tổng cộng 10 file ảnh).";

export const autoContinuePrompt = (next: number) =>
  `Hãy tiếp tục tạo đối tượng thứ ${next} đến ${AUTO_LAYER_COUNT} từ ảnh gốc này thành các file ảnh PNG độc lập không nền.`;

const regionName = (region: Region, index: number) => region.name.trim() || `Đối tượng trong khung đỏ VÙNG ${index + 1}`;

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

Yêu cầu xuất:
- Trả về đúng ${t} ảnh (${e} ảnh PNG trong suốt không nền cho các đối tượng đã chọn + 1 ảnh gốc đã mất chỗ tách).
- KIỂM TRA LẠI: Đảm bảo không có bất kỳ đường viền đỏ nào trên tất cả ${t} ảnh!

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

/** Draws the red boxes and "VÙNG n" tags on the source image; returns a PNG blob. */
export const annotateImage = async (src: string, regions: Region[]) => {
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
  const font = Math.max(18, Math.round(unit * 0.03));
  regions.forEach((r, i) => {
    const x = r.x * canvas.width;
    const y = r.y * canvas.height;
    const w = r.width * canvas.width;
    const h = r.height * canvas.height;
    ctx.strokeStyle = "#ff0000";
    ctx.lineWidth = line;
    ctx.strokeRect(x, y, w, h);
    const label = `VÙNG ${i + 1}`;
    ctx.font = `bold ${font}px sans-serif`;
    const pad = Math.round(font * 0.3);
    const tagW = ctx.measureText(label).width + pad * 2;
    const tagH = font + pad * 2;
    const tagY = y - tagH >= 0 ? y - tagH : y;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(x - line / 2, tagY, tagW, tagH);
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "top";
    ctx.fillText(label, x - line / 2 + pad, tagY + pad);
  });
  return new Promise<Blob>((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
};
