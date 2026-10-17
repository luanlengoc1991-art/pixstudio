// Prompts of "Thiết kế quảng cáo", adapted from pixAI 1.2.6 (AGPL-3.0).
import { DECOR_STYLES, DIMENSIONS, EVENT_TYPES, PUBLICATIONS, SETUP_TYPES, TEXT_POSITIONS, VENUES } from "./data";

export type DesignMode = "advertising" | "event";

export type AdForm = {
  mode: DesignMode;
  // Advertising
  publication: string;
  ratio: string;
  width: string;
  height: string;
  title: string;
  subtitle: string;
  details: string;
  primary: string;
  accent: string;
  direction: string;
  titleFont: string;
  bodyFont: string;
  // Event setup
  eventType: string;
  setupType: string;
  setupScale: string;
  dimensionId: string;
  nickname: string;
  eventAge: string;
  eventDate: string;
  textPosition: string;
  customTextPosition: string;
  includePedestals: boolean;
  includeBalloons: boolean;
  includeStandee: boolean;
  characterStyle: "original" | "chibi";
  eventStyle: string;
  customEventStyle: string;
  venue: string;
  customVenue: string;
};

export const DEFAULT_FORM: AdForm = {
  mode: "advertising",
  publication: "banner",
  ratio: "16:6",
  width: "1920",
  height: "720",
  title: "",
  subtitle: "",
  details: "",
  primary: "",
  accent: "",
  direction: "",
  titleFont: "",
  bodyFont: "",
  eventType: "sinh-nhat",
  setupType: "photobooth",
  setupScale: "standard",
  dimensionId: "10:4",
  nickname: "",
  eventAge: "",
  eventDate: "",
  textPosition: "center",
  customTextPosition: "",
  includePedestals: true,
  includeBalloons: true,
  includeStandee: true,
  characterStyle: "original",
  eventStyle: "de-thuong",
  customEventStyle: "",
  venue: "",
  customVenue: "",
};

/** Reference images of the advertising mode, attached in this order. */
export type AdReferences = {
  documents: { path: string; note: string }[];
  styles: string[];
  font: { path: string; learnFont: boolean; learnEffect: boolean; learnColor: boolean; text: string } | null;
};

/** Reference images of the event mode, attached in this order. */
export type EventReferences = { subjects: string[]; setups: string[]; logos: string[] };

const ratioText = (form: AdForm) => (form.ratio === "Tùy chỉnh" ? `${form.width}x${form.height}` : form.ratio);

