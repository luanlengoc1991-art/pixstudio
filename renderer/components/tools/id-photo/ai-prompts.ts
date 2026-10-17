// Options and prompts of "Ảnh thẻ AI", taken from pixAI 1.2.6 (AGPL-3.0).

export const AGE_GROUPS = [
  { value: "child", label: "Trẻ em" },
  { value: "teen", label: "Thanh niên / SV" },
  { value: "adult", label: "Đi làm / Trung niên" },
  { value: "senior", label: "Lão niên" },
];

export const OUTFITS = [
  { value: "keep", label: "Giữ nguyên", prompt: "" },
  { value: "white-shirt", label: "Sơ mi trắng", prompt: "clean crisp professional formal white collared dress shirt" },
  { value: "blue-shirt", label: "Sơ mi xanh nhạt", prompt: "light blue tailored collared dress shirt" },
  { value: "suit", label: "Suit / Vest đen", prompt: "elegant dark professional business suit jacket / blazer over a neat white collared shirt" },
  { value: "ao-dai", label: "Áo dài truyền thống", prompt: "traditional elegant white Vietnamese Ao Dai with high mandarin collar" },
  { value: "polo", label: "Áo polo có cổ", prompt: "neat solid-color polo shirt with collar" },
];

export const HAIRSTYLES = [
  { value: "keep", label: "Giữ nguyên", prompt: "Keep original hair exactly" },
  { value: "tidy-short", label: "Ngắn gọn gàng", prompt: "Neat, clean-cut professional short hair with ears clearly visible" },
  { value: "side-part", label: "Rẽ ngôi 7/3", prompt: "Classic polished 7/3 side part hairstyle, neatly styled" },
  { value: "office-short", label: "Tóc văn phòng", prompt: "Modern professional office hairstyle, groomed and tidy" },
  { value: "natural-long", label: "Dài tự nhiên", prompt: "Natural neat long hair draped gracefully behind shoulders" },
  { value: "high-bun", label: "Búi tóc cao", prompt: "Neat high bun hairstyle, sleek and tidy showing ears and neck" },
  { value: "straight-bangs", label: "Mái bằng", prompt: "Neat straight bangs resting above eyebrows without covering eyes" },
  { value: "soft-curl", label: "Tóc xoăn nhẹ", prompt: "Subtle soft gentle wavy hair, tidy around shoulders" },
];

export const BACKGROUNDS = [
  { value: "blue-vn", label: "Xanh chuẩn CCCD / Hộ chiếu", color: "#008cf7" },
  { value: "blue-dark", label: "Xanh dương đậm", color: "#064e92" },
  { value: "blue-light", label: "Xanh dương nhạt", color: "#1b9cef" },
  { value: "white-intl", label: "Trắng chuẩn Visa", color: "#ffffff" },
  { value: "gray-studio", label: "Xám studio", color: "#e2e8f0" },
];

/** At most this many portraits go to ChatGPT in one message. */
export const BATCH_SIZE = 10;

export type IdPhotoOptions = {
  age: string;
  outfit: string;
  customOutfit: string;
  hasOutfitImage: boolean;
  hair: string;
  background: string;
  beautify: boolean;
  smoothing: number;
  brightness: number;
  extra: string;
};

export const DEFAULT_ID_OPTIONS: IdPhotoOptions = {
  age: "adult",
  outfit: "white-shirt",
  customOutfit: "",
  hasOutfitImage: false,
  hair: "keep",
  background: "#008cf7",
  beautify: true,
  smoothing: 45,
  brightness: 50,
  extra: "",
};

const subject = (age: string) =>
  age === "child" ? "child" : age === "teen" ? "young adult / student" : age === "adult" ? "mature adult" : "senior adult";

const lighting = (brightness: number, flattering: boolean) =>
  brightness === 50
    ? "Balanced even studio lighting."
    : brightness > 50
      ? `Slightly brighter${flattering ? ", flattering" : ""} studio key light (level ${brightness}/100).`
      : `Slightly softer exposure (level ${brightness}/100).`;

