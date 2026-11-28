export interface ExclusionZone {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  name?: string;
  label?: string;
}

export const MAX_DIRECT_LAYERS = 10;
export const LAYERS_PER_BATCH = 5;

export function buildLayerExclusionRules(exclusions: ExclusionZone[] = []): string {
  if (!exclusions.length) return "";
  const count = exclusions.length;
  const list = exclusions
    .map((item, idx) => {
      const name = item.name?.trim();
      const label = item.label || `KHÔNG TÁCH ${idx + 1}`;
      return `- Vùng loại trừ ${idx + 1}: ${name ? `"${name}" (trong khung vàng cam ${label})` : `Mọi chi tiết nằm trong khung vàng cam ${label}`}`;
    })
    .join("\n");
  const english = exclusions
    .map((item, idx) => {
      const name = item.name?.trim();
      return `  - Exclusion Box ${idx + 1}: "${name || `Region inside amber box KHONG TACH ${idx + 1}`}"`;
    })
    .join("\n");

  return `
⚠️ ĐIỀU KIỆN LOẠI TRỪ BẮT BUỘC (VÙNG KHÔNG TÁCH):
Ảnh hướng dẫn đi kèm có ${count} khung viền chữ nhật màu VÀNG CAM kèm nhãn "KHÔNG TÁCH 1"${count > 1 ? `, "KHÔNG TÁCH 2"...` : ""}:
${list}
- TUYỆT ĐỐI KHÔNG bóc tách bất kỳ chi tiết nào nằm trong khung màu vàng cam thành file PNG riêng.
- Mọi chi tiết nằm trong khung màu vàng cam PHẢI ĐƯỢC GIỮ NGUYÊN VẸN trên ảnh nền background (Layer 1).
- TUYỆT ĐỐI XÓA SẠCH 100% khung viền và nhãn màu vàng cam trên tất cả các ảnh xuất ra (chúng chỉ là mặt nạ đánh dấu tạm thời).
[EXCLUSION MASK DIRECTIVE: Keep all elements inside the amber "KHÔNG TÁCH" boxes (${english}) untouched on the background layer; NEVER extract them as separate layers and NEVER draw amber boxes or labels in any output image.]`;
}

export function buildDirectLayerStartPrompt(exclusions: ExclusionZone[] = []): string {
  const exclusionRules = buildLayerExclusionRules(exclusions);
  const referenceNotice = exclusions.length
    ? `\nẢnh 1 là ảnh thiết kế gốc sạch. Ảnh 2 là bản đánh dấu khung vàng cam "KHÔNG TÁCH" để bạn biết vùng phải giữ nguyên trên nền.`
    : "";

  return `Dựa trực tiếp trên ảnh thiết kế gốc, hãy tự nhận diện và bóc tách tối đa 9 cụm đối tượng chính cộng 1 ảnh nền sạch (tối đa 10 layer).${referenceNotice}

QUY TẮC CHIA ĐỢT BẮT BUỘC (ĐỢT 1: TỐI ĐA 5 ẢNH):
- Trong lượt đầu tiên này, CHỈ xuất tối đa ${LAYERS_PER_BATCH} file ảnh độc lập (Layer 1 đến Layer ${LAYERS_PER_BATCH}):
  1. **Ảnh 1 (BẮT BUỘC LÀ BACKGROUND SẠCH)**: Là toàn bộ ảnh thiết kế gốc nhưng đã xóa sạch tất cả các đối tượng sẽ bóc tách và tái tạo phông nền liền mạch tự nhiên (inpainting).
  2. **Ảnh 2 đến Ảnh ${LAYERS_PER_BATCH}**: Tối đa 4 cụm đối tượng chính đầu tiên, mỗi đối tượng là 1 file PNG nền trong suốt thực sự (alpha = 0), giữ nguyên kích thước, màu sắc, hiệu ứng và chữ tiếng Việt, cắt sát mép mịn tự nhiên.
- Nếu tổng số đối tượng + nền ít hơn hoặc bằng ${LAYERS_PER_BATCH} (ví dụ chỉ có nền + 2 hoặc 3 đối tượng), hãy xuất đúng số lượng thực tế rồi ghi rõ câu: **"Đã hoàn tất toàn bộ các layer của ảnh."**
- Nếu vẫn còn các đối tượng tiếp theo (Layer 6 trở đi), hãy dừng ở đúng ${LAYERS_PER_BATCH} ảnh và ghi câu: **"Nhấn Tiếp để xuất đợt layer tiếp theo."**
- KHÔNG gộp nhiều đối tượng vào chung 1 bảng preview/collage; mỗi layer phải là 1 ảnh độc lập.${exclusionRules}`;
}

export function buildDirectLayerNextPrompt(nextLayerIndex: number, exclusions: ExclusionZone[] = []): string {
  if (nextLayerIndex < 2 || nextLayerIndex > MAX_DIRECT_LAYERS) {
    throw new Error("Số layer tiếp theo phải từ 2 đến 10.");
  }
  const endLayer = Math.min(MAX_DIRECT_LAYERS, nextLayerIndex + LAYERS_PER_BATCH - 1);
  const exclusionReminder = exclusions.length
    ? " Tuyệt đối giữ nguyên quy tắc KHÔNG TÁCH các vùng khung vàng cam và không vẽ lại viền vàng cam."
    : "";
  return `Tiếp. Hãy xuất tiếp các cụm đối tượng còn lại từ Layer ${nextLayerIndex} đến tối đa Layer ${endLayer}, mỗi đối tượng là 1 file PNG nền trong suốt thực sự (alpha = 0), không lặp lại Background hay các đối tượng đã xuất ở lượt trước.${exclusionReminder} Nếu đã hết đối tượng cần tách trước khi tới Layer ${endLayer}, hãy dừng ngay khi hết và ghi rõ: **"Đã hoàn tất toàn bộ các layer của ảnh."**`;
}

const COMPLETION_PATTERNS = [
  /đã\s+hoàn\s+tất\s+toàn\s+bộ\s+các\s+layer/i,
  /đã\s+tách\s+hết\s+(?:tất\s+cả|toàn\s+bộ)/i,
  /không\s+còn\s+(?:đối\s+tượng|layer|lớp)\s+nào\s+(?:cần\s+tách|khác)/i,
  /all\s+layers\s+have\s+been\s+(?:extracted|completed)/i,
  /no\s+more\s+(?:layers|objects)\s+to\s+extract/i,
];

const CONTINUE_PATTERNS = [
  /nhấn\s+["“']?tiếp["”']?\s+để\s+xuất/i,
  /gõ\s+["“']?tiếp["”']?/i,
  /đợt\s+layer\s+tiếp\s+theo/i,
];

export function isLayerSequenceComplete(assistantText: string): boolean {
  const normalized = (assistantText || "").trim();
  if (!normalized) return false;
  if (CONTINUE_PATTERNS.some((re) => re.test(normalized))) return false;
  return COMPLETION_PATTERNS.some((re) => re.test(normalized));
}
