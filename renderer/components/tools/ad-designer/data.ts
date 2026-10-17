// Option tables of "Thiết kế quảng cáo", taken from pixAI 1.2.6 (AGPL-3.0)
// so the prompts produce the same kind of designs users get there.
import {
  Building2,
  Cake,
  Crown,
  DoorOpen,
  Facebook,
  Flame,
  Gift,
  Heart,
  HeartHandshake,
  Image,
  LayoutPanelTop,
  LucideIcon,
  Mail,

  Mic,
  PanelsTopLeft,
  Presentation,
  RectangleVertical,
  Ruler,
  ShoppingBag,
  Sparkles,
  Store,
  Baby,
  Camera,
  Table2,
} from "lucide-react";

export type Publication = { id: string; label: string; description: string; ratio: string; icon: LucideIcon };

export const PUBLICATIONS: Publication[] = [
  { id: "banner", label: "Banner Web / Ngang", description: "Banner website, header, trang chủ, quảng cáo ngang", ratio: "16:6", icon: LayoutPanelTop },
  { id: "poster", label: "Poster", description: "Poster sự kiện, sản phẩm, truyền thông indoor/outdoor", ratio: "3:4", icon: Image },
  { id: "standee", label: "Standee", description: "Standee dọc cửa hàng, hội chợ, triển lãm", ratio: "6:16", icon: RectangleVertical },
  { id: "backdrop", label: "Backdrop", description: "Backdrop sân khấu, hội thảo, check-in", ratio: "10:4", icon: Presentation },
  { id: "signage", label: "Biển hiệu cửa hàng", description: "Bảng hiệu mặt tiền, hộp đèn, biển LED cửa hàng", ratio: "10:3", icon: Store },
  { id: "facebook", label: "Quảng cáo Facebook", description: "Bài đăng fanpage, bài quảng cáo Feed & Story", ratio: "1:1", icon: Facebook },
  { id: "product", label: "Quảng cáo sản phẩm", description: "Ảnh sản phẩm Shopee, Lazada, TikTok Shop, Instagram", ratio: "4:5", icon: ShoppingBag },
  { id: "thiep", label: "Thiệp mời", description: "Thiệp mời sự kiện, đám cưới, sinh nhật, khai trương", ratio: "3:4", icon: Mail },
  { id: "custom", label: "Thiết kế tùy chỉnh", description: "Tự do nhập kích thước theo yêu cầu", ratio: "Tùy chỉnh", icon: Ruler },
];

export const RATIOS = ["24:1", "1:1", "4:5", "3:4", "6:16", "16:9", "16:6", "10:4", "10:3", "Tùy chỉnh"];

export type Palette = { name: string; primary: string; accent: string };

export const AD_PALETTES: Palette[] = [
  { name: "Khai trương (Đỏ & Vàng)", primary: "#E63946", accent: "#FFD166" },
  { name: "Công nghệ (Xanh Dương & Neon)", primary: "#0F172A", accent: "#38BDF8" },
  { name: "Sang trọng (Đen & Vàng Kim)", primary: "#111827", accent: "#F59E0B" },
  { name: "Tươi mát (Xanh Lá & Trắng)", primary: "#065F46", accent: "#34D399" },
  { name: "Hiện đại (Tím & Hồng)", primary: "#4C1D95", accent: "#F472B6" },
  { name: "Khuyến mãi (Cam & Vàng)", primary: "#EA580C", accent: "#FACC15" },
];

