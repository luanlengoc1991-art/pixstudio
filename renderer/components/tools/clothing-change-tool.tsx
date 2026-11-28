import React, { useEffect, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import { Download, FolderDown, ImageUpscale, Layers, Maximize2, PenTool, Sparkles, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendImageToToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  CompareView,
  EmptyState,
  fileExtension,
  fileUrl,
  IMAGE_SAVE_FILTERS,
  ImageInput,
  OptionCards,
  saveFileAs,
  saveFilesToFolder,
  Section,
  Segmented,
  ToolLayout,
  usePendingToolImage,
  ZoomModal,
} from "./common";
import { ChatGptJobBanner, useChatGptJob } from "./common/chatgpt-job";
import { PromptPreview } from "./chatgpt-tool";

const TOOL_ID = "clothing-change";

const STEPS = [
  "Đang tải ảnh người mẫu & nhận diện cấu trúc vóc dáng...",
  "Đang khóa nhận diện khuôn mặt, ngũ quan, màu da & kiểu tóc...",
  "Đang bóc tách trang phục cũ và giữ nguyên phông nền xung quanh...",
  "Đang ướm trang phục mới, căn chỉnh nếp gấp vải & độ ôm cơ thể...",
  "Đang xử lý bóng đổ, phản xạ ánh sáng môi trường & hòa trộn chất liệu...",
  "Đang hoàn thiện ảnh thử đồ thời trang siêu thực chuẩn Studio...",
];

const LIGHTING_OPTIONS = [
  { value: "none", label: "Mặc định nền gốc" },
  { value: "studio", label: "Studio mềm mại" },
  { value: "left-light", label: "Nắng nhẹ bên trái" },
  { value: "left-strong", label: "Nắng mạnh bên trái" },
  { value: "right-light", label: "Nắng nhẹ bên phải" },
  { value: "right-strong", label: "Nắng mạnh bên phải" },
];

const OUTFIT_PRESETS = [
  "Áo dài truyền thống Việt Nam cách tân thêu hoa tinh tế",
  "Đầm dạ hội lộng lẫy sang trọng xẻ tà quyến rũ",
  "Bộ suit nam / áo vest đen lịch lãm kết hợp cà vạt sang trọng",
  "Set áo vest nữ công sở thanh lịch thời thượng",
  "Set đồ thể thao năng động trẻ trung và khỏe khoắn",
  "Áo thun trắng basic phối quần jean xanh cá tính",
  "Trang phục streetwear phong cách đường phố hiện đại",
  "Váy hoa mùa hè nhẹ nhàng bay bổng",
];

const QUALITY_CHIPS = [
  "Giữ nguyên 100% khuôn mặt & tóc",
  "Chất liệu vải cao cấp",
  "Nếp gấp vải chân thực tự nhiên",
  "Chuẩn form dáng cơ thể",
  "Giữ nguyên màu da tự nhiên",
  "Đường may tinh tế sắc nét",
  "Ánh sáng hòa trộn mềm mại",
];

type PeopleCount = "one" | "two" | "multi";
type PoseOption = "keep" | "adapt";
type ViewMode = "compare" | "triple" | "single";

function buildClothingPrompt(opts: {
  hasGarmentImage: boolean;
  clothingText: string;
  peopleCount: PeopleCount;
  poseOption: PoseOption;
  sharpenSubject: boolean;
  lightingEffect: string;
  lightingIntensity: number;
  notes: string;
}) {
  const lines: string[] = [
    "// INSTRUCTION: You are a hyper-realistic virtual try-on and high-fashion AI stylist. Your sole task is to change the clothing on the person in Image 1.",
    "// CRITICAL PRESERVATION RULES (MANDATORY & NON-NEGOTIABLE):",
    "// 1. IDENTITY & FACE: The subject's face, facial expression, eyes, nose, mouth, makeup, hair, hairstyle, skin pores and all identifying physical features MUST remain 100% UNCHANGED and pristine. Do not generate a different face or airbrushed skin.",
    "// 2. BACKGROUND & ENVIRONMENT: The original background, environment, lighting tone, and all setting elements MUST remain identical to Image 1. DO NOT alter, blur, add, or remove anything from the original background.",
    opts.poseOption === "keep"
      ? "// 3. BODY & POSE: The subject's exact body shape, proportions, height, posture, and arm/leg pose MUST be strictly preserved as in Image 1."
      : "// 3. BODY & POSE: The subject's body shape and proportions MUST be perfectly preserved. You may subtly adapt arm/posture micro-details naturally to showcase the new outfit while keeping the stance realistic.",
    "// 4. LIGHTING & SHADOWS: The new clothing must realistically integrate with the original scene's lighting, ambient color temperature, contact shadows, and environmental light wrapping.",
  ];

  const who = opts.peopleCount === "one" ? "one person" : opts.peopleCount === "two" ? "two people" : "multiple people";
  lines.push(`// --- Subject Info: The image contains ${who}. Apply the clothing change to the main subject(s).`);
  if (opts.sharpenSubject) {
    lines.push("// - Sharpening: Apply a crisp studio-grade high-definition fabric weave and texture pass.");
  }
  if (opts.lightingEffect !== "none") {
    if (opts.lightingEffect === "studio") {
      lines.push("// - Lighting: Add soft, high-end studio key lighting and gentle fill light on the clothing.");
    } else {
      const side = opts.lightingEffect.includes("left") ? "from the left" : "from the right";
      const strength = opts.lightingEffect.includes("strong") ? "strong" : "soft";
      lines.push(`// - Key Light: Integrate the new clothing with a realistic ${strength} directional key light coming ${side}.`);
    }
  }
  lines.push(`// - Ambient Lighting Blend: Blend environmental ambient light from the original background onto the new garment at ${opts.lightingIntensity}% intensity.`);
  lines.push("// CLOTHING CHANGE SPECIFICATION:");

  if (opts.hasGarmentImage) {
    lines.push(
      "- PRIMARY SOURCE: Use Image 2 (the clothing reference) as the main garment reference for the new outfit.",
      "- FITTING INSTRUCTIONS: Meticulously dress the person in Image 1 with the outfit from Image 2. Adapt the garment naturally to fit the model's exact body contours, posture, and perspective. Render authentic fabric weave, folds, creases, seams, buttons, collar, and drapes so it looks physically worn.",
    );
    if (opts.clothingText.trim()) {
      lines.push(`- ADDITIONAL STYLING DETAILS: Incorporate these styling details alongside Image 2: "${opts.clothingText.trim()}".`);
    }
  } else {
    lines.push(
      `- GOAL: Dress the person in Image 1 based on the following description: "${opts.clothingText.trim()}".`,
      "- FITTING INSTRUCTIONS: Generate the described clothing realistically onto the model's body with natural fabric weave, folds, seams, and fit tailored to the model's pose.",
    );
  }

  if (opts.notes.trim()) {
    lines.push(`// ADDITIONAL USER NOTES:\n- ${opts.notes.trim()}`);
  }
  lines.push(
    "// FINAL DELIVERABLE: Output ONE single, flawless, ultra-realistic high-resolution photograph showing the person wearing the new outfit, complying 100% with face and identity preservation rules. Do not ask follow-up questions.",
  );
  return lines.join("\n");
}

export default function ClothingChangeTool() {
  const { toast } = useToast();
  const sendImageToTool = useSetAtom(sendImageToToolAtom);
  const job = useChatGptJob(TOOL_ID);

  const [modelPath, setModelPath] = useState("");
  const [garmentPath, setGarmentPath] = useState("");
  const [clothingText, setClothingText] = useState("");
  const [peopleCount, setPeopleCount] = useState<PeopleCount>("one");
  const [poseOption, setPoseOption] = useState<PoseOption>("keep");
  const [sharpenSubject, setSharpenSubject] = useState(true);
  const [lightingEffect, setLightingEffect] = useState("none");
  const [lightingIntensity, setLightingIntensity] = useState(75);
  const [notes, setNotes] = useState("");

  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("compare");
  const [editText, setEditText] = useState("");
  const [zoomed, setZoomed] = useState<string | null>(null);

  usePendingToolImage(TOOL_ID, (path) => {
    setModelPath(path);
    toast({ title: "Đã nạp ảnh người mẫu", description: "Chọn ảnh trang phục mẫu hoặc mô tả trang phục bên trái." });
  });

  const newest = job.history[0];
  useEffect(() => {
    if (newest) setSelected(newest);
  }, [newest]);
  const current = selected && job.history.includes(selected) ? selected : newest;

  const toggleNoteChip = (chip: string) => {
    setNotes((prev) => {
      const parts = prev
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      return parts.includes(chip) ? parts.filter((p) => p !== chip).join(", ") : parts.length ? `${parts.join(", ")}, ${chip}` : chip;
    });
  };

  const prompt = useMemo(
    () =>
      buildClothingPrompt({
        hasGarmentImage: Boolean(garmentPath),
        clothingText,
        peopleCount,
        poseOption,
        sharpenSubject,
        lightingEffect,
        lightingIntensity,
        notes,
      }),
    [garmentPath, clothingText, peopleCount, poseOption, sharpenSubject, lightingEffect, lightingIntensity, notes],
  );

  const imagePaths = [modelPath, garmentPath].filter(Boolean);

  const run = () => {
    if (!modelPath) {
      toast({ title: "Thiếu ảnh người mẫu", description: "Hãy chọn Ảnh 1 (Người mẫu cần thay trang phục)." });
      return;
    }
    if (!garmentPath && !clothingText.trim()) {
      toast({
        title: "Thiếu thông tin trang phục",
        description: "Hãy chọn Ảnh 2 (Trang phục mẫu) hoặc nhập/chọn mô tả trang phục bằng văn bản.",
      });
      return;
    }
    if (garmentPath) setView("triple");
    job.submit({ prompt, imagePaths, expected: 1, steps: STEPS });
  };

  const refine = () => {
    if (!editText.trim()) return;
    job.submit({
      prompt: `Hãy chỉnh sửa lại ảnh thử đồ vừa tạo theo yêu cầu sau, giữ nguyên 100% khuôn mặt và bối cảnh: ${editText.trim()}`,
      imagePaths: [],
      newChat: false,
      nativeEdit: true,
      steps: STEPS,
    });
    setEditText("");
  };

  const saveOne = async (path: string) => {
    const ext = fileExtension(path);
    const saved = await saveFileAs({
      defaultName: `thay-trang-phuc_${Date.now()}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, ...IMAGE_SAVE_FILTERS],
      sourcePath: path,
    });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  const saveAll = async () => {
    const count = await saveFilesToFolder({
      folderName: `Thay_trang_phuc_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}`,
      files: [...job.history].reverse().map((path, index) => ({
        sourcePath: path,
        name: `thay-do_${index + 1}.${fileExtension(path)}`,
      })),
    });
    if (count) toast({ title: `Đã lưu ${count} ảnh` });
  };

  const aside = (
    <>
      <Section step="01" title="Ảnh người mẫu (Bắt buộc)" hint="Chân dung, nửa người hoặc toàn thân rõ khuôn mặt.">
        <ImageInput toolId={TOOL_ID} compact imagePath={modelPath} onChange={setModelPath} label="Tải ảnh người mẫu gốc" />
      </Section>

      <Section step="02" title="Ảnh trang phục mẫu (Tùy chọn)" hint="Có thể tải ảnh váy/áo mẫu hoặc chỉ mô tả bằng chữ ở mục 03.">
        <ImageInput
          toolId={TOOL_ID}
          compact
          acceptPaste={!modelPath ? false : false}
          imagePath={garmentPath}
          onChange={setGarmentPath}
          label="Tải ảnh quần áo / váy mẫu"
        />
        {garmentPath && (
          <button type="button" className="btn btn-ghost btn-xs self-end text-error" onClick={() => setGarmentPath("")}>
            <X className="h-3.5 w-3.5" /> Bỏ ảnh trang phục mẫu
          </button>
        )}
      </Section>

      <Section step="03" title="Mô tả trang phục & Mẫu nhanh">
        <textarea
          className="textarea textarea-bordered textarea-sm min-h-[64px] w-full"
          placeholder="VD: Áo dài lụa trắng thêu hoa sen, hoặc vest đen sơ mi trắng..."
          value={clothingText}
          onChange={(e) => setClothingText(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {OUTFIT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setClothingText(preset)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-left text-[10.5px] font-semibold transition-colors",
                clothingText === preset
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-base-content/15 bg-base-100 hover:border-primary/50",
              )}
            >
              + {preset.length > 34 ? `${preset.slice(0, 34)}...` : preset}
            </button>
          ))}
        </div>
      </Section>

      <Section step="04" title="Tư thế & Chủ thể">
        <Segmented
          value={peopleCount}
          onChange={setPeopleCount}
          options={[
            { value: "one", label: "1 người" },
            { value: "two", label: "2 người" },
            { value: "multi", label: "Nhiều người" },
          ]}
        />
        <OptionCards
          value={poseOption}
          onChange={setPoseOption}
          options={[
            { value: "keep", label: "Khóa nguyên dáng", hint: "Giữ 100% tư thế Ảnh 1" },
            { value: "adapt", label: "Tự nhiên theo đồ", hint: "Tinh chỉnh nhẹ hợp váy áo" },
          ]}
        />
        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm"
            checked={sharpenSubject}
            onChange={(e) => setSharpenSubject(e.target.checked)}
          />
          Tăng độ sắc nét thớ vải & chi tiết HD
        </label>
      </Section>

      <Section step="05" title={`Ánh sáng & Hòa trộn (${lightingIntensity}%)`}>
        <OptionCards value={lightingEffect} onChange={setLightingEffect} options={LIGHTING_OPTIONS} />
        <input
          type="range"
          min={20}
          max={100}
          step={5}
          value={lightingIntensity}
          onChange={(e) => setLightingIntensity(Number(e.target.value))}
          className="range range-primary range-xs"
        />
      </Section>

      <Section step="06" title="Ghi chú chất lượng">
        <div className="flex flex-wrap gap-1">
          {QUALITY_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => toggleNoteChip(chip)}
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
          placeholder="Ghi chú thêm: màu sắc, phụ kiện, cổ áo..."
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
      {job.running ? "Đang thử đồ AI..." : "Thay trang phục bằng ChatGPT"}
    </button>
  );

  return (
    <ToolLayout toolId={TOOL_ID} aside={aside} footer={footer}>
      <div className="flex h-full min-h-0 flex-col gap-3 p-4">
        <ChatGptJobBanner
          toolId={TOOL_ID}
          steps={STEPS}
          onFetch={() =>
            job.submit({
              prompt: "",
              imagePaths: [...imagePaths, ...job.history],
              expected: 1,
              newChat: false,
              collectOnly: true,
              steps: ["Đang quét các ảnh ChatGPT đã tạo..."],
            })
          }
        />

        {!current ? (
          <div className="min-h-0 flex-1">
            <EmptyState
              icon={Sparkles}
              title="Studio Thay Trang Phục AI"
              text="Tải ảnh người mẫu ở cột trái, kèm ảnh bộ đồ muốn thử (hoặc chọn mô tả trang phục nhanh) rồi bấm 'Thay trang phục bằng ChatGPT'. Khuôn mặt, vóc dáng và nền gốc được giữ nguyên 100%."
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                value={view === "triple" && !garmentPath ? "compare" : view}
                onChange={setView}
                options={[
                  ...(garmentPath ? [{ value: "triple", label: "3 Ảnh Cạnh Nhau" }] : []),
                  ...(modelPath ? [{ value: "compare", label: "So sánh Trước / Sau" }] : []),
                  { value: "single", label: "Kết quả đơn" },
                ]}
              />
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button className="btn btn-sm" onClick={() => setZoomed(current)}>
                  <Maximize2 className="h-4 w-4" /> Phóng to
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "upscayl", path: current })}>
                  <ImageUpscale className="h-4 w-4" /> Kích nét
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "layer-separation", path: current })}>
                  <Layers className="h-4 w-4" /> Bóc tách layer
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "vector", path: current })}>
                  <PenTool className="h-4 w-4" /> Vector
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => saveOne(current)}>
                  <Download className="h-4 w-4" /> Tải về
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-content/10 bg-base-100">
              {view === "triple" && modelPath && garmentPath ? (
                <div className="grid h-full grid-cols-3 gap-2 p-3">
                  {[
                    { label: "Người mẫu gốc", src: fileUrl(modelPath) },
                    { label: "Trang phục mẫu", src: fileUrl(garmentPath) },
                    { label: "Kết quả thử đồ", src: fileUrl(current) },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="checkerboard relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-base-content/10"
                    >
                      <span className="absolute left-2 top-2 z-10 rounded-md bg-slate-950/75 px-2 py-0.5 text-[11px] font-bold text-white">
                        {item.label}
                      </span>
                      <img
                        src={item.src}
                        alt={item.label}
                        onClick={() => setZoomed(current)}
                        className="h-full w-full cursor-zoom-in object-contain p-2"
                      />
                    </div>
                  ))}
                </div>
              ) : modelPath && view === "compare" ? (
                <CompareView before={fileUrl(modelPath)} after={fileUrl(current)} beforeLabel="Người mẫu gốc" afterLabel="Đã thay đồ" />
              ) : (
                <div className="checkerboard flex h-full items-center justify-center p-3">
                  <img
                    src={fileUrl(current)}
                    alt=""
                    className="max-h-full max-w-full cursor-zoom-in object-contain"
                    onClick={() => setZoomed(current)}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder="Chỉnh bằng AI: mô tả thay đổi (VD: đổi màu áo sang xanh pastel, thêm vòng cổ ngọc trai...)"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refine()}
                disabled={job.running}
              />
              <button className="btn btn-secondary btn-sm" onClick={refine} disabled={job.running || !editText.trim()}>
                <Wand2 className="h-4 w-4" /> Gửi sửa đổi
              </button>
            </div>

            {job.history.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                  {job.history.map((path, index) => (
                    <button
                      key={path}
                      onClick={() => setSelected(path)}
                      className={cn(
                        "checkerboard h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                        path === current ? "border-primary shadow-md" : "border-transparent opacity-70 hover:opacity-100",
                      )}
                      title={`Kết quả ${job.history.length - index}`}
                    >
                      <img src={fileUrl(path)} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
                <button className="btn btn-sm shrink-0" onClick={saveAll}>
                  <FolderDown className="h-4 w-4" /> Lưu tất cả ({job.history.length})
                </button>
              </div>
            )}
          </>
        )}

        <ZoomModal src={zoomed ? fileUrl(zoomed) : null} title="Thay trang phục AI" onClose={() => setZoomed(null)} />
      </div>
    </ToolLayout>
  );
}