export const advertisingPrompt = (form: AdForm, refs: AdReferences) => {
  const publication = PUBLICATIONS.find((p) => p.id === form.publication)?.label ?? form.publication;
  const lines: string[] = [];
  let n = 1;
  refs.documents.forEach(({ note }) => {
    lines.push(
      `- Ảnh ${n++}: Ảnh tài liệu${note.trim() ? ` - ${note.trim()}` : ""}. Dùng làm nguồn tham chiếu nội dung, sản phẩm và chi tiết cần thể hiện.`,
    );
  });
  refs.styles.forEach(() => {
    lines.push(`- Ảnh ${n++}: Ảnh phong cách. Dùng để tham chiếu bố cục, màu sắc, ánh sáng và cảm giác thị giác.`);
  });
  if (refs.font) {
    const learn = [refs.font.learnFont && "font chữ", refs.font.learnEffect && "hiệu ứng chữ", refs.font.learnColor && "màu sắc"].filter(Boolean);
    const learnText = learn.length ? ` Học theo ${learn.join(", ")}.` : "";
    const applyText = refs.font.text.trim() ? ` Áp dụng cho nội dung chữ: "${refs.font.text.trim()}".` : "";
    lines.push(`- Ảnh ${n++}: Ảnh tham chiếu chữ.${learnText}${applyText}`);
  }

  const content = [
    form.title.trim() && `Tiêu đề chính: "${form.title.trim()}"`,
    form.subtitle.trim() && `Nội dung phụ: "${form.subtitle.trim()}"`,
    form.details.trim() && `Thông tin chi tiết: "${form.details.trim()}"`,
  ]
    .filter(Boolean)
    .join("\n");

  return `Tạo trực tiếp một thiết kế quảng cáo hoàn chỉnh, chuyên nghiệp và sẵn sàng sử dụng.

Loại ấn phẩm: ${publication}
Tỷ lệ khung hình: ${ratioText(form)}
${content || "Không yêu cầu chữ/văn bản xuất hiện trên hình ảnh"}
Màu chủ đạo: ${form.primary || "Do AI tự chọn phù hợp ngữ cảnh"}
Màu nhấn: ${form.accent || "Do AI tự chọn bổ trợ hài hòa"}
Phong cách chữ tiêu đề: ${form.titleFont.trim() || "Sans serif đậm, chữ in hoa, nổi bật mạnh mẽ 3D"}
Phong cách chữ nội dung: ${form.bodyFont.trim() || "Sans serif rõ ràng, dễ đọc"}
Bối cảnh và phong cách thiết kế: "${form.direction.trim() || "Hiện đại, chuyên nghiệp, thu hút"}"

Yêu cầu tạo ảnh:
- Tạo hình ảnh cuối cùng trực tiếp, không phân tích, không giải thích và không đề xuất nhiều phương án.
- Sắp xếp nội dung theo đúng thứ bậc thị giác của một ấn phẩm quảng cáo thực tế (nếu có văn bản).
- Giữ đúng nội dung chữ (nếu có), màu sắc, tỷ lệ và phong cách đã cung cấp.
- Tạo bố cục cân đối, chữ dễ đọc (nếu có), hình ảnh chất lượng cao và phù hợp để sử dụng làm quảng cáo.${
    lines.length ? `\n\nẢnh tham chiếu đính kèm:\n${lines.join("\n")}` : ""
  }`;
};

const SCALE_TEXT: Record<string, { label: string; block: string }> = {
  single: {
    label: "1 Tấm chính (Single standalone panel - Không có vách phụ)",
    block: `QUY MÔ SETUP 1 TẤM VÁCH CHÍNH DUY NHẤT (SINGLE STANDALONE BACKDROP PANEL):
    - ĐẶC BIỆT BẮT BUỘC: Toàn bộ thiết kế CHỈ CÓ ĐÚNG 1 TẤM VÁCH FORMEX ĐỘC LẬP DUY NHẤT (Exactly 1 standalone die-cut panel). TUYỆT ĐỐI KHÔNG VẼ THÊM BẤT KỲ TẤM VÁCH NÀO KHÁC (không có vách phụ so le, không có vách cánh gà, không có tầng vách phía sau).
    - Tấm vách chính đặt ngay trung tâm trực diện, kích thước thi công thực tế khoảng 2m–2.4m ngang x 2.4m–2.8m cao (dạng vòm arch cong, vòm bán nguyệt hoặc uốn lượn nghệ thuật theo chủ đề).
    - BỀ MẶT TẤM VÁCH THÔNG THOÁNG TOÀN DIỆN (>95% diện tích mặt vách lộ rõ, không bị che khuất), chữ nổi 3D (tiêu đề sự kiện, tên chủ tiệc) dán nổi to, sắc nét ở vị trí trung tâm vách.
    - Cực kỳ tối giản, tinh tế, dễ dàng bóc tách lấy trọn vẹn 1 layer tấm vách duy nhất để in ấn decal và cắt CNC tấm formex.`,
  },
  compact: {
    label: "Gọn gàng / Tiết kiệm (1–2 tấm vách, mặt thoáng tối đa, tối ưu bóc tách layer)",
    block: `QUY MÔ SETUP GỌN GÀNG & TIẾT KIỆM (COMPACT STREAMLINED SCALE):
   - Kích thước vừa vặn khoảng 2m–2.5m ngang, gồm 1–2 tấm vách formex cắt bế uốn lượn đứng so le nhẹ nhàng.
   - BỀ MẶT TẤM VÁCH THÔNG THOÁNG TỐI ĐA (>90% diện tích vách lộ rõ hoàn toàn, không bị đồ vật che khuất), ưu tiên không gian cho chữ nổi 3D to rõ, sắc nét.
   - Tuyệt đối không nhồi nhét phụ kiện rườm rà. Khung hình căn vừa vặn cận cảnh trực diện ngang tầm mắt (tight centered eye-level framing), không lùi góc máy ra xa.`,
  },
  standard: {
    label: "Tiêu chuẩn (2–3 tấm vách so le, cân đối chuẩn thi công)",
    block: `QUY MÔ SETUP TIÊU CHUẨN CÂN ĐỐI (STANDARD BALANCED SCALE):
   - Kích thước thi công thực tế khoảng 3m–3.5m ngang, gồm 2–3 tấm vách formex cắt bế (vòm cong, bán nguyệt) đứng so le trước - sau.
   - Bố cục thông thoáng, hài hòa; hoa và bóng bay chỉ ôm theo viền mép ngoài của vách, TUYỆT ĐỐI không trùm che kín mặt phẳng vách chính hay che chữ.`,
  },
  grand: {
    label: "Hoành tráng / Sân khấu (Đa tầng vách & cánh gà)",
    block: `QUY MÔ SETUP HOÀNH TRÁNG / SÂN KHẤU LỚN (GRAND MULTI-TIER SCALE):
   - Kích thước rộng 4.5m–6m+, gồm cụm vách vòm trung tâm và các tấm vách cánh gà mở rộng sang 2 bên.
   - Đa tầng lớp vách với độ sâu trước sau rõ rệt, kết hợp hoa bóng nghệ thuật và ánh sáng sân khấu chuyên nghiệp, các tấm vẫn giữ khoảng cách thoáng đãng.`,
  },
};