export const EVENT_PALETTES: Palette[] = [
  { name: "Cưới hỏi (Đỏ & Vàng kim)", primary: "#C62828", accent: "#FFD700" },
  { name: "Lãng mạn (Hồng & Tím)", primary: "#E91E63", accent: "#CE93D8" },
  { name: "Sinh nhật (Hồng & Vàng)", primary: "#F06292", accent: "#FFD54F" },
  { name: "Thôi nôi (Xanh pastel & Hồng)", primary: "#81D4FA", accent: "#F8BBD0" },
  { name: "Mừng thọ (Đỏ & Vàng)", primary: "#D32F2F", accent: "#FFC107" },
  { name: "Hội nghị (Navy & Trắng)", primary: "#1A237E", accent: "#ECEFF1" },
  { name: "Sang trọng (Đen & Gold)", primary: "#212121", accent: "#D4AF37" },
  { name: "Tươi sáng (Xanh lá & Trắng)", primary: "#2E7D32", accent: "#C8E6C9" },
];

export const AD_STYLE_CHIPS = [
  "Sử dụng hình ảnh người thật",
  "Ánh sáng Studio chuyên nghiệp",
  "Bố cục hiện đại & thoáng",
  "Tiêu đề in nổi 3D",
  "Phong cách sang trọng - Đẳng cấp",
  "Chủ đề Khai trương rực rỡ",
  "Hiệu ứng phát sáng Neon",
  "Phong cách công nghệ tương lai",
  "Nhiều hộp quà & bong bóng",
  "Tối giản & Tinh tế",
];

export const EVENT_STYLE_CHIPS = [
  "Hoa tươi trang trí sang trọng",
  "Phông cưới backdrop lãng mạn",
  "Bóng bay & confetti lễ hội",
  "Ánh sáng ấm áp lung linh",
  "Phong cách truyền thống Việt Nam",
  "Hiện đại & tối giản",
  "Phong cách hoàng gia sang trọng",
  "Tone pastel nhẹ nhàng",
  "Hiệu ứng bokeh lung linh",
  "Khung viền hoa văn cổ điển",
  "Sân khấu trang trọng",
  "Thiên nhiên & ngoại cảnh",
];

// ---------------------------------------------------------------------------
// Event setups

export type SetupScale = { id: string; label: string; tagline: string; description: string; badge?: string };

export const SETUP_SCALES: SetupScale[] = [
  {
    id: "single",
    label: "1 Tấm chính",
    tagline: "1 vách duy nhất",
    badge: "Tối giản",
    description:
      "Chỉ 1 tấm vách formex cắt bế độc lập duy nhất làm tâm điểm, không có vách phụ, cực kỳ gọn nhẹ, tối ưu bóc tách 1 layer cắt CNC",
  },
  {
    id: "compact",
    label: "Gọn gàng",
    tagline: "1–2 vách so le",
    description: "Tập trung chữ nổi 3D, mặt vách thoáng >90%, tối ưu nhất cho bóc tách layer cắt CNC",
  },
  {
    id: "standard",
    label: "Tiêu chuẩn",
    tagline: "2–3 vách so le",
    badge: "Khuyên dùng",
    description: "Bố cục cân đối chuẩn tiệc tư gia / nhà hàng, điểm xuyết hoa bóng ở rìa, không che lấp vách chính",
  },
  {
    id: "grand",
    label: "Hoành tráng",
    tagline: "Đa tầng vách & cánh gà",
    description: "Bộ vách nhiều tầng lớp, cánh gà 2 bên, thảm sàn, dành cho hội trường, tiệc cưới trung tâm lớn",
  },
];

export type TextPosition = { id: string; label: string; tagline: string; promptDescription: string };

