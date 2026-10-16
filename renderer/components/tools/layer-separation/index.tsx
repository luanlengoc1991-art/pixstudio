import React, { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { CheckCircle2, Download, FolderDown, Layers, Loader2, Maximize2, MousePointerSquareDashed, PenTool, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { sendImageToToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  fileExtension,
  fileUrl,
  IMAGE_SAVE_FILTERS,
  ImageInput,
  saveFileAs,
  saveFilesToFolder,
  Section,
  Segmented,
  storeImageFile,
  ToolLayout,
  usePendingToolImage,
  ZoomModal,
} from "../common";
import { ChatGptJobBanner, useChatGptJob } from "../common/chatgpt-job";
import RegionEditor from "./region-editor";
import {
  annotateImage,
  AUTO_LAYER_COUNT,
  autoContinuePrompt,
  autoPrompt,
  customContinuePrompt,
  customPrompt,
  Region,
} from "./prompts";

type Mode = "auto" | "custom";

const STEPS = [
  "Đang tải ảnh gốc & khởi tạo...",
  "Đang gửi yêu cầu bóc tách lớp sang AI...",
  "AI đang phân tích các đối tượng & ảnh nền...",
  "Đang bóc tách phông nền & xuất file PNG không nền...",
  "Đang hoàn tất và xuất danh sách các lớp layer...",
];

export default function LayerSeparationTool() {
  const { toast } = useToast();
  const sendImageToTool = useSetAtom(sendImageToToolAtom);
  const job = useChatGptJob("layer-separation");

  const [mode, setMode] = useState<Mode>("auto");
  const [imagePath, setImagePath] = useState("");
  const [regions, setRegions] = useState<Region[]>([]);
  const [editing, setEditing] = useState(false);
  // Layers from earlier jobs of this separation ("Tách tiếp" keeps them)
  const [base, setBase] = useState<string[]>([]);
  const [jobIds, setJobIds] = useState<string[]>([]);
  const [total, setTotal] = useState(AUTO_LAYER_COUNT);
  // Settings of the separation shown in the grid (mode and regions may be edited afterwards)
  const runSettings = useRef<{ mode: Mode; regions: Region[] }>({ mode: "auto", regions: [] });
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  usePendingToolImage("layer-separation", (path) => {
    setImagePath(path);
    setRegions([]);
    toast({ title: "Đã nạp ảnh vào Bóc Tách Layer", description: "Chọn tách tự động hoặc khoanh vùng đối tượng cần tách." });
  });

  const ownJob = job.state && jobIds.includes(job.state.jobId);
  const layers = [...base, ...(ownJob ? job.state!.results : [])];
  const running = job.running && ownJob;
  const complete = layers.length >= total;
  const started = jobIds.length > 0;

  const labelOf = (index: number) => {
    const { mode: m, regions: r } = runSettings.current;
    if (m === "custom") return index === r.length ? "Ảnh gốc đã mất chỗ tách" : r[index]?.name.trim() || `Đối tượng ${index + 1}`;
    return `Đối tượng ${index + 1}`;
  };
  const fileNameOf = (index: number, path: string) =>
    `${labelOf(index).replace(/\s+/g, "_")}.${fileExtension(path)}`;

  const start = async () => {
    if (!imagePath) {
      toast({ title: "Chưa có ảnh", description: "Hãy chọn ảnh cần bóc tách trước." });
      return;
    }
    if (mode === "custom" && regions.length === 0) {
      setEditing(true);
      return;
    }
    runSettings.current = { mode, regions };
    let source = imagePath;
    let prompt = autoPrompt();
    let expected = AUTO_LAYER_COUNT;
    if (mode === "custom") {
      source = await storeImageFile(await annotateImage(fileUrl(imagePath), regions), "vung-khoanh-do.png");
      prompt = customPrompt(regions);
      expected = regions.length + 1;
    }
    setBase([]);
    setTotal(expected);
    const id = job.submit({ prompt, imagePaths: [source], expected, steps: STEPS });
    setJobIds([id]);
  };

  // Asks ChatGPT, in the same conversation, for the layers still missing
  const continueSeparation = () => {
    const next = layers.length + 1;
    const { mode: m, regions: r } = runSettings.current;
    const prompt = m === "custom" ? customContinuePrompt(r, next) : autoContinuePrompt(next);
    setBase(layers);
    const id = job.submit({ prompt, imagePaths: [], expected: total - layers.length, newChat: false, steps: STEPS });
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
      folderName: `Tach_layer_${new Date().toLocaleString("vi-VN").replace(/[/:, ]+/g, "-")}`,
      files: layers.map((path, index) => ({ sourcePath: path, name: `${String(index + 1).padStart(2, "0")}_${fileNameOf(index, path)}` })),
    });
    if (count) toast({ title: `Đã tự động lưu ${count} ảnh` });
  };

  // Keep the lightbox in range when layers change
  useEffect(() => {
    if (zoomIndex !== null && zoomIndex >= layers.length) setZoomIndex(null);
  }, [layers.length, zoomIndex]);

  const aside = (
    <>
      <Section title="Chế độ bóc tách">
        <Segmented
          value={mode}
          onChange={(m: Mode) => setMode(m)}
          options={[
            { value: "auto", label: "Mặc định" },
            { value: "custom", label: "Theo yêu cầu" },
          ]}
        />
        <p className="text-[11px] font-light leading-4 text-base-content/70">
          {mode === "auto"
            ? "Tự động phân tách toàn bộ ảnh thành 10 layer đối tượng & nền."
            : "Khoanh khung đỏ đối tượng muốn tách; AI sẽ xóa vật thể trên ảnh gốc và xuất layer PNG riêng."}
        </p>
      </Section>

      <Section title={mode === "custom" ? "Ảnh & vùng chọn" : "Tải ảnh đầu vào"}>
        <ImageInput
          toolId="layer-separation"
          imagePath={imagePath}
          onChange={(path) => {
            setImagePath(path);
            setRegions([]);
          }}
        />
        {mode === "custom" && imagePath && (
          <>
            <button
              className="btn btn-sm w-full border-red-500/40 bg-red-500/10 text-red-600 hover:border-red-500 hover:bg-red-500 hover:text-white dark:text-red-400"
              onClick={() => setEditing(true)}
            >
              <MousePointerSquareDashed className="h-4 w-4" />
              {regions.length ? `Sửa vùng đã chọn (${regions.length})` : "Chọn vùng cần tách"}
            </button>
            {regions.length > 0 && (
              <div className="space-y-1 rounded-xl border border-base-content/10 bg-base-100 p-2 text-[11px]">
                {regions.map((r, i) => (
                  <button
                    key={r.id}
                    className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left hover:bg-base-200"
                    onClick={() => setEditing(true)}
                  >
                    <span className="rounded bg-red-500/15 px-1 py-0.5 text-[10px] font-black text-red-500">#{i + 1}</span>
                    <span className="truncate font-medium">{r.name.trim() || `Đối tượng ${i + 1}`}</span>
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
      {running ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "custom" ? <Layers className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
      {running
        ? "Đang bóc tách lớp..."
        : mode === "custom"
          ? regions.length
            ? `Tách ${regions.length} vùng đã chọn`
            : "Chọn vùng cần tách trước"
          : "Bắt đầu tách lớp"}
    </button>
  );

  return (
    <ToolLayout toolId="layer-separation" aside={aside} footer={footer}>
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
                    ? `Đã hoàn tất bóc tách (${layers.length} / ${total} ảnh)`
                    : `Đã nhận ${layers.length} / ${total} ảnh`}
              </h3>
              <p className="text-xs font-light text-base-content/70">
                {complete
                  ? "Tất cả các lớp PNG không nền và ảnh nền đã sẵn sàng để tải về hoặc sử dụng."
                  : running
                    ? "Các lớp hiện ra ngay khi ChatGPT tạo xong từng ảnh."
                    : "ChatGPT chưa trả đủ các lớp. Bấm \"Tách tiếp\" để lấy phần còn lại."}
              </p>
            </div>
            {!running && !complete && layers.length > 0 && (
              <button className="btn btn-sm" onClick={continueSeparation}>
                <Layers className="h-4 w-4" /> Tách tiếp các lớp ({layers.length}/{total})
              </button>
            )}
            {layers.length > 0 && (
              <button className="btn btn-primary btn-sm" onClick={saveAll}>
                <FolderDown className="h-4 w-4" /> Tải tất cả ({layers.length} ảnh)
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
              {imagePath ? (mode === "auto" ? "Sẵn sàng bóc tách tự động (10 lớp layer)" : "Sẵn sàng tách") : "Chưa có ảnh"}
            </h3>
            <p className="max-w-md text-sm font-light text-base-content/70">
              {mode === "auto"
                ? "Tải ảnh JPG hoặc PNG ở bảng bên trái và nhấn \"Bắt đầu tách lớp\" để AI tự động trích xuất các layer PNG không nền."
                : regions.length
                  ? `Đã chọn ${regions.length} vùng. AI sẽ tạo ${regions.length + 1} file (${regions.length} ảnh PNG không nền + 1 ảnh gốc đã mất chỗ tách).`
                  : "Bấm \"Chọn vùng cần tách\" để khoanh các đối tượng. AI sẽ bóc tách các đối tượng đã chọn và 1 ảnh gốc đã mất chỗ tách."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: total }).map((_, index) => {
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
                      {path ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Loader2 className={cn("h-3 w-3", running && "animate-spin")} />}
                      Layer {index + 1}
                    </span>
                    {path ? (
                      <button className="h-full w-full" onClick={() => setZoomIndex(index)}>
                        <img src={fileUrl(path)} alt={labelOf(index)} className="h-full w-full object-contain p-3" draggable={false} />
                        <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 opacity-0 transition-all group-hover:bg-slate-950/40 group-hover:opacity-100">
                          <span className="flex items-center gap-1 rounded-lg bg-slate-900/80 px-2.5 py-1 text-xs font-bold text-white">
                            <Maximize2 className="h-3.5 w-3.5" /> Xem phóng to
                          </span>
                        </span>
                      </button>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-[11px] text-base-content/50">
                        {running && index === layers.length ? "AI đang vẽ & bóc tách..." : running ? "Đang chờ trong hàng đợi..." : "Chờ bóc tách..."}
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
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => sendImageToTool({ toolId: "upscayl", path })}
                          data-tooltip-id="tooltip"
                          data-tooltip-content="Gửi ảnh này sang Kích nét để phóng to 4K"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => sendImageToTool({ toolId: "vector", path })}
                          data-tooltip-id="tooltip"
                          data-tooltip-content="Gửi layer này sang Vector để bóc tách SVG"
                        >
                          <PenTool className="h-3.5 w-3.5" />
                        </button>
                        <button
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

      {editing && imagePath && (
        <RegionEditor
          src={fileUrl(imagePath)}
          initial={regions}
          onClose={() => setEditing(false)}
          onSave={(next) => {
            setRegions(next);
            setEditing(false);
            if (next.length) toast({ title: "Đã chọn vùng thành công", description: `Đã khoanh ${next.length} đối tượng cần bóc tách.` });
          }}
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
