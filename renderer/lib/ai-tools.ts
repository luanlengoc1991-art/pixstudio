import { ToolId } from "@/lib/tools";

// Phase 2 tools: each one collects images and options, then builds a prompt
// that is pasted into the user's ChatGPT window together with the images.
// Prompts are written in English because image generation follows English
// instructions more closely; the user's own note can be in Vietnamese.

export type ImageSlot = {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
};

export type ChoiceField = {
  type: "choice";
  key: string;
  title: string;
  columns?: 2 | 3 | 4;
  options: { value: string; label: string; hint?: string }[];
};

export type TextField = {
  type: "text";
  key: string;
  title: string;
  placeholder: string;
  required?: boolean;
};

export type AiField = ChoiceField | TextField;

export type AiToolConfig = {
  slots: ImageSlot[];
  fields: AiField[];
  /** Label of the main button */
  action: string;
  /** values holds the selected option of every field (text fields trimmed) */
  buildPrompt: (values: Record<string, string>) => string;
};

const OUTPUT_RULES =
  "Generate the final result as an image. Do not ask follow-up questions; if something is unclear, make the most sensible choice and generate.";

/** Appends the user's free-text note when there is one. */
export const withNote = (prompt: string, note: string) =>
  note.trim()
    ? `${prompt}\n\nAdditional instructions from the user (may be in Vietnamese, follow them): ${note.trim()}`
    : prompt;

const pick = <T extends Record<string, string>>(map: T, key: string) =>
  map[key as keyof T] ?? Object.values(map)[0];