export const singleIdPrompt = (o: IdPhotoOptions) => {
  const attire = o.customOutfit.trim() || OUTFITS.find((x) => x.value === o.outfit)?.prompt || "keep original clothing";
  const hair = HAIRSTYLES.find((x) => x.value === o.hair)?.prompt || "Keep original hair";
  const outfitRef = o.hasOutfitImage
    ? " Refer strictly to the uploaded clothing reference image for outfit design, fabrics and color; do not copy its face or identity."
    : "";
  return `Create one complete professional ID / passport photograph from the uploaded source image.

CRITICAL IDENTITY RETENTION:
- Preserve the subject's exact facial structure, eye shape, nose, mouth, jawline, ears, skin tone, and unique facial identity 100% authentically.
- Do NOT alter identifying facial landmarks, do not produce an AI cartoon face, plastic skin, or replace the subject with an unrelated model.

STYLING & COMPOSITION:
- Subject: ${subject(o.age)}. Preserve the authentic biological gender, facial anatomy, and facial landmarks visible in the uploaded image.
- Framing & Aspect Ratio: Vertical 3:4 portrait aspect ratio (standard passport headshot composition). Head, hair, and face centered comfortably in the upper-mid frame, from crown of head down to upper chest/collarbone. Do NOT produce a wide landscape or square photo.
- Pose & Expression: Perfect front straight-on eye-level centered passport composition, upright posture, natural pleasant neutral expression with closed mouth.
- Solid Background: Clean uniform solid flat background in color ${o.background}. No gradient, shadows, or distractions on background.
- Hair: ${hair}.
- Attire / Clothing: ${attire}.${outfitRef}
- Skin Retouching: Gentle professional portrait smoothing = ${o.beautify ? o.smoothing : 0}/100 (remove temporary minor blemishes while keeping authentic skin pore texture, avoid airbrushed plastic look).
- Lighting: ${lighting(o.brightness, true)} Crisp studio strobe lighting, razor sharp eye focus, no harsh shadows.
${o.extra.trim() ? `- Special instructions: "${o.extra.trim()}" (apply only if compatible with realistic ID guidelines).` : ""}

Use the uploaded source image as the primary identity reference and return the final edited ID photo directly without commentary.`;
};

export const batchIdPrompt = (o: IdPhotoOptions, count: number) => {
  const attire = o.customOutfit.trim() || OUTFITS.find((x) => x.value === o.outfit)?.prompt || "neat professional formal dress shirt or suit";
  const hair = HAIRSTYLES.find((x) => x.value === o.hair)?.prompt || "Keep original hair";
  return `Đóng vai là 1 chuyên gia studio ảnh thẻ chuyên nghiệp. Tôi đã tải lên ${count} bức ảnh chân dung (được đánh dấu từ portrait-1 đến portrait-${count}).
BẮT BUỘC TẠO VÀ TRẢ VỀ ĐÚNG ${count} FILE ẢNH THẺ ĐỘC LẬP RIÊNG BIỆT (Mỗi người là 1 file ảnh thẻ riêng tương ứng, tổng cộng đúng ${count} file ảnh thẻ độc lập):

YÊU CẦU CHO TỪNG ẢNH THẺ TƯƠNG ỨNG:
1. GIỮ NGUYÊN 100% DIỆN MẠO, NHẬN DIỆN KHUÔN MẶT THẬT: Giữ nguyên cấu trúc khuôn mặt, mắt, mũi, miệng, tai, màu da và nét mặt đặc trưng của từng người từ ảnh gốc tương ứng (${subject(o.age)}). Tuyệt đối không vẽ hoạt hình, không làm dẹt mặt, không tạo khuôn mặt nhân tạo.
2. PHÔNG NỀN: Nền phẳng đồng nhất một màu ${o.background} chuẩn ảnh thẻ (Solid uniform flat background).
3. BỐ CỤC KHUNG HÌNH DỌC 3:4 CHUẨN: Chụp trực diện ngang tầm mắt (front straight-on eye-level centered passport framing), khung ảnh dọc chuẩn tỉ lệ ảnh thẻ 3:4 (chiều cao gấp 1.33 lần chiều rộng), lấy từ đỉnh đầu đến ngang ngực/vai (khuôn mặt chiếm khoảng 65%-75% chiều cao khung ảnh). Tuyệt đối không tạo ảnh vuông 1:1 hay ảnh ngang.
4. TRANG PHỤC: ${attire}.
5. KIỂU TÓC: ${hair}.
6. LÀM ĐẸP DA: Mịn da tự nhiên mức ${o.beautify ? o.smoothing : 0}/100, khử khuyết điểm nhỏ nhưng giữ kết cấu da thật.
7. ÁNH SÁNG: ${lighting(o.brightness, false)} Ánh sáng studio đều, rõ nét từng chi tiết mắt và tóc.
${o.extra.trim() ? `Yêu cầu thêm: "${o.extra.trim()}"` : ""}

BẮT BUỘC: Xuất đầy đủ và trả về đúng ${count} file ảnh thẻ độc lập riêng biệt tương ứng với ${count} ảnh đã tải lên!`;
};