export const eventPrompt = (form: AdForm, refs: EventReferences) => {
  const event = EVENT_TYPES.find((e) => e.id === form.eventType) ?? EVENT_TYPES[0];
  const setup = SETUP_TYPES.find((s) => s.id === form.setupType) ?? SETUP_TYPES[0];
  const dimension = DIMENSIONS.find((d) => d.id === form.dimensionId) ?? DIMENSIONS[2];
  const scaleId = form.setupScale || "standard";
  const scale = SCALE_TEXT[scaleId] ?? SCALE_TEXT.standard;
  const single = scaleId === "single";
  const small = single || scaleId === "compact";

  const title = form.title.trim() || event.content.headline;
  const direction = form.direction.trim() || event.visualStyle.join(", ");

  let styleLabel = "Tự do (AI tự định hình phù hợp sự kiện)";
  let stylePrompt = "";
  if (form.eventStyle === "custom" && form.customEventStyle.trim()) {
    styleLabel = form.customEventStyle.trim();
    stylePrompt = `Custom aesthetic specified by user: ${form.customEventStyle.trim()}`;
  } else {
    const style = DECOR_STYLES.find((s) => s.id === form.eventStyle);
    if (style) {
      styleLabel = style.label;
      stylePrompt = style.promptDescription;
    }
  }

  let venueLabel = "";
  let venuePrompt = "";
  if (form.venue === "custom" && form.customVenue.trim()) {
    venueLabel = form.customVenue.trim();
    venuePrompt = `Custom venue setting and background environment specified by user: ${form.customVenue.trim()}`;
  } else {
    const venue = VENUES.find((v) => v.id === form.venue);
    if (venue) {
      venueLabel = venue.label;
      venuePrompt = venue.promptDescription;
    }
  }

  const text = [
    `- Tiêu đề chính (chữ nổi 3D lớn nhất): "${title}"`,
    form.subtitle.trim() && `- Tên nhân vật / Tên đôi / Chủ tiệc: "${form.subtitle.trim()}"`,
    form.nickname.trim() && `- Tên gọi ở nhà / Biệt danh (nổi bật): "${form.nickname.trim()}"`,
    form.eventAge.trim() && `- Tuổi / Mốc kỷ niệm (số nổi 3D): "${form.eventAge.trim()}"`,
    form.eventDate.trim() && `- Ngày tháng tổ chức: "${form.eventDate.trim()}"`,
    form.details.trim() && `- Thông tin chi tiết / Địa chỉ: "${form.details.trim()}"`,
  ]
    .filter(Boolean)
    .join("\n");

  const refLines: string[] = [];
  let n = 1;
  refs.subjects.forEach(() => {
    refLines.push(
      form.characterStyle === "chibi"
        ? `- Ảnh ${n++}: Ảnh nhân vật / chủ thể. BẮT BUỘC CHUYỂN ĐỔI SANG DẠNG CHIBI HOẠT HÌNH 3D (Cute 3D stylized Chibi cartoon character cutout standee): vẽ lại nhân vật theo phong cách Chibi 3D dễ thương, đầu to mắt tròn long lanh biểu cảm ngộ nghĩnh, thân hình nhỏ nhắn, màu sắc tươi sáng phỏng theo gương mặt, kiểu tóc và trang phục của nhân vật trong ảnh. Cắt bế theo viền formex (die-cut cutout standee) đứng độc lập ở góc trước sàn.`
        : `- Ảnh ${n++}: Ảnh nhân vật / chủ thể. BẮT BUỘC GIỮ NGUYÊN ẢNH THẬT CHÂN THỰC (Keep 100% original realistic photo appearance, exact face and features - TUYỆT ĐỐI KHÔNG vẽ chibi, không hoạt hình hóa), in ảnh chụp sắc nét và cắt bế theo viền cơ thể (photorealistic die-cut cutout standee) bồi formex đứng độc lập ở góc trước sàn.`,
    );
  });
  refs.setups.forEach(() => {
    refLines.push(`- Ảnh ${n++}: Ảnh mẫu setup thực tế. Tham chiếu cấu trúc tầng vòm, cách phối cụm hoa/bóng và bố cục các tấm formex thực tế.`);
  });
  refs.logos.forEach(() => {
    refLines.push(`- Ảnh ${n++}: Logo / Biểu tượng. Tạo thành biểu tượng 3D gắn nổi trên vách backdrop hoặc bục đôn.`);
  });

  const pedestals = !form.includePedestals
    ? "- Bục đôn: KHÔNG đặt bục đôn trước vách; giữ toàn bộ mặt sàn và chân vách thông thoáng 100% để nhìn rõ toàn bộ mép cắt vách."
    : small
      ? "- Bục đôn: Tối đa 1 bục đôn tròn nhỏ (cylindrical pedestal) đặt nép sát góc rìa sàn, tuyệt đối không che chắn mặt trước tấm vách."
      : "- Bục đôn: 1–2 bục đôn hình trụ tròn nhỏ đặt gọn ở góc rìa sàn phía trước để bánh kem, không chắn ngang chữ hoặc che thân vách chính.";
  const balloons = !form.includeBalloons
    ? "- Bóng bay / Hoa: KHÔNG dùng chùm bóng bay rườm rà; giữ các đường cong biên dạng cắt bế của tấm vách formex lộ rõ, thanh thoát, tinh tế."
    : "- Cụm bóng bay / hoa nghệ thuật: Chỉ uốn lượn ôm sát theo đường viền mép ngoài của các tấm vách; tuyệt đối không che lấp nội dung chữ hoặc che kín mặt vách.";
  const standee =
    !form.includeStandee && refs.subjects.length === 0
      ? "- Standee nhân vật: KHÔNG bố trí standee chắn phía trước."
      : form.characterStyle === "chibi"
        ? "- Standee nhân vật PHONG CÁCH CHIBI 3D: Tấm in formex cắt bế theo viền nhân vật DẠNG CHIBI HOẠT HÌNH 3D DỄ THƯƠNG (Cute stylized 3D cartoon chibi character with large expressive head, small body, bright cheerful colors, based on the uploaded photo), đặt đứng độc lập có chân chống ở một góc bên sàn, tuyệt đối không che chữ hay che vách chính."
        : "- Standee nhân vật ẢNH THẬT NGUYÊN BẢN: Tấm in formex cắt bế theo viền cơ thể GIỮ NGUYÊN ẢNH THẬT CHÂN THỰC CỦA NHÂN VẬT (Photorealistic die-cut cutout standee preserving the exact real face and realistic photo style, DO NOT cartoonize or turn into chibi), đặt đứng độc lập có chân chống ở một góc bên sàn, tuyệt đối không che chữ hay che vách chính.";

  let position = "";
  if (form.textPosition === "custom" && form.customTextPosition.trim()) {
    position = `"${form.customTextPosition.trim()}" (Bắt buộc bố trí chữ chính xác theo vị trí chỉ định này).`;
  } else {
    position = TEXT_POSITIONS.find((p) => p.id === form.textPosition)?.promptDescription ?? "";
  }

  return `Chụp ảnh trực diện (front straight-on eye-level view) một BỘ DECOR TRANG TRÍ SỰ KIỆN THỰC TẾ IN BỒI FORMEX MỎNG, CẮT BẾ THEO FORM VÀ DỰNG CÁC TẤM ĐỘC LẬP (Real-world physical staged event decoration setup using standalone die-cut foam board / PVC panels).

⚠️ NGUYÊN TẮC CỐT LÕI VỀ CẤU TRÚC VẬT LIỆU & THI CÔNG THỰC TẾ (BẮT BUỘC):
1. BẢN CHẤT LÀ CÁC TẤM PHẲNG BỒI FORMEX MỎNG (STANDALONE DIE-CUT FOAM BOARD PANELS):
   - Không phải khối bê tông hay tường đúc dày cộp, mà là các TẤM VÁCH FORMEX MỎNG (độ dày 5mm–10mm) in PP/decal cán màng bồi lên phẳng phiu, mép cạnh được cắt bế (contour die-cut / CNC cut) sắc sảo theo form thiết kế.
   - Mỗi tấm vách là MỘT TẤM ĐỘC LẬP có chân chống đứng tự do phía sau, được xếp so le trước - sau trên sàn (staggered freestanding panels) tạo nên tầng lớp và chiều sâu thị giác rõ rệt.

2. CẮT BẾ THEO FORM BIÊN DẠNG (SHAPE & CONTOUR DIE-CUT):
   - Các tấm vách được cắt bế lượn theo biên dạng: vòm cong (curved arches), vòm bán nguyệt, vách lượn sóng (scalloped waves), vách hình đám mây, vòm đôi so le... Mép cắt bế dứt khoát, thanh thoát.
   - TUYỆT ĐỐI KHÔNG LÀM BANNER VUÔNG VẮNG PHẲNG HAY POSTER IN DÍNH TẤT CẢ VÀO 1 TẤM NỀN DUY NHẤT.

3. ${scale.block}

4. HỆ THỐNG CÁC TẤM VÀ ĐỐI TƯỢNG ĐỘC LẬP (KHÔNG CHE LẤP LẪN NHAU):
   - Lớp vách nền: ${single ? "CHỈ CÓ ĐÚNG 1 TẤM VÁCH NỀN CHÍNH DUY NHẤT TRÊN SÀN, TUYỆT ĐỐI KHÔNG CÓ BẤT KỲ TẤM VÁCH PHỤ HAY CÁNH GÀ NÀO KHÁC." : "Tấm vách vòm formex làm nền chính với bề mặt phẳng rộng, sạch sẽ."}
   ${single ? "" : "- Lớp vách phụ phía trước: 1–2 tấm vách formex cắt bế nhỏ hơn, đứng lệch so le phía trước vách chính."}
   - Lớp chữ nổi formex/mica: Tiêu đề và tên được CẮT BẾ RỜI DÁN NỔI (3D dimensional cut-out lettering with slight thickness & subtle drop shadows). ${position || "Gắn lên nửa trên mặt vách chính, kích thước to rõ ràng."}
   ${standee}
   ${pedestals}
   ${balloons}

5. TỐI ƯU HÓA CHO BÓC TÁCH LAYER (LAYER SEPARATION READY - MINIMAL OCCLUSION):
   - Các tấm vách, chữ nổi 3D, bục đôn và phụ kiện sàn phải có ranh giới rành mạch, phân tách rõ ràng.
   - BỀ MẶT CÁC TẤM VÁCH PHẢI LỘ RÕ TỐI THIỂU >85% DIỆN TÍCH để người dùng dễ dàng bóc tách từng tấm formex độc lập mang đi in ấn và cắt CNC thực tế. Phụ kiện sàn tuyệt đối không che lấp đường biên cắt CNC của vách.

6. BỐI CẢNH KHÔNG GIAN ĐẰNG SAU & MẶT SÀN (VENUE SETTING & ENVIRONMENT):
   - ${venuePrompt || `Không gian bối cảnh đằng sau và mặt sàn tự do: AI tự động định hình không gian phù hợp với tính chất sự kiện "${event.label}", đồng thời giữ mặt sàn và hậu cảnh hài hòa, có chiều sâu thị giác, tôn vinh và làm nổi bật tối đa các tấm vách formex cắt bế độc lập phía trước.`}

---
THÔNG SỐ SETUP SỰ KIỆN:
- Loại sự kiện: ${event.label}
- Kiểu dựng tấm formex: ${setup.label}
- Quy mô setup: ${scale.label}
- Kích thước & Tỷ lệ: ${dimension.label} (${dimension.ratio === "Tùy chỉnh" ? `${form.width}x${form.height}` : dimension.ratio})
- Phong cách decor: ${styleLabel}${stylePrompt ? ` (${stylePrompt})` : ""}
- Bối cảnh không gian đằng sau: ${venueLabel || "Tự do (AI tự định hình theo sự kiện)"}
- Tông màu chủ đạo: ${form.primary || "Tone màu chủ đạo theo ngữ cảnh sự kiện"}
- Tông màu nhấn: ${form.accent || "Tone màu phụ trợ hài hòa"}
- Chữ nổi gắn vách: ${form.titleFont.trim() || "Chữ nổi 3D cắt formex/mica dán nổi trên vách, sắc nét, có bóng đổ nhẹ"}
${position ? `- Vị trí bố trí chữ nổi trên vách: ${position}\n` : ""}- Chi tiết mô tả thêm: "${direction}"

---
NỘI DUNG CHỮ TRÊN BỘ SETUP:
${text}

---
TEXT INTEGRITY — CRITICAL:
- Preserve exactly all user-provided Vietnamese text without modification.
- Do not rewrite, rephrase, translate, or "improve" any names, nicknames, ages, or dates.
- Do not remove or alter Vietnamese diacritics (ă, â, đ, ê, ô, ơ, ư, dấu sắc, huyền, hỏi, ngã, nặng).
- Do not invent extra names, phone numbers, addresses, or random text not provided by user.
- If text cannot fit legibly, reduce decoration rather than altering text.
---

Yêu cầu xuất ảnh:
- Góc máy chụp thẳng trực diện ngang tầm mắt (front straight-on centered eye-level shot), khung hình ôm vừa vặn trọn vẹn cụm backdrop từ trần vòm đến mặt sàn, không zoom ra quá xa làm chữ bị nhỏ.
- Ánh sáng studio sự kiện chuyên nghiệp, bóng đổ nhẹ chân thực giữa các tấm để phân biệt rõ tấm trước và tấm sau.
- Độ phân giải cao, đường viền cắt bế sắc sảo, các tấm và chi tiết tách bạch rõ ràng sẵn sàng cho việc bóc tách layer.${
    refLines.length ? `\n\nẢnh tham chiếu đính kèm:\n${refLines.join("\n")}` : ""
  }`;
};

/** Follow-up edit of the previous design in the same chat. */
export const refineDesignPrompt = (text: string) =>
  `Hãy tinh chỉnh và sửa lại ảnh thiết kế trước đó theo yêu cầu sau: ${text}. Giữ nguyên mọi thứ khác, đặc biệt là nội dung chữ tiếng Việt.`;