export const TEXT_POSITIONS: TextPosition[] = [
  { id: "center", label: "Chính giữa vách", tagline: "Cân đối, trung tâm", promptDescription: "Chữ nổi 3D bố trí cân đối ở chính giữa nửa trên mặt vách chính." },
  {
    id: "top-arch",
    label: "Đỉnh vòm cong",
    tagline: "Uốn theo mép vòm",
    promptDescription: "Chữ nổi uốn lượn cong nhẹ nhàng theo đường viền vòm cong phía trên đỉnh vách, giải phóng khoảng trống bên dưới.",
  },
  {
    id: "left",
    label: "Lệch vách trái",
    tagline: "Dồn sang vách trái",
    promptDescription: "Chữ nổi tập trung bố trí ở tấm vách bên trái, để tấm vách và góc sàn bên phải thông thoáng cho cụm hoa bóng và standee.",
  },
  {
    id: "right",
    label: "Lệch vách phải",
    tagline: "Dồn sang vách phải",
    promptDescription: "Chữ nổi tập trung bố trí ở tấm vách bên phải, để tấm vách và góc sàn bên trái thông thoáng cho cụm hoa bóng và standee.",
  },
  {
    id: "split",
    label: "Phân tầng vách",
    tagline: "Vách sau & vách trước",
    promptDescription:
      "Phân tầng chữ trước - sau: Tiêu đề sự kiện gắn ở vách cao phía sau, Tên nhân vật và tuổi gắn nổi ở vách thấp hơn so le phía trước tạo hiệu ứng phân lớp 3D rõ rệt.",
  },
  { id: "custom", label: "Tự nhập vị trí", tagline: "Gõ vị trí mong muốn", promptDescription: "" },
];

export type SetupType = { id: string; label: string; description: string; defaultRatio: string; icon: LucideIcon };

export const SETUP_TYPES: SetupType[] = [
  { id: "backdrop-layered", label: "Backdrop vòm nhiều tấm formex", description: "Các tấm vách vòm cắt bế theo form, dựng so le trước sau, hoa & bóng", defaultRatio: "10:4", icon: Presentation },
  { id: "photobooth", label: "Photobooth các tấm dựng độc lập", description: "Bộ vách formex cắt bế nghệ thuật, có standee chibi cắt viền và bục đôn", defaultRatio: "16:9", icon: Camera },
  { id: "stage-mini", label: "Sân khấu mini (Vách chính & Cánh gà)", description: "Cụm tấm vách formex trung tâm, 2 vách cánh gà và bục phát biểu", defaultRatio: "16:6", icon: Mic },
  { id: "cong-chao", label: "Cổng chào formex cắt bế", description: "Cổng vòm formex uốn theo form đón khách, viền hoa & bóng nghệ thuật", defaultRatio: "4:3", icon: DoorOpen },
  { id: "gallery-table", label: "Bàn gallery & Backdrop mini", description: "Cụm tấm formex để bàn/sau bàn, khung ảnh, bục đôn và phụ kiện", defaultRatio: "16:9", icon: Table2 },
  { id: "custom-setup", label: "Bộ tấm formex tùy chỉnh", description: "Tự do bố trí các tấm formex cắt bế hình học, vòm cong lượn sóng", defaultRatio: "10:4", icon: PanelsTopLeft },
];

export type Dimension = { id: string; label: string; desc: string; ratio: string; width?: string; height?: string };

export const DIMENSIONS: Dimension[] = [
  { id: "16:6", label: "16:6", desc: "Ngang rộng panorama", ratio: "16:6" },
  { id: "16:9", label: "16:9", desc: "Chuẩn màn ảnh 16:9", ratio: "16:9" },
  { id: "10:4", label: "10:4", desc: "Backdrop tiệc chuẩn", ratio: "10:4" },
  { id: "3mx2m", label: "3m x 2m", desc: "Kích thước 3m x 2m (tỉ lệ 3:2)", ratio: "3:2", width: "3000", height: "2000" },
  { id: "4mx2.5m", label: "4m x 2.5m", desc: "Kích thước 4m x 2.5m (tỉ lệ 16:10)", ratio: "16:10", width: "4000", height: "2500" },
  { id: "5mx3m", label: "5m x 3m", desc: "Kích thước 5m x 3m (tỉ lệ 5:3)", ratio: "5:3", width: "5000", height: "3000" },
  { id: "custom", label: "Tùy chỉnh", desc: "Nhập kích thước riêng", ratio: "Tùy chỉnh" },
];

export type DecorStyle = { id: string; label: string; desc: string; promptDescription: string };

