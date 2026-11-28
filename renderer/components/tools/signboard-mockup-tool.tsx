import React, { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { ImageInput, OptionCards, Section, Segmented, ToolLayout, usePendingToolImage } from "./common";
import { useChatGptJob } from "./common/chatgpt-job";
import { ChatGptResults } from "./common/chatgpt-results";
import { PromptPreview } from "./chatgpt-tool";

const TOOL_ID = "signboard-mockup";

const STEPS = [
  "Đang nạp Bản thiết kế & Ảnh vị trí thi công lên AI...",
  "Đang nhận diện khung viền, bề mặt tường, góc nghiêng & điểm tụ...",
  "Đang nắn góc phối cảnh 3D và ướm chuẩn xác vào vị trí...",
  "Đang dựng độ dày hộp biển, viền chữ nổi & kết cấu vật liệu...",
  "Đang tính toán bóng đổ, phản xạ & ánh sáng môi trường thực tế...",
  "Đang hoàn thiện ảnh phối cảnh thi công biển hiệu hoàn chỉnh...",
];

type ContextMode = "upload" | "prompt";
type MountType = "frame" | "facade" | "blade" | "interior";

const MOUNT_TYPES: { value: MountType; label: string; hint: string }[] = [
  { value: "frame", label: "Khung có sẵn / Hộp đèn", hint: "Ướm khít lòng khung sắt, bạt hiflex, pano" },
  { value: "facade", label: "Mặt tiền nhà / Shop", hint: "Ốp biển lên mặt tiền showroom, cửa tiệm" },
  { value: "blade", label: "Biển vẫy / Treo tường", hint: "Biển tròn/vuông gắn tay đỡ kim loại" },
  { value: "interior", label: "Vách lễ tân / Trong nhà", hint: "Logo chữ nổi LED trên vách gỗ, đá marble" },
];

const EFFECT_CHIPS = [
  "Ướm khít vào lòng khung sắt",
  "Hộp đèn LED phát sáng rực rỡ",
  "Chữ nổi mica sáng chân",
  "Bạt Hiflex căng phẳng chuẩn góc",
  "Thay thế biển cũ trong ảnh",
  "Bật đèn buổi tối lung linh",
  "Bóng đổ 3D chân thực",
];

const SCENE_PRESETS = [
  "Khung biển sắt hộp đèn đứng 2 mặt ở vỉa hè đường phố hiện đại",
  "Mặt tiền quán cà phê 2 tầng phong cách Nhật Bản tối giản, cửa kính lớn",
  "Vách quầy lễ tân văn phòng hiện đại ốp lam sóng và đá marble",
  "Biển vẫy tròn kim loại gắn trên tường gạch quán pub phong cách vintage",
  "Showroom thời trang cao cấp mặt phố, ốp đá marble và viền kim loại",
  "Nhà hàng ẩm thực sang trọng phong cách Châu Âu ấm cúng",
];

function buildSignboardPrompt(opts: {
  contextMode: ContextMode;
  mountType: MountType;
  contextDescription: string;
  notes: string;
}) {
  const extra = opts.notes.trim() ? `\n\nADDITIONAL INSTRUCTIONS & EFFECTS:\n- ${opts.notes.trim()}` : "";

  if (opts.contextMode === "prompt") {
    const mountSpec =
      opts.mountType === "frame"
        ? "Create a realistic standalone signboard structure or outdoor advertising metal frame based on the description. Precisely install the signboard design from Image 1 onto the face of this frame with steel tubing, rivets, mounting brackets, and tensioned flex banner or acrylic face."
        : opts.mountType === "blade"
          ? "Generate a realistic projecting blade sign (round, square, or vertical flag sign) mounted with decorative iron brackets onto an architectural wall according to the description. Display the artwork from Image 1 cleanly on the blade sign face."
          : opts.mountType === "interior"
            ? "Generate a modern interior reception lobby or commercial accent wall according to the description. Mount the design from Image 1 as premium 3D dimensional letters or logo with realistic halo backlighting or LED face illumination."
            : "Generate a photorealistic, high-end architectural storefront / facade scene matching the description. Seamlessly mount and install the signboard from Image 1 onto this storefront.";

    return `Use Image 1 strictly as the 2D signboard design, brand artwork, typography, and graphic reference.

Generate a brand-new, photorealistic, high-resolution commercial signage scene matching the following context description:
"${opts.contextDescription.trim() || "Modern high-end commercial signage scene"}"

MOUNTING & FABRICATION SPECIFICATION:
${mountSpec}

GRAPHIC & BRAND INTEGRITY PRIORITY:
- Preserve all text, typography, fonts, brand logos, phone numbers, and Vietnamese diacritics from Image 1 with 100% precision.
- Do not alter, omit, or misspell any wording or brand graphic.
- Maintain accurate brand colors, proportions, and visual hierarchy from Image 1.

REALISTIC ARCHITECTURAL FABRICATION & DEPTH:
- Render authentic physical fabrication depth (3D channel letters, backlit lightbox, or aluminum composite panel with bevels and realistic mounting hardware).
- Cast natural drop shadows and ambient illumination.
- Generate the final result as a single photorealistic photograph. Do not ask follow-up questions.${extra}`;
  }

  const installSpec =
    opts.mountType === "frame"
      ? `INSTALLATION INTO EXISTING FRAME / SIGN STRUCTURE (STRICT CONSTRAINT):
- Image 2 shows an existing physical signboard, metal frame, banner structure, pole stand, or billboard structure.
- CRITICAL: Install the 2D design from Image 1 strictly into the inner face / mounting area of the existing frame/signboard in Image 2.
- DO NOT invent random buildings or facades not in Image 2. Keep the physical frame, poles, stand, and environment from Image 2 fully intact.
- If Image 2 shows an old worn banner or previous signage, cleanly replace only the sign face with Image 1.
- Match exact corner vanishing lines and perspective skew so the design fits flat and taut inside the frame.`
      : opts.mountType === "blade"
        ? `PROJECTING BLADE SIGN / WALL BRACKET INTEGRATION:
- Image 2 provides the target wall, pillar, or building edge.
- Install Image 1 as a physical double-sided projecting blade signboard mounted with metal brackets bolted into the wall in Image 2, casting natural drop shadows.`
        : opts.mountType === "interior"
          ? `INTERIOR / RECEPTION / ACCENT WALL INTEGRATION:
- Image 2 provides the interior wall (wood slats, marble, painted drywall, or office backdrop).
- Install Image 1 as dimensional 3D channel letters, laser-cut acrylic logo, or illuminated indoor corporate sign mounted onto the wall in Image 2 while keeping exact room lighting and furniture.`
          : `ARCHITECTURAL STOREFRONT FACADE INTEGRATION:
- Seamlessly install the signboard from Image 1 into the natural signage location on the storefront in Image 2.
- If there is an existing old signboard in Image 2, cleanly replace it with Image 1 matching exact perspective foreshortening, camera tilt, and wall orientation.`;

  return `Use Image 1 strictly as the 2D signboard design, brand artwork, typography, and graphic reference.
Use Image 2 strictly as the actual installation location, physical frame, wall, or storefront reference.

Create a photorealistic architectural mockup photograph showing the signboard from Image 1 physically manufactured and seamlessly installed onto the target in Image 2.

GRAPHIC & BRAND INTEGRITY PRIORITY:
- Preserve all text, typography, fonts, brand logos, phone numbers, and Vietnamese diacritics from Image 1 with 100% precision.
- Do not alter, omit, or misspell any wording or brand graphic.

${installSpec}

REALISTIC PHYSICAL DEPTH & FINISH:
- Render genuine 3D physical depth, border framing, acrylic/alu/flex finish, fasteners, contact shadows, and ambient reflections matching Image 2.
- Generate the final result as a single photorealistic photograph. Do not ask follow-up questions.${extra}`;
}

export default function SignboardMockupTool() {
  const { toast } = useToast();
  const job = useChatGptJob(TOOL_ID);

  const [designPath, setDesignPath] = useState("");
  const [facadePath, setFacadePath] = useState("");
  const [contextMode, setContextMode] = useState<ContextMode>("upload");
  const [mountType, setMountType] = useState<MountType>("facade");
  const [contextDescription, setContextDescription] = useState("");
  const [notes, setNotes] = useState("");

  usePendingToolImage(TOOL_ID, (path) => {
    setDesignPath(path);
    toast({ title: "Đã nạp bản thiết kế biển hiệu", description: "Chọn ảnh mặt tiền thực tế hoặc để AI tự dựng bối cảnh." });
  });

  const toggleChip = (chip: string) => {
    setNotes((prev) => {
      const parts = prev
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return parts.includes(chip) ? parts.filter((p) => p !== chip).join(", ") : parts.length ? `${parts.join(", ")}, ${chip}` : chip;
    });
  };

  const prompt = useMemo(
    () => buildSignboardPrompt({ contextMode, mountType, contextDescription, notes }),
    [contextMode, mountType, contextDescription, notes],
  );

  const imagePaths = contextMode === "upload" ? [designPath, facadePath].filter(Boolean) : [designPath].filter(Boolean);

  const run = () => {
    if (!designPath) {
      toast({ title: "Thiếu thiết kế biển hiệu", description: "Hãy chọn Ảnh 1 (Bản vẽ biển hiệu 2D)." });
      return;
    }
    if (contextMode === "upload" && !facadePath) {
      toast({ title: "Thiếu ảnh hiện trạng", description: "Hãy chọn Ảnh 2 (Mặt tiền / Khung sắt thực tế) hoặc chuyển sang 'AI tự dựng bối cảnh'." });
      return;
    }
    if (contextMode === "prompt" && !contextDescription.trim()) {
      toast({ title: "Thiếu mô tả bối cảnh", description: "Hãy nhập hoặc chọn một bối cảnh mẫu để AI tạo không gian lắp đặt." });
      return;
    }
    job.submit({ prompt, imagePaths, expected: 1, steps: STEPS });
  };

  const aside = (
    <>
      <Section step="01" title="Thiết kế biển hiệu 2D">
        <ImageInput toolId={TOOL_ID} compact imagePath={designPath} onChange={setDesignPath} label="Tải bản thiết kế biển hiệu / logo" />
      </Section>

      <Section step="02" title="Nguồn bối cảnh lắp đặt">
        <Segmented
          value={contextMode}
          onChange={setContextMode}
          options={[
            { value: "upload", label: "Ảnh hiện trạng thật" },
            { value: "prompt", label: "AI tự dựng bối cảnh" },
          ]}
        />
        {contextMode === "upload" ? (
          <ImageInput
            toolId={TOOL_ID}
            compact
            acceptPaste={false}
            imagePath={facadePath}
            onChange={setFacadePath}
            label="Tải ảnh mặt tiền / khung sắt / vách tường"
          />
        ) : (
          <>
            <textarea
              className="textarea textarea-bordered textarea-sm min-h-[64px] w-full"
              placeholder="Mô tả mặt tiền shop, vỉa hè, quầy lễ tân muốn AI tạo..."
              value={contextDescription}
              onChange={(e) => setContextDescription(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {SCENE_PRESETS.map((scene) => (
                <button
                  key={scene}
                  type="button"
                  onClick={() => setContextDescription(scene)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-left text-[10px] font-medium",
                    contextDescription === scene
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-base-content/15 bg-base-100 hover:border-primary/50",
                  )}
                >
                  + {scene.slice(0, 36)}...
                </button>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section step="03" title="Kiểu thi công & Lắp đặt">
        <OptionCards value={mountType} onChange={setMountType} options={MOUNT_TYPES} />
      </Section>

      <Section step="04" title="Hiệu ứng vật liệu & Ánh sáng">
        <div className="flex flex-wrap gap-1">
          {EFFECT_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => toggleChip(chip)}
              className={cn(
                "rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors",
                notes.includes(chip)
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-base-content/15 bg-base-100 hover:border-primary/50",
              )}
            >
              + {chip}
            </button>
          ))}
        </div>
        <textarea
          className="textarea textarea-bordered textarea-sm min-h-[56px] w-full"
          placeholder="Ghi chú thêm: chữ nổi inox vàng gương, bật đèn buổi tối..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Section>

      <PromptPreview prompt={prompt} />
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={job.running} onClick={run}>
      <Sparkles className="h-4 w-4" />
      {job.running ? "Đang dựng phối cảnh..." : "Dựng phối cảnh bằng ChatGPT"}
    </button>
  );

  return (
    <ToolLayout toolId={TOOL_ID} aside={aside} footer={footer}>
      <ChatGptResults
        toolId={TOOL_ID}
        steps={STEPS}
        before={contextMode === "upload" ? facadePath || designPath : designPath}
        resultLabel="Phối cảnh thi công"
        inputPaths={imagePaths}
        emptyText="Tải bản vẽ biển hiệu 2D và ảnh mặt tiền / khung sắt thực tế (hoặc chọn AI tự dựng bối cảnh), chọn kiểu thi công rồi bấm 'Dựng phối cảnh bằng ChatGPT'."
      />
    </ToolLayout>
  );
}
