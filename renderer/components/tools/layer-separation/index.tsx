import React, { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import {
  CheckCircle2,
  Combine,
  Download,
  FolderDown,
  Layers,
  Loader2,
  Maximize2,
  MousePointerSquareDashed,
  PenTool,
  ShieldAlert,
  Sparkles,
  Type,
  Zap,
} from "lucide-react";
import {
  buildDirectLayerNextPrompt,
  buildDirectLayerStartPrompt,
  LAYERS_PER_BATCH,
  MAX_DIRECT_LAYERS,
} from "@common/sequential-layers";
import { cn } from "@/lib/utils";
import { sendImageToToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  fileExtension,
  fileName,
  fileUrl,
  IMAGE_SAVE_FILTERS,
  ImageInput,
  OptionCards,
  saveFileAs,
  saveFilesToFolder,
  Section,
  storeImageFile,
  ToolLayout,
  usePendingToolImage,
  ZoomModal,
} from "../common";
import { ChatGptJobBanner, useChatGptJob } from "../common/chatgpt-job";
import LayerCompositionModal from "./composition-modal";
import RegionEditor from "./region-editor";
import {
  annotateImage,
  AnnotationVariant,
  AUTO_LAYER_COUNT,
  autoContinuePrompt,
  autoPrompt,
  customContinuePrompt,
  customPrompt,
  Region,
  textContinuePrompt,
  textPrompt,
} from "./prompts";

type Mode = "auto" | "sequential" | "custom" | "text";

const STEPS = [
  "Đang tải ảnh gốc & khởi tạo...",
  "Đang gửi yêu cầu bóc tách lớp sang AI...",
  "AI đang phân tích các đối tượng, chữ & ảnh nền...",
  "Đang bóc tách phông nền & xuất file PNG không nền...",
  "Đang hoàn tất và xuất danh sách các lớp layer...",
];

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  auto: "Tự động phân tách ảnh thành tối đa 10 layer trong 1 lượt. Có thể khoanh vùng vàng cam KHÔNG TÁCH để giữ chi tiết cố định trên nền.",
  sequential: "Tách theo từng đợt 5 ảnh (Layer 1 là Background sạch + các cụm đối tượng), tự động gửi 'Tiếp' cho đợt 2 và dừng sớm khi đã hết đối tượng.",
  custom: "Khoanh khung đỏ các đối tượng muốn tách; AI xuất từng đối tượng thành PNG trong suốt + 1 ảnh gốc đã xóa sạch chỗ tách.",
  text: "Khoanh các cụm chữ / slogan; AI xuất chữ PNG nền trong suốt (alpha = 0, giữ dấu tiếng Việt & hiệu ứng 3D) + 1 ảnh nền sạch đã xóa chữ.",
};