export const AI_TOOLS: Partial<Record<ToolId, AiToolConfig>> = {
  "layer-separation": {
    slots: [{ key: "source", label: "Ảnh gốc", required: true }],
    fields: [
      {
        type: "text",
        key: "subject",
        title: "Đối tượng cần tách",
        placeholder: "Ví dụ: người mặc áo đỏ, chai nước, logo góc trái...",
        required: true,
      },
      {
        type: "choice",
        key: "output",
        title: "Kết quả cần lấy",
        options: [
          { value: "object", label: "Đối tượng PNG", hint: "Chỉ đối tượng, nền trong suốt" },
          { value: "plate", label: "Ảnh nền sạch", hint: "Xóa đối tượng, vá lại nền" },
        ],
      },
    ],
    action: "Tách layer bằng ChatGPT",
    buildPrompt: ({ subject, output }) =>
      output === "plate"
        ? `Remove "${subject}" from the attached image and reconstruct the area behind it so the background looks natural and untouched, as if the object was never there. Keep everything else identical: same framing, resolution, lighting, colors and perspective. ${OUTPUT_RULES}`
        : `Extract only "${subject}" from the attached image as a separate layer on a fully transparent background (PNG with alpha). Keep its exact shape, colors, details and proportions; reconstruct any parts that are hidden by other objects. Clean, precise edges, no halo, no shadow, nothing else from the scene. ${OUTPUT_RULES}`,
  },

  "print-restoration": {
    slots: [{ key: "source", label: "Ảnh chụp biển bảng / banner", required: true }],
    fields: [
      {
        type: "choice",
        key: "mode",
        title: "Cách phục hồi",
        options: [
          { value: "faithful", label: "Giữ nguyên thiết kế", hint: "Bám sát bản gốc" },
          { value: "refresh", label: "Làm mới màu sắc", hint: "Màu tươi, hiện đại hơn" },
        ],
      },
      {
        type: "choice",
        key: "ratio",
        title: "Tỉ lệ bản in",
        columns: 3,
        options: [
          { value: "keep", label: "Như ảnh gốc" },
          { value: "wide", label: "Ngang 3:1" },
          { value: "tall", label: "Dọc 2:3" },
        ],
      },
    ],
    action: "Phục hồi bằng ChatGPT",
    buildPrompt: ({ mode, ratio }) =>
      [
        "The attached photo shows a printed sign, banner or poster, possibly worn, faded, wrinkled, dirty or shot at an angle.",
        "Recreate it as a clean, flat, front-facing print-ready design: correct the perspective, remove reflections, stains, folds and damage, and rebuild every text, logo and graphic with sharp edges.",
        "Reproduce all text exactly as written in the original, including Vietnamese diacritics; do not invent, translate or drop any words.",
        mode === "refresh"
          ? "Keep the same layout and content but refresh the colors so they look vivid and modern."
          : "Match the original layout, fonts, colors and proportions as closely as possible.",
        pick(
          { keep: "Keep the original aspect ratio.", wide: "Use a wide 3:1 landscape format.", tall: "Use a 2:3 portrait format." },
          ratio,
        ),
        "Highest available resolution, no mockup, no background around the design.",
        OUTPUT_RULES,
      ].join(" "),
  },

  "product-retoucher": {
    slots: [{ key: "product", label: "Ảnh sản phẩm", required: true }],
    fields: [
      {
        type: "choice",
        key: "backdrop",
        title: "Phông nền",
        options: [
          { value: "white", label: "Trắng studio", hint: "Chuẩn Shopee, Lazada, Amazon" },
          { value: "grey", label: "Xám nhạt", hint: "Sang trọng, có bóng mềm" },
          { value: "pastel", label: "Pastel", hint: "Màu nhẹ hợp sản phẩm" },
          { value: "lifestyle", label: "Bối cảnh thật", hint: "Đặt trong không gian sử dụng" },
        ],
      },
      {
        type: "choice",
        key: "light",
        title: "Ánh sáng",
        options: [
          { value: "soft", label: "Mềm, đều" },
          { value: "contrast", label: "Tương phản, nổi khối" },
        ],
      },
    ],
    action: "Retouch bằng ChatGPT",
    buildPrompt: ({ backdrop, light }) =>
      [
        "Retouch the product in the attached photo into a professional e-commerce product shot.",
        "Keep the product itself identical: exact shape, proportions, colors, materials, label text and logo (do not redraw or misspell any text).",
        "Remove dust, scratches, fingerprints, stray reflections and background clutter; fix color cast and white balance.",
        pick(
          {
            white: "Place it on a pure white (#FFFFFF) seamless studio background with a soft natural contact shadow.",
            grey: "Place it on a light grey seamless studio background with a soft shadow.",
            pastel: "Place it on a soft pastel studio background whose color complements the product, with a gentle shadow.",
            lifestyle: "Place it in a realistic, tasteful lifestyle setting where the product would be used, with the product as the clear hero.",
          },
          backdrop,
        ),
        light === "contrast"
          ? "Use crisp studio lighting with defined highlights and shadows to show form and texture."
          : "Use soft, even, diffused studio lighting.",
        "Square 1:1 composition, product centered and filling about 80% of the frame.",
        OUTPUT_RULES,
      ].join(" "),
  },

  "render-2d-to-3d": {
    slots: [{ key: "design", label: "Bản vẽ / nhãn mác 2D", required: true }],
    fields: [
      {
        type: "choice",
        key: "packaging",
        title: "Loại sản phẩm",
        columns: 3,
        options: [
          { value: "box", label: "Hộp giấy" },
          { value: "bottle", label: "Chai / lọ" },
          { value: "pouch", label: "Túi zip" },
          { value: "can", label: "Lon" },
          { value: "tube", label: "Tuýp" },
          { value: "auto", label: "Tự nhận" },
        ],
      },
      {
        type: "choice",
        key: "scene",
        title: "Bối cảnh",
        options: [
          { value: "studio", label: "Studio nền trơn" },
          { value: "lifestyle", label: "Bối cảnh thật" },
        ],
      },
    ],
    action: "Render 3D bằng ChatGPT",
    buildPrompt: ({ packaging, scene }) =>
      [
        "The attached image is a flat 2D packaging design / label artwork.",
        pick(
          {
            box: "Apply it to a realistic 3D cardboard box.",
            bottle: "Wrap it as the label of a realistic 3D bottle.",
            pouch: "Print it on a realistic 3D stand-up zip pouch.",
            can: "Wrap it around a realistic 3D aluminium can.",
            tube: "Print it on a realistic 3D squeeze tube.",
            auto: "Choose the most suitable packaging type for this artwork and apply it to a realistic 3D product.",
          },
          packaging,
        ),
        "Map the artwork accurately with correct curvature and perspective; keep every logo, color and text exactly as in the artwork, including Vietnamese diacritics.",
        "Photorealistic commercial product photography with realistic materials, reflections and shadows, three-quarter view.",
        scene === "lifestyle"
          ? "Place it in an appealing real-world setting that suits the product."
          : "Clean seamless studio background in a color that complements the design.",
        OUTPUT_RULES,
      ].join(" "),
  },

  "ad-designer": {
    slots: [{ key: "asset", label: "Ảnh sản phẩm / logo (không bắt buộc)", required: false }],
    fields: [
      {
        type: "text",
        key: "headline",
        title: "Tiêu đề chính",
        placeholder: "Ví dụ: SALE 50% – Mừng khai trương",
        required: true,
      },
      {
        type: "text",
        key: "details",
        title: "Nội dung phụ",
        placeholder: "Thời gian, địa chỉ, số điện thoại, website...",
      },
      {
        type: "choice",
        key: "format",
        title: "Khổ ấn phẩm",
        options: [
          { value: "square", label: "Vuông 1:1", hint: "Bài đăng Facebook, Zalo" },
          { value: "story", label: "Dọc 9:16", hint: "Story, Reels, TikTok" },
          { value: "banner", label: "Ngang 16:9", hint: "Ảnh bìa, màn hình LED" },
          { value: "poster", label: "Poster A4 dọc", hint: "In ấn, tờ rơi" },
        ],
      },
      {
        type: "choice",
        key: "style",
        title: "Phong cách",
        options: [
          { value: "minimal", label: "Hiện đại tối giản" },
          { value: "luxury", label: "Sang trọng" },
          { value: "vivid", label: "Rực rỡ, nổi bật" },
          { value: "festive", label: "Tết, lễ hội" },
        ],
      },
    ],
    action: "Thiết kế bằng ChatGPT",
    buildPrompt: ({ headline, details, format, style, __hasImages }) =>
      [
        "Design a professional advertising graphic.",
        __hasImages === "1"
          ? "Use the attached product photo / logo as the main visual; keep it accurate and do not alter its text or logo."
          : "Create a fitting main visual for the message.",
        `Headline (render exactly, Vietnamese with correct diacritics): "${headline}".`,
        details ? `Secondary text (render exactly): "${details}".` : "",
        pick(
          {
            square: "Format: square 1:1 social media post.",
            story: "Format: vertical 9:16 story.",
            banner: "Format: wide 16:9 banner.",
            poster: "Format: A4 portrait poster (1:√2).",
          },
          format,
        ),
        pick(
          {
            minimal: "Style: modern and minimal, generous white space, clean sans-serif typography.",
            luxury: "Style: luxurious and elegant, dark or deep tones with gold accents, refined serif typography.",
            vivid: "Style: bold, vivid and eye-catching, strong colors and dynamic composition.",
            festive: "Style: Vietnamese Tet / festive, red and gold, apricot and peach blossoms, joyful mood.",
          },
          style,
        ),
        "Clear visual hierarchy, all text legible and spelled exactly as given, no extra invented text.",
        OUTPUT_RULES,
      ]
        .filter(Boolean)
        .join(" "),
  },

  "fake-model": {
    slots: [
      { key: "pose", label: "Ảnh 1 · Dáng mẫu", hint: "Tư thế, bố cục muốn lấy", required: true },
      { key: "person", label: "Ảnh 2 · Người & trang phục", hint: "Khuôn mặt, vóc dáng, quần áo giữ nguyên", required: true },
    ],
    fields: [
      {
        type: "choice",
        key: "background",
        title: "Bối cảnh",
        options: [
          { value: "pose", label: "Theo Ảnh 1" },
          { value: "person", label: "Theo Ảnh 2" },
          { value: "studio", label: "Studio nền trơn" },
          { value: "street", label: "Đường phố" },
        ],
      },
    ],
    action: "Ghép dáng bằng ChatGPT",
    buildPrompt: ({ background }) =>
      [
        "Two images are attached. Image 1 is the pose reference. Image 2 shows the person and the outfit.",
        "Create a photorealistic fashion photo of the person from Image 2 standing in the exact pose, body angle and camera framing of Image 1.",
        "Keep the face, hairstyle, skin tone, body shape and the complete outfit (cut, color, fabric, pattern, accessories) of Image 2 unchanged. Do not take any facial features or clothing from Image 1.",
        pick(
          {
            pose: "Use the background and lighting of Image 1.",
            person: "Use the background and lighting of Image 2.",
            studio: "Use a clean seamless studio background with soft fashion lighting.",
            street: "Use a natural urban street background with daylight.",
          },
          background,
        ),
        "Natural anatomy, realistic fabric folds, consistent lighting.",
        OUTPUT_RULES,
      ].join(" "),
  },

  "signboard-mockup": {
    slots: [
      { key: "design", label: "Thiết kế biển hiệu 2D", required: true },
      { key: "facade", label: "Ảnh mặt tiền thực tế", required: true },
    ],
    fields: [
      {
        type: "choice",
        key: "kind",
        title: "Loại biển",
        options: [
          { value: "lightbox", label: "Hộp đèn" },
          { value: "letters", label: "Chữ nổi mica / inox" },
          { value: "flat", label: "Bạt / Alu phẳng" },
          { value: "neon", label: "Neon" },
        ],
      },
      {
        type: "choice",
        key: "time",
        title: "Thời điểm",
        options: [
          { value: "day", label: "Ban ngày" },
          { value: "night", label: "Ban đêm, đèn sáng" },
        ],
      },
    ],
    action: "Dựng phối cảnh bằng ChatGPT",
    buildPrompt: ({ kind, time }) =>
      [
        "Two images are attached. Image 1 is a flat 2D signboard design. Image 2 is a photo of a real shop facade.",
        "Install the signboard from Image 1 on the facade in Image 2 at the most natural position for a shop sign, matching the facade's perspective, scale and lens.",
        pick(
          {
            lightbox: "Build it as an illuminated lightbox sign with a slim frame.",
            letters: "Build it as 3D raised letters (acrylic / stainless steel) mounted on the facade, with real depth and edges.",
            flat: "Build it as a flat printed panel (banner / aluminium composite) fixed to the wall.",
            neon: "Build the text and graphics as neon tubes on a backing.",
          },
          kind,
        ),
        "Keep the design's text, logo and colors exactly the same (including Vietnamese diacritics). Add realistic shadows, mounting and material reflections.",
        time === "night"
          ? "Show the scene at night with the sign lit and a realistic glow on the surroundings."
          : "Show the scene in daylight with lighting matching the facade photo.",
        "Leave the rest of the facade photo unchanged.",
        OUTPUT_RULES,
      ].join(" "),
  },

  "old-photo-restoration": {
    slots: [{ key: "photo", label: "Ảnh cũ", required: true }],
    fields: [
      {
        type: "choice",
        key: "color",
        title: "Màu sắc",
        options: [
          { value: "colorize", label: "Tô màu tự nhiên" },
          { value: "keep", label: "Giữ màu gốc", hint: "Giữ đen trắng / ngả vàng" },
        ],
      },
      {
        type: "choice",
        key: "strength",
        title: "Mức phục hồi",
        options: [
          { value: "gentle", label: "Nhẹ", hint: "Giữ chất ảnh xưa" },
          { value: "full", label: "Toàn diện", hint: "Nét như ảnh mới chụp" },
        ],
      },
    ],
    action: "Phục hồi bằng ChatGPT",
    buildPrompt: ({ color, strength }) =>
      [
        "Restore the attached old photograph.",
        "Remove scratches, dust, cracks, tears, folds, stains and mould; fill in missing or damaged areas.",
        "Faces must keep the exact identity, features, age and expression of the people in the photo; do not beautify or change anyone.",
        strength === "full"
          ? "Sharpen details so it looks like a high-quality modern photo, while staying faithful to the original."
          : "Keep the authentic look and grain of a vintage photo; only repair damage and gently improve clarity.",
        color === "colorize"
          ? "Colorize it with natural, historically plausible colors and realistic skin tones."
          : "Keep the original color tone (black and white or sepia).",
        "Keep the original framing and composition.",
        OUTPUT_RULES,
      ].join(" "),
  },
};