export const DECOR_STYLES: DecorStyle[] = [
  {
    id: "de-thuong",
    label: "Dễ thương (Cute / Chibi)",
    desc: "Bóng bay pastel, standee hoạt hình đáng yêu, bục tròn",
    promptDescription: "Cute adorable party aesthetic, pastel balloons, cartoon/chibi die-cut character standees, cylindrical cake pedestals, cheerful playful mood",
  },
  {
    id: "sang-trong",
    label: "Sang trọng (Luxury / Gold)",
    desc: "Vàng kim metallic, pha lê, hoa tươi grand, ánh sáng ấm",
    promptDescription: "Ultra-luxury VIP aesthetic, gold metallic trim, crystal chandeliers, grand fresh floral arrangements, warm golden spotlights, sophisticated depth",
  },
  {
    id: "truyen-thong",
    label: "Truyền thống Việt Nam",
    desc: "Đỏ vàng son, hoa sen, câu đối, chữ Hỷ / Thọ, nón lá",
    promptDescription: "Traditional Vietnamese ceremonial aesthetic, auspicious red and gold lacquer theme, fresh lotus flowers, Vietnamese golden calligraphy, ceremonial lanterns",
  },
  {
    id: "hien-dai",
    label: "Hiện đại & Tối giản",
    desc: "Vòm cong clean geometric panels, đèn LED neon, thanh lịch",
    promptDescription: "Modern sleek minimalist aesthetic, clean arch geometric panels, ambient LED backlighting, elegant dimensional typography, uncluttered sophisticated composition",
  },
  {
    id: "pastel",
    label: "Pastel nhẹ nhàng",
    desc: "Hồng baby, xanh mint, kem sữa, lãng mạn thanh thoát",
    promptDescription: "Soft romantic pastel aesthetic, baby pink, mint green and cream milk palette, organic clouds of balloons, gentle warm ambient illumination",
  },
  {
    id: "ruc-ro",
    label: "Rực rỡ lễ hội",
    desc: "Đa sắc màu, confetti, pháo giấy, không khí tươi vui náo nhiệt",
    promptDescription: "Vibrant high-energy celebration mood, colorful multi-tone balloon installations, festive confetti accents, bright festive stage lighting",
  },
  {
    id: "viet-nam-cung",
    label: "Tone cưới Việt Nam",
    desc: "Hoa sen, gỗ mộc, hoa tươi hiện đại, trang nhã tinh tế",
    promptDescription: "Vietnamese contemporary wedding aesthetic, rustic wood and floral fusion, elegant Vietnamese lotus and orchids, intimate warm ceremonial romance",
  },
];

export type Venue = { id: string; label: string; desc: string; promptDescription: string };

export const VENUES: Venue[] = [
  {
    id: "studio",
    label: "Phông Studio trơn sạch (Dễ bóc tách layer)",
    desc: "Nền studio trung tính, sàn phản chiếu nhẹ, viền formex sắc nét",
    promptDescription:
      "Clean professional photo studio setting with solid neutral minimalist backdrop and subtle smooth floor reflection, high-contrast clean edges making the standalone formex panels extremely distinct and ready for layer separation",
  },
  {
    id: "ballroom",
    label: "Sảnh tiệc / Nhà hàng sang trọng",
    desc: "Sảnh khách sạn cao cấp, sàn đá hoa cương bóng, đèn chùm",
    promptDescription: "Luxury grand ballroom event venue, polished glossy marble floor reflecting the decor, warm crystal chandelier lighting, upscale hospitality interior",
  },
  {
    id: "tu-gia",
    label: "Tư gia / Nhà riêng ấm cúng",
    desc: "Phòng khách nhà riêng ấm cúng, thân mật, chuẩn gia đình",
    promptDescription: "Warm cozy Vietnamese family living room home interior, traditional domestic ceremonial setting, intimate celebratory atmosphere",
  },
  {
    id: "san-vuon",
    label: "Ngoài trời / Sân vườn xanh mát",
    desc: "Bãi cỏ xanh tự nhiên, cây cối thoáng đãng, nắng ban ngày",
    promptDescription: "Fresh lush outdoor lawn garden setting, soft natural daylight, fresh green trees and garden atmosphere in the background",
  },
  {
    id: "tiec-dem",
    label: "Tiệc đêm lung linh (Fairy lights)",
    desc: "Ánh sáng đèn led, dây đèn treo lung linh ấm áp buổi tối",
    promptDescription: "Enchanting twilight outdoor night party, warm glowing fairy lights, magical ambient festoon glow, celebratory evening mood",
  },
  {
    id: "beach",
    label: "Bãi biển / Resort nghỉ dưỡng",
    desc: "Bãi cát trắng, biển xanh mát, nắng hoàng hôn lãng mạn",
    promptDescription: "Tropical beach resort event setting, soft white sand floor, calm blue sea in the distant horizon, golden sunset ambient glow",
  },
];