export default function LayerSeparationTool() {
  const { toast } = useToast();
  const sendImageToTool = useSetAtom(sendImageToToolAtom);
  const job = useChatGptJob("layer-separation");

  const [mode, setMode] = useState<Mode>("auto");
  const [imagePath, setImagePath] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [exclusions, setExclusions] = useState<Region[]>([]);
  const [editorVariant, setEditorVariant] = useState<AnnotationVariant | null>(null);
  const [composingOpen, setComposingOpen] = useState(false);

  // Layers from earlier jobs of this separation ("Tách tiếp" or sequential batch 2 keeps them)
  const [base, setBase] = useState<string[]>([]);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [total, setTotal] = useState(AUTO_LAYER_COUNT);
  const [seqFinishedEarly, setSeqFinishedEarly] = useState(false);

  const runSettings = useRef<{
    mode: Mode;
    regions: Region[];
    exclusions: Region[];
    source?: string;
    autoAdvancedBatch?: string;
  }>({
    mode: "auto",
    regions: [],
    exclusions: [],
  });
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  usePendingToolImage("layer-separation", (path) => {
    setImagePath(path);
    setRegions([]);
    setExclusions([]);
    toast({
      title: "Đã nạp ảnh vào Bóc Tách Layer",
      description: "Chọn tách tự động, tách theo đợt, tách đối tượng hoặc bóc tách chữ.",
    });
  });

  const ownJob = job.state && jobIds.includes(job.state.jobId);
  const layers = [...base, ...(ownJob ? job.state!.results : [])];
  const running = job.running && ownJob;
  const complete = seqFinishedEarly || layers.length >= total;
  const started = jobIds.length > 0;

  // Automatic batch-2 continuation in "sequential" mode
  useEffect(() => {
    if (!ownJob || !job.state) return;
    if (runSettings.current.mode !== "sequential") return;
    if (job.state.sequenceCompleted) {
      setSeqFinishedEarly(true);
      setTotal(Math.max(1, layers.length));
      return;
    }
    if (
      job.state.status === "done" &&
      layers.length >= LAYERS_PER_BATCH &&
      layers.length < MAX_DIRECT_LAYERS &&
      runSettings.current.autoAdvancedBatch !== job.state.jobId
    ) {
      runSettings.current.autoAdvancedBatch = job.state.jobId;
      const nextIndex = layers.length + 1;
      const prompt = buildDirectLayerNextPrompt(nextIndex, runSettings.current.exclusions);
      setBase(layers);
      const batchExpected = Math.min(LAYERS_PER_BATCH, MAX_DIRECT_LAYERS - layers.length);
      const nextId = job.submit({
        prompt,
        imagePaths: [],
        expected: batchExpected,
        newChat: false,
        stopOnTextComplete: true,
        steps: [`Đang tách đợt 2 (Layer ${nextIndex}..${MAX_DIRECT_LAYERS})...`, ...STEPS.slice(2)],
      });
      setJobIds((prev) => [...prev, nextId]);
    }
  }, [ownJob, job.state, layers.length]);

  const labelOf = (index: number) => {
    const { mode: m, regions: r } = runSettings.current;
    if (m === "sequential") {
      return index === 0 ? "Background sạch" : `Đối tượng ${index}`;
    }
    if (m === "custom") {
      return index === r.length ? "Background đã xóa vật thể" : r[index]?.name.trim() || `Đối tượng ${index + 1}`;
    }
    if (m === "text") {
      return index === r.length ? "Background đã xóa chữ" : r[index]?.name.trim() || `Cụm chữ ${index + 1}`;
    }
    return index === AUTO_LAYER_COUNT - 1 ? "Background" : `Đối tượng ${index + 1}`;
  };

  const fileNameOf = (index: number, path: string) =>
    `${labelOf(index).replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_")}.${fileExtension(path)}`;

  const start = async () => {
    if (!imagePath) {
      toast({ title: "Chưa có ảnh", description: "Hãy chọn ảnh cần bóc tách trước." });
      return;
    }
    if ((mode === "custom" || mode === "text") && regions.length === 0) {
      setEditorVariant(mode === "text" ? "text" : "target");
      return;
    }

    runSettings.current = { mode, regions, exclusions };
    setSeqFinishedEarly(false);
    setBase([]);

    let imagePaths = [imagePath];
    let prompt = "";
    let totalExpected = AUTO_LAYER_COUNT;
    let firstJobExpected = AUTO_LAYER_COUNT;
    let stopOnTextComplete = false;

    if (mode === "custom") {
      const annotated = await storeImageFile(await annotateImage(fileUrl(imagePath), regions, "target"), "vung-khoanh-do.png");
      imagePaths = [annotated];
      runSettings.current.source = annotated;
      prompt = customPrompt(regions);
      totalExpected = regions.length + 1;
      firstJobExpected = totalExpected;
    } else if (mode === "text") {
      const annotated = await storeImageFile(await annotateImage(fileUrl(imagePath), regions, "text"), "vung-chu-do.png");
      imagePaths = [imagePath, annotated];
      runSettings.current.source = annotated;
      prompt = textPrompt(regions);
      totalExpected = regions.length + 1;
      firstJobExpected = totalExpected;
    } else if (mode === "sequential") {
      if (exclusions.length > 0) {
        const maskPath = await storeImageFile(await annotateImage(fileUrl(imagePath), exclusions, "exclude"), "vung-khong-tach.png");
        imagePaths = [imagePath, maskPath];
        runSettings.current.source = maskPath;
      }
      prompt = buildDirectLayerStartPrompt(exclusions);
      totalExpected = MAX_DIRECT_LAYERS;
      firstJobExpected = LAYERS_PER_BATCH;
      stopOnTextComplete = true;
    } else {
      if (exclusions.length > 0) {
        const maskPath = await storeImageFile(await annotateImage(fileUrl(imagePath), exclusions, "exclude"), "vung-khong-tach.png");
        imagePaths = [maskPath];
        runSettings.current.source = maskPath;
      }
      prompt = autoPrompt(exclusions);
      totalExpected = AUTO_LAYER_COUNT;
      firstJobExpected = AUTO_LAYER_COUNT;
    }

    setTotal(totalExpected);
    const id = job.submit({
      prompt,
      imagePaths,
      expected: firstJobExpected,
      stopOnTextComplete,
      steps: STEPS,
    });
    setJobIds([id]);
  };

  const fetchResults = () => {
    setBase(layers);
    const id = job.submit({
      prompt: "",
      imagePaths: [imagePath, runSettings.current.source || "", ...layers].filter(Boolean),
      expected: Math.max(1, total - layers.length),
      newChat: false,
      collectOnly: true,
      steps: ["Đang quét các ảnh ChatGPT đã tạo..."],
    });
    setJobIds((prev) => [...prev, id]);
  };

  const continueSeparation = () => {
    const next = layers.length + 1;
    const { mode: m, regions: r, exclusions: ex } = runSettings.current;
    let prompt = "";
    let expected = Math.max(1, total - layers.length);
    let stopOnTextComplete = false;
    if (m === "custom") {
      prompt = customContinuePrompt(r, next);
    } else if (m === "text") {
      prompt = textContinuePrompt(r, next);
    } else if (m === "sequential") {
      prompt = buildDirectLayerNextPrompt(Math.min(MAX_DIRECT_LAYERS, Math.max(2, next)), ex);
      expected = Math.min(LAYERS_PER_BATCH, MAX_DIRECT_LAYERS - layers.length);
      stopOnTextComplete = true;
    } else {
      prompt = autoContinuePrompt(next, ex);
    }
    setBase(layers);
    const id = job.submit({ prompt, imagePaths: [], expected, newChat: false, stopOnTextComplete, steps: STEPS });
    setJobIds((prev) => [...prev, id]);
  };

  const saveOne = async (index: number) => {
    const path = layers[index];
    const ext = fileExtension(path);
    const saved = await saveFileAs({
      defaultName: fileNameOf(index, path),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, ...IMAGE_SAVE_FILTERS],
      sourcePath: path,
    });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  const saveAll = async () => {
    const count = await saveFilesToFolder({
      folderName: `LMS_Tach_Layer_${new Date().toLocaleString("vi-VN").replace(/[/:, ]+/g, "-")}`,
      files: layers.map((path, index) => ({
        sourcePath: path,
        name: `${String(index + 1).padStart(2, "0")}_${fileNameOf(index, path)}`,
      })),
    });
    if (count) toast({ title: `Đã tự động lưu ${count} ảnh layer` });
  };

  useEffect(() => {
    if (zoomIndex !== null && zoomIndex >= layers.length) setZoomIndex(null);
  }, [layers.length, zoomIndex]);

  const isAutoLike = mode === "auto" || mode === "sequential";
  const isBoxMode = mode === "custom" || mode === "text";

  const aside = (
    <>
      <Section step="01" title="Chế độ bóc tách">
        <OptionCards
          value={mode}
          onChange={(next: Mode) => {
            setMode(next);
            setRegions([]);
          }}
          options={[
            { value: "auto", label: "Tách một lượt", hint: "Tối đa 10 layer trong 1 lần" },
            { value: "sequential", label: "Tách theo đợt", hint: "Mỗi đợt 5 ảnh, ổn định cao" },
            { value: "custom", label: "Theo yêu cầu", hint: "Khoanh vùng vật thể cần tách" },
            { value: "text", label: "Bóc tách chữ", hint: "Chữ PNG không nền + xóa chữ" },
          ]}
        />
        <p className="text-[11px] font-light leading-4 text-base-content/70">{MODE_DESCRIPTIONS[mode]}</p>
      </Section>

      <Section
        step="02"
        title={mode === "text" ? "Ảnh & vùng chữ" : mode === "custom" ? "Ảnh & vùng chọn" : "Ảnh đầu vào & loại trừ"}
      >
        <ImageInput
          toolId="layer-separation"
          imagePath={imagePath}
          onChange={(path) => {
            setImagePath(path);
            setRegions([]);
            setExclusions([]);
          }}
        />

        {isBoxMode && imagePath && (
          <>
            <button
              type="button"
              className="btn btn-sm w-full border-red-500/40 bg-red-500/10 text-red-600 hover:border-red-500 hover:bg-red-500 hover:text-white dark:text-red-400"
              onClick={() => setEditorVariant(mode === "text" ? "text" : "target")}
            >
              {mode === "text" ? <Type className="h-4 w-4" /> : <MousePointerSquareDashed className="h-4 w-4" />}
              {regions.length
                ? mode === "text"
                  ? `Sửa vùng chữ đã chọn (${regions.length})`
                  : `Sửa vùng đối tượng (${regions.length})`
                : mode === "text"
                  ? "Chọn khối chữ cần tách"
                  : "Chọn vùng đối tượng cần tách"}
            </button>
            {regions.length > 0 && (
              <div className="space-y-1 rounded-xl border border-base-content/10 bg-base-100 p-2 text-[11px]">
                {regions.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-base-200"
                    onClick={() => setEditorVariant(mode === "text" ? "text" : "target")}
                  >
                    <span className="rounded bg-red-500/15 px-1 py-0.5 text-[10px] font-black text-red-500">#{i + 1}</span>
                    <span className="truncate font-medium">
                      {r.name.trim() || (mode === "text" ? `Khối chữ ${i + 1}` : `Đối tượng ${i + 1}`)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {isAutoLike && imagePath && (
          <>
            <button
              type="button"
              disabled={running}
              className="btn btn-sm w-full border-amber-500/40 bg-amber-500/10 text-amber-600 hover:border-amber-500 hover:bg-amber-500 hover:text-slate-950 dark:text-amber-400"
              onClick={() => setEditorVariant("exclude")}
            >
              <ShieldAlert className="h-4 w-4" />
              {exclusions.length ? `Sửa vùng KHÔNG TÁCH (${exclusions.length})` : "Khoanh vùng KHÔNG TÁCH (tùy chọn)"}
            </button>
            {exclusions.length > 0 && (
              <div className="space-y-1 rounded-xl border border-amber-500/25 bg-amber-500/5 p-2 text-[11px]">
                <div className="flex items-center justify-between px-1 font-bold text-amber-600 dark:text-amber-300">
                  <span>Giữ cố định trên nền:</span>
                  <button type="button" className="text-[10px] hover:underline" onClick={() => setExclusions([])}>
                    Xóa tất cả
                  </button>
                </div>
                {exclusions.map((r, i) => (
                  <button
                    key={r.id}
                    type="button"
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-base-200"
                    onClick={() => setEditorVariant("exclude")}
                  >
                    <span className="rounded bg-amber-500/20 px-1 py-0.5 text-[10px] font-black text-amber-500">#{i + 1}</span>
                    <span className="truncate font-medium">{r.name.trim() || `Không tách ${i + 1}`}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </Section>
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={!imagePath || running} onClick={start}>
      {running ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : mode === "text" ? (
        <Type className="h-4 w-4" />
      ) : mode === "custom" ? (
        <Layers className="h-4 w-4" />
      ) : (
        <Zap className="h-4 w-4" />
      )}
      {running
        ? "Đang bóc tách lớp..."
        : isBoxMode
          ? regions.length
            ? mode === "text"
              ? `Tách ${regions.length} cụm chữ (PNG không nền)`
              : `Tách ${regions.length} vùng đã chọn`
            : mode === "text"
              ? "Chọn khối chữ cần tách trước"
              : "Chọn vùng cần tách trước"
          : mode === "sequential"
            ? "Bắt đầu tách theo đợt (5 ảnh/lượt)"
            : "Bắt đầu tách lớp"}
    </button>
  );

  return (
    <ToolLayout
      toolId="layer-separation"
      aside={aside}
      footer={footer}
      actions={
        layers.length > 0 && (
          <>
            {imagePath && !running && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setComposingOpen(true)}
                data-tooltip-id="tooltip"
                data-tooltip-content="Tự động căn khớp các layer lên ảnh gốc, chỉnh vị trí & xuất file PSD / PDF / Corel / Illustrator"
              >
                <Combine className="h-4 w-4" /> Ghép layer & Xuất PSD/PDF
              </button>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={saveAll}>
              <FolderDown className="h-4 w-4" /> Tải toàn bộ ({layers.length} ảnh)
            </button>
          </>
        )
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-5">
        {started && (
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-base-content/10 bg-base-100 p-4 shadow-sm">
            {running ? (
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-content">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </span>
              </span>
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-extrabold">
                {running
                  ? `Đang quét liên tục & bóc tách... (${layers.length} / ${total} ảnh)`
                  : complete
                    ? `Đã hoàn tất bóc tách (${layers.length} ảnh)`
                    : `Đã nhận ${layers.length} / ${total} ảnh`}
              </h3>
              <p className="text-xs font-light text-base-content/70">
                {complete
                  ? "Bấm \"Ghép layer & Xuất PSD/PDF\" để tự căn tọa độ từng lớp và mở thẳng trong Photoshop, CorelDRAW hoặc Illustrator."
                  : running
                    ? "Các lớp hiện ra ngay khi ChatGPT tạo xong từng ảnh."
                    : "Nếu ChatGPT đã tạo xong mà ảnh chưa hiện, bấm \"Lấy kết quả từ ChatGPT\"; nếu còn thiếu lớp, bấm \"Tách tiếp\"."}
              </p>
            </div>
            {!running && imagePath && layers.length > 0 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setComposingOpen(true)}>
                <Combine className="h-4 w-4" /> Ghép layer
              </button>
            )}
            {!running && !complete && (
              <button
                type="button"
                className="btn btn-sm"
                onClick={fetchResults}
                data-tooltip-id="tooltip"
                data-tooltip-content="Lấy các ảnh ChatGPT đã tạo trong cuộc chat hiện tại về app"
              >
                <Download className="h-4 w-4" /> Lấy kết quả từ ChatGPT
              </button>
            )}
            {!running && !complete && layers.length > 0 && (
              <button type="button" className="btn btn-sm" onClick={continueSeparation}>
                <Layers className="h-4 w-4" /> Tách tiếp ({layers.length}/{total})
              </button>
            )}
          </div>
        )}

        {ownJob && <ChatGptJobBanner toolId="layer-separation" steps={STEPS} />}

        {!started ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-base-content/15 p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Layers className="h-8 w-8" />
            </span>
            <h3 className="text-lg font-extrabold">
              {imagePath
                ? mode === "sequential"
                  ? "Sẵn sàng tách theo đợt (mỗi đợt 5 ảnh)"
                  : mode === "text"
                    ? "Sẵn sàng bóc tách chữ PNG không nền"
                    : mode === "custom"
                      ? "Sẵn sàng tách vùng đã chọn"
                      : "Sẵn sàng bóc tách tự động (10 lớp layer)"
                : "Chưa có ảnh đầu vào"}
            </h3>
            <p className="max-w-lg text-sm font-light text-base-content/70">{MODE_DESCRIPTIONS[mode]}</p>
            <button
              type="button"
              className="btn btn-ghost btn-sm mt-2"
              onClick={() => {
                runSettings.current = { mode, regions, exclusions, source: imagePath };
                setTotal(isBoxMode && regions.length ? regions.length + 1 : AUTO_LAYER_COUNT);
                fetchResults();
              }}
              data-tooltip-id="tooltip"
              data-tooltip-content="Mở cuộc chat có kết quả trong tab ChatGPT trước, rồi bấm nút này"
            >
              <Download className="h-4 w-4" /> Đã tách trong ChatGPT? Lấy kết quả về app
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: seqFinishedEarly ? layers.length : total }).map((_, index) => {
              const path = layers[index];
              return (
                <div key={index} className="flex flex-col gap-2">
                  <div
                    className={cn(
                      "group relative aspect-square overflow-hidden rounded-2xl border",
                      path ? "checkerboard border-base-content/10" : "border-dashed border-base-content/20 bg-base-100",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-2 top-2 z-10 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black",
                        path ? "bg-slate-900/80 text-white" : "bg-base-200 text-base-content/60",
                      )}
                    >
                      {path ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Loader2 className={cn("h-3 w-3", running && "animate-spin")} />
                      )}
                      Layer {index + 1}
                    </span>
                    {path ? (
                      <button type="button" className="h-full w-full" onClick={() => setZoomIndex(index)}>
                        <img src={fileUrl(path)} alt={labelOf(index)} className="h-full w-full object-contain p-3" draggable={false} />
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition-all group-hover:bg-slate-950/40 group-hover:opacity-100">
                          <span className="flex items-center gap-1 rounded-lg bg-slate-900/80 px-2.5 py-1 text-xs font-bold text-white">
                            <Maximize2 className="h-3.5 w-3.5" /> Xem phóng to
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-[11px] text-base-content/50">
                        {running && index === layers.length
                          ? "AI đang vẽ & bóc tách..."
                          : running
                            ? "Đang chờ trong hàng đợi..."
                            : "Chờ bóc tách..."}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-xs font-extrabold" title={labelOf(index)}>
                      {labelOf(index)}
                    </span>
                    {path && (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => sendImageToTool({ toolId: "upscayl", path })}
                          data-tooltip-id="tooltip"
                          data-tooltip-content="Gửi layer này sang Kích nét 4K"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => sendImageToTool({ toolId: "vector", path })}
                          data-tooltip-id="tooltip"
                          data-tooltip-content="Gửi layer này sang Vector SVG"
                        >
                          <PenTool className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => saveOne(index)}
                          data-tooltip-id="tooltip"
                          data-tooltip-content="Tải ảnh này"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editorVariant && imagePath && (
        <RegionEditor
          src={fileUrl(imagePath)}
          variant={editorVariant}
          initial={editorVariant === "exclude" ? exclusions : regions}
          onClose={() => setEditorVariant(null)}
          onSave={(next) => {
            if (editorVariant === "exclude") {
              setExclusions(next);
              if (next.length) {
                toast({
                  title: "Đã lưu vùng KHÔNG TÁCH",
                  description: `${next.length} vùng sẽ được giữ nguyên trên ảnh nền.`,
                });
              }
            } else {
              setRegions(next);
              if (next.length) {
                toast({
                  title: "Đã chọn vùng thành công",
                  description: `Đã khoanh ${next.length} ${editorVariant === "text" ? "cụm chữ" : "đối tượng"} cần bóc tách.`,
                });
              }
            }
            setEditorVariant(null);
          }}
        />
      )}

      {composingOpen && imagePath && layers.length > 0 && (
        <LayerCompositionModal
          originalSource={fileUrl(imagePath)}
          fileName={fileName(imagePath)}
          inputs={layers.map((path, idx) => {
            const title = labelOf(idx);
            return {
              id: `layer-${idx}-${path}`,
              title,
              source: fileUrl(path),
              isBackground: /background|phông nền|ảnh nền|^nền(?:\s|$)/i.test(title),
            };
          })}
          onClose={() => setComposingOpen(false)}
        />
      )}

      <ZoomModal
        src={zoomIndex !== null && layers[zoomIndex] ? fileUrl(layers[zoomIndex]) : null}
        title={zoomIndex !== null ? `${labelOf(zoomIndex)} · Layer ${zoomIndex + 1}/${layers.length}` : ""}
        onClose={() => setZoomIndex(null)}
        onPrev={zoomIndex ? () => setZoomIndex(zoomIndex - 1) : undefined}
        onNext={zoomIndex !== null && zoomIndex < layers.length - 1 ? () => setZoomIndex(zoomIndex + 1) : undefined}
      />
    </ToolLayout>
  );
}