export type EventType = {
  id: string;
  label: string;
  icon: LucideIcon;
  defaultSetup: string;
  defaultStyleId: string;
  content: {
    headline: string;
    namesPlaceholder: string;
    nicknamePlaceholder?: string;
    agePlaceholder?: string;
    datePlaceholder: string;
    extraPlaceholder: string;
  };
  visualStyle: string[];
  palette: { primary: string; accent: string };
};

export const EVENT_TYPES: EventType[] = [
  {
    id: "gia-tien",
    label: "Gia tiên",
    icon: HeartHandshake,
    defaultSetup: "backdrop-layered",
    defaultStyleId: "truyen-thong",
    content: {
      headline: "LỄ GIA TIÊN",
      namesPlaceholder: "Tên chú rể & cô dâu (VD: ĐỨC ANH & MAI PHƯƠNG)",
      datePlaceholder: "18.10.2026",
      extraPlaceholder: "Tại tư gia, bàn thờ gia tiên, mâm quả trang trọng...",
    },
    visualStyle: [
      "Physical Vietnamese traditional family altar ceremony setup",
      "multi-layer curved arch backdrop with red velvet and gold trim",
      "fresh lotus and golden orchid floral installations",
      "standalone pedestals for ceremonial trays and incense",
      "illuminated 3D golden calligraphy letters mounted on backdrop panel",
      "warm golden ambient lighting with clear dimensional shadows",
    ],
    palette: { primary: "#C62828", accent: "#FFD700" },
  },
  {
    id: "vu-quy",
    label: "Vu quy",
    icon: Heart,
    defaultSetup: "photobooth",
    defaultStyleId: "viet-nam-cung",
    content: {
      headline: "LỄ VU QUY",
      namesPlaceholder: "THU HƯƠNG & MINH TUẤN",
      datePlaceholder: "18.10.2026",
      extraPlaceholder: "Tại tư gia nhà gái, hoa tươi pastel lãng mạn...",
    },
    visualStyle: [
      "Real-world physical bride departure photobooth setup",
      "multi-panel overlapping arches in soft pink and cream tones",
      "cascading fresh rose and peony floral arrangements framing the arch",
      "independent 3D acrylic dimensional letters mounted with LED backlighting",
      "front decorative pedestals for wedding cake or floral display",
      "clean seamless floor staging with foreground decorative props",
    ],
    palette: { primary: "#E91E63", accent: "#CE93D8" },
  },
  {
    id: "tan-hon",
    label: "Tân hôn",
    icon: Sparkles,
    defaultSetup: "backdrop-layered",
    defaultStyleId: "sang-trong",
    content: {
      headline: "TIỆC CƯỚI",
      namesPlaceholder: "QUANG HUY & BÍCH NGỌC",
      datePlaceholder: "25.12.2026",
      extraPlaceholder: "Grand Ballroom, White Palace, 18:00...",
    },
    visualStyle: [
      "Tasteful physical wedding reception backdrop setup with layered arch formex panels",
      "curved arch formex panels with elegant gold metallic edging and clean panel surface",
      "fresh floral sprays framing outer arch curves without covering the central text area",
      "3D metallic gold letters standing out with clean dimensional drop shadows",
      "flanking cylindrical display pedestals placed neatly to the side",
      "clean floor staging with crisp layer separation between panels",
    ],
    palette: { primary: "#B71C1C", accent: "#FFD700" },
  },
  {
    id: "sinh-nhat",
    label: "Sinh nhật",
    icon: Cake,
    defaultSetup: "photobooth",
    defaultStyleId: "de-thuong",
    content: {
      headline: "CHÚC MỪNG SINH NHẬT",
      namesPlaceholder: "GIA HUY",
      nicknamePlaceholder: "TÔM",
      agePlaceholder: "2 Tuổi",
      datePlaceholder: "15.08.2026",
      extraPlaceholder: "Chủ đề Khủng Long / Vương quốc động vật...",
    },
    visualStyle: [
      "Realistic 3D children birthday photobooth setup",
      "layered pastel arch panels placed at staggered depths with clean open surfaces",
      "organic 3D balloon garland framing outer edges of the panels without blocking the text",
      "die-cut chibi cartoon character standee on floor base in foreground corner",
      "3D thick formex block letters for child name and age placed prominently on upper backdrop",
      "cylindrical cake pedestals placed neatly to the side",
    ],
    palette: { primary: "#42A5F5", accent: "#FFD54F" },
  },
  {
    id: "thoi-noi",
    label: "Thôi nôi",
    icon: Baby,
    defaultSetup: "backdrop-layered",
    defaultStyleId: "pastel",
    content: {
      headline: "TIỆC THÔI NÔI",
      namesPlaceholder: "BÉ BẢO AN",
      nicknamePlaceholder: "BẮP",
      agePlaceholder: "1 Tuổi",
      datePlaceholder: "10.05.2026",
      extraPlaceholder: "Mừng bé tròn 1 tuổi, ba mẹ yêu con...",
    },
    visualStyle: [
      "Physical baby first birthday (thôi nôi) decoration setup",
      "multi-layer scalloped arch backdrops in soft pastel colors with clean faces",
      "dreamy organic balloon accents framing panel outer contours",
      "freestanding die-cut baby cartoon standee and number '1' illuminated marquee light",
      "3D foam dimensional letters for baby nickname and name",
      "cylindrical cake pedestals placed neatly in foreground corner",
    ],
    palette: { primary: "#81D4FA", accent: "#F8BBD0" },
  },
  {
    id: "day-thang",
    label: "Đầy tháng",
    icon: Baby,
    defaultSetup: "photobooth",
    defaultStyleId: "pastel",
    content: {
      headline: "TIỆC ĐẦY THÁNG",
      namesPlaceholder: "BÉ TUỆ LÂM",
      nicknamePlaceholder: "SỮA",
      agePlaceholder: "1 Tháng",
      datePlaceholder: "01.06.2026",
      extraPlaceholder: "Mừng đầy tháng thiên thần nhỏ...",
    },
    visualStyle: [
      "Physical baby one-month celebration photobooth installation",
      "gentle rounded pastel panels with cloud and star cutouts",
      "delicate pastel balloon clusters and baby breath flower sprays framing edges",
      "freestanding die-cut baby angel or animal standee on floor base",
      "3D acrylic lettering with soft warm backlighting",
      "cake pedestals and gift boxes placed neatly in foreground corner",
    ],
    palette: { primary: "#A5D6A7", accent: "#F8BBD0" },
  },
  {
    id: "khai-truong",
    label: "Khai trương",
    icon: Flame,
    defaultSetup: "backdrop-layered",
    defaultStyleId: "sang-trong",
    content: {
      headline: "GRAND OPENING",
      namesPlaceholder: "SPA & CLINIC MAI BEAUTY",
      datePlaceholder: "08.08.2026",
      extraPlaceholder: "Ưu đãi 50%, quà tặng khai trương...",
    },
    visualStyle: [
      "Commercial grand opening photobooth and entrance setup",
      "modern geometric multi-layer formex panels in crimson red and mirrored gold",
      "luxury balloon accents mixed with metallic chrome balloons and floral sprays framing the edges",
      "illuminated 3D LED marquee company logo and name cutout on upper panel face",
      "neat ceremonial props and clean floor section",
      "crisp commercial event lighting with sharp dimensional shadows",
    ],
    palette: { primary: "#D32F2F", accent: "#FFD700" },
  },
  {
    id: "mung-tho",
    label: "Mừng thọ",
    icon: Crown,
    defaultSetup: "backdrop-layered",
    defaultStyleId: "truyen-thong",
    content: {
      headline: "LỄ MỪNG THỌ",
      namesPlaceholder: "CỤ BÀ NGUYỄN THỊ MAI",
      agePlaceholder: "Thượng Thọ 80 Tuổi",
      datePlaceholder: "Mùa Xuân 2026",
      extraPlaceholder: "Con cháu kính mừng, gia đình sum vầy...",
    },
    visualStyle: [
      "Traditional Vietnamese longevity celebration backdrop setup",
      "multi-layer red and gold lacquer panels with golden frame border",
      "prominent 3D golden Chinese longevity symbol (Chữ Thọ) and peach blossom motifs",
      "3D gold acrylic cut-out letters for elder name and milestone age",
      "flanking floral stands with golden chrysanthemums and peach branches",
      "ceremonial red carpet and family photo pedestal area",
    ],
    palette: { primary: "#D32F2F", accent: "#FFC107" },
  },
  {
    id: "hoi-nghi",
    label: "Hội nghị",
    icon: Building2,
    defaultSetup: "stage-mini",
    defaultStyleId: "hien-dai",
    content: {
      headline: "HỘI NGHỊ KHÁCH HÀNG 2026",
      namesPlaceholder: "CÔNG TY CP CÔNG NGHỆ TECHVIET",
      datePlaceholder: "20.11.2026",
      extraPlaceholder: "Trung tâm Hội nghị Quốc gia, Hà Nội...",
    },
    visualStyle: [
      "Corporate conference physical stage backdrop setup",
      "modern multi-tier geometric panels in deep navy blue with sleek white and silver accents",
      "ambient blue LED strip backlighting behind each tiered panel",
      "raised 3D acrylic corporate logo and conference title with sharp drop shadows",
      "front speaker podium / lectern and stage lighting rigs visible at edges",
      "professional clean conference stage staging ready for presentation",
    ],
    palette: { primary: "#1A237E", accent: "#ECEFF1" },
  },
  {
    id: "su-kien-khac",
    label: "Sự kiện khác",
    icon: Gift,
    defaultSetup: "custom-setup",
    defaultStyleId: "hien-dai",
    content: {
      headline: "TÊN SỰ KIỆN",
      namesPlaceholder: "Tên chủ đề / Tên nhân vật",
      datePlaceholder: "Ngày ... tháng ... năm ...",
      extraPlaceholder: "Chi tiết yêu cầu setup theo thiết kế riêng...",
    },
    visualStyle: [
      "Custom multi-layered physical event decoration installation",
      "free-form layered arch panels with customizable shapes and colors",
      "independent foreground elements, pedestals, and 3D cut-out letters",
      "professional event lighting with distinct physical layers and shadows",
    ],
    palette: { primary: "#35A9E8", accent: "#FFD700" },
  },
];

export const AD_STEPS = [
  "Đang khởi tạo ý tưởng & thông số thiết kế...",
  "Đang kết nối & gửi thông tin xử lý...",
  "AI đang phân tích bố cục, typographic & màu sắc...",
  "AI đang tổng hợp & vẽ hình ảnh hoàn chỉnh...",
  "Đang tối ưu độ sắc nét & chuẩn bị xuất kết quả...",
];
