import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Crop, Download, LayoutGrid, Loader2, RotateCcw, Sparkles, Square, Trash2, XCircle } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/use-toast";
import { fileExtension, fileUrl, ImageInput, OptionCards, saveFileAs, saveFilesToFolder, Section, Segmented, storeImageFile } from "../common";
import { ChatGptJobBanner, isJobRunning, useChatGptJob } from "../common/chatgpt-job";
import { ChatGptResults } from "../common/chatgpt-results";
import { PromptPreview } from "../chatgpt-tool";
import {
  AGE_GROUPS,
  BACKGROUNDS,
  BATCH_SIZE,
  batchIdPrompt,
  DEFAULT_ID_OPTIONS,
  HAIRSTYLES,
  IdPhotoOptions,
  OUTFITS,
  singleIdPrompt,
} from "./ai-prompts";

const STEPS = [
  "Đang gửi ảnh chân dung sang ChatGPT...",
  "AI đang nhận diện khuôn mặt & giữ nguyên nét mặt...",
  "Đang chuẩn hóa trang phục, màu phông nền và làm đẹp khuôn mặt theo chuẩn studio...",
  "Đang hoàn tất ảnh thẻ...",
];

type BatchItem = { path: string; result?: string; status: "pending" | "processing" | "done" | "error" };

export type AiPanelState = ReturnType<typeof useAiPanelState>;

export function useAiPanelState() {
  const [kind, setKind] = useState<"single" | "batch">("single");
  const [source, setSource] = useState("");
  const [outfitImage, setOutfitImage] = useState("");
  const [options, setOptions] = useState<IdPhotoOptions>(DEFAULT_ID_OPTIONS);
  const [items, setItems] = useState<BatchItem[]>([]);
  const reset = () => {
    setOptions(DEFAULT_ID_OPTIONS);
    setOutfitImage("");
  };
  return { kind, setKind, source, setSource, outfitImage, setOutfitImage, options, setOptions, items, setItems, reset };
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-[11px] font-semibold">
      <span className="mb-1 flex justify-between">
        {label}
        <b className="text-primary">{value}%</b>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="range range-primary range-xs" />
    </label>
  );
}

/** Left column of the AI mode. */
export function AiAside({ state, onRun, onStop, batchRunning }: { state: AiPanelState; onRun: () => void; onStop: () => void; batchRunning: boolean }) {
  const { options: o, setOptions } = state;
  const set = (patch: Partial<IdPhotoOptions>) => setOptions((prev) => ({ ...prev, ...patch }));
  const { toast } = useToast();

  const addBatchFiles = async () => {
    const path = await window.electron.invoke(ELECTRON_COMMANDS.SELECT_FILE);
    if (path) state.setItems((prev) => [...prev, { path, status: "pending" }]);
  };

  return (
    <>
      <Segmented
        value={state.kind}
        onChange={(v: "single" | "batch") => state.setKind(v)}
        options={[
          { value: "single", label: "Chỉnh sửa một ảnh" },
          { value: "batch", label: `Hàng loạt (${BATCH_SIZE} ảnh/lượt)` },
        ]}
      />

      {state.kind === "single" ? (
        <Section step="01" title="Ảnh gốc đầu vào" hint="Ảnh chân dung JPG, PNG, WEBP. Ctrl+V để dán.">
          <ImageInput toolId="id-photo" imagePath={state.source} onChange={state.setSource} label="Bấm tải ảnh hoặc dán Ctrl+V" />
        </Section>
      ) : (
        <Section step="01" title={`Ảnh chân dung (${state.items.length})`} hint={`Tải bao nhiêu ảnh cũng được. Mỗi lần gửi ${BATCH_SIZE} ảnh sang ChatGPT và tự xử lý nối tiếp đến hết.`}>
          <div
            className="grid grid-cols-4 gap-1.5 rounded-2xl border border-base-content/10 bg-base-100 p-2"
            onDragOver={(e) => e.preventDefault()}
            onDrop={async (e) => {
              e.preventDefault();
              const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
              const paths = await Promise.all(files.map((f) => storeImageFile(f, f.name)));
              state.setItems((prev) => [...prev, ...paths.map((path) => ({ path, status: "pending" as const }))]);
            }}
          >
            {state.items.map((item, index) => (
              <div key={item.path + index} className="group relative aspect-[3/4] overflow-hidden rounded-lg">
                <img src={fileUrl(item.path)} alt="" className="h-full w-full object-cover" />
                <button
                  className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
                  onClick={() => state.setItems((prev) => prev.filter((_, i) => i !== index))}
                  disabled={batchRunning}
                  aria-label="Xóa ảnh"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addBatchFiles}
              className="flex aspect-[3/4] items-center justify-center rounded-lg border-2 border-dashed border-base-content/20 text-[10px] font-semibold text-base-content/60 hover:border-primary/60 hover:text-primary"
            >
              + Thêm
            </button>
          </div>
          {state.items.length > 0 && (
            <button className="btn btn-ghost btn-xs self-start" disabled={batchRunning} onClick={() => state.setItems([])}>
              <Trash2 className="h-3 w-3" /> Xóa tất cả
            </button>
          )}
        </Section>
      )}

      <Section step="02" title="Đối tượng & độ tuổi" hint="AI tự nhận diện giới tính từ ảnh gốc.">
        <OptionCards value={o.age} onChange={(v: string) => set({ age: v })} options={AGE_GROUPS} />
      </Section>

      <Section step="03" title="Trang phục">
        <OptionCards columns={3} value={o.outfit} onChange={(v: string) => set({ outfit: v })} options={OUTFITS} />
        {state.kind === "single" && (
          <ImageInput
            toolId="id-photo"
            compact
            acceptPaste={false}
            imagePath={state.outfitImage}
            onChange={state.setOutfitImage}
            label="Hoặc tải ảnh trang phục mẫu"
          />
        )}
        <input
          className="input input-bordered input-sm w-full"
          placeholder="Hoặc gõ mô tả trang phục riêng nếu có..."
          value={o.customOutfit}
          onChange={(e) => set({ customOutfit: e.target.value })}
        />
      </Section>

      <Section step="04" title="Kiểu tóc">
        <OptionCards columns={2} value={o.hair} onChange={(v: string) => set({ hair: v })} options={HAIRSTYLES} />
      </Section>

      <Section step="05" title="Phông nền & làm đẹp">
        <div className="flex flex-wrap items-center gap-2">
          {BACKGROUNDS.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => set({ background: b.color })}
              className={cn("h-8 w-8 rounded-full border-2", o.background === b.color ? "scale-110 border-primary" : "border-base-content/20")}
              style={{ background: b.color }}
              data-tooltip-id="tooltip"
              data-tooltip-content={b.label}
              aria-label={b.label}
            />
          ))}
          <label className="flex h-8 cursor-pointer items-center gap-1 rounded-full border border-base-content/20 bg-base-100 px-2 text-[11px] font-bold">
            <input type="color" className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0" value={o.background} onChange={(e) => set({ background: e.target.value })} />
            Màu khác
          </label>
        </div>
        <p className="text-[11px] font-light text-base-content/60">
          {BACKGROUNDS.find((b) => b.color === o.background)?.label ?? `Màu tự chọn ${o.background}`}
        </p>
        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-base-content/10 bg-base-100 px-3 py-2 text-xs font-semibold">
          Làm đẹp da (giữ trọn vẹn nét mặt)
          <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={o.beautify} onChange={(e) => set({ beautify: e.target.checked })} />
        </label>
        {o.beautify && <Slider label="Mức độ mịn da" value={o.smoothing} onChange={(v) => set({ smoothing: v })} />}
        <Slider label="Cân chỉnh độ sáng studio" value={o.brightness} onChange={(v) => set({ brightness: v })} />
      </Section>

      <Section step="06" title="Yêu cầu thêm">
        <textarea
          className="textarea textarea-bordered textarea-sm w-full"
          rows={2}
          placeholder="VD: Đeo kính cận gọng mỏng, cười mỉm nhẹ nhàng, thắt cà vạt đỏ..."
          value={o.extra}
          onChange={(e) => set({ extra: e.target.value })}
        />
      </Section>

      <PromptPreview prompt={state.kind === "single" ? singleIdPrompt({ ...o, hasOutfitImage: !!state.outfitImage }) : batchIdPrompt(o, Math.min(BATCH_SIZE, state.items.length || BATCH_SIZE))} />

      <div className="flex flex-col gap-2">
        {batchRunning ? (
          <button className="btn btn-error w-full" onClick={onStop}>
            <Square className="h-4 w-4" /> Dừng tạo
          </button>
        ) : (
          <button className="btn btn-primary w-full" onClick={onRun}>
            <Sparkles className="h-4 w-4" />
            {state.kind === "single"
              ? "TẠO ẢNH THẺ AI"
              : `TẠO ${state.items.length || ""} ẢNH THẺ${Math.ceil(state.items.length / BATCH_SIZE) > 1 ? ` (${Math.ceil(state.items.length / BATCH_SIZE)} đợt)` : ""}`}
          </button>
        )}
        <button
          className="btn btn-ghost btn-sm w-full"
          disabled={batchRunning}
          onClick={() => {
            state.reset();
            toast({ title: "Đã đặt lại cấu hình" });
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Đặt lại cấu hình
        </button>
      </div>
    </>
  );
}

/** Runs single or batch jobs and shows their results. */
export function useAiRunner(state: AiPanelState) {
  const { toast } = useToast();
  const job = useChatGptJob("id-photo");
  const [batchRunning, setBatchRunning] = useState(false);
  const batch = useRef<{ index: number; jobId: string } | null>(null);

  const submitBatch = (index: number) => {
    const slice = state.items.slice(index * BATCH_SIZE, (index + 1) * BATCH_SIZE);
    if (!slice.length) {
      setBatchRunning(false);
      return;
    }
    state.setItems((prev) => prev.map((item, i) => (i >= index * BATCH_SIZE && i < (index + 1) * BATCH_SIZE ? { ...item, status: "processing", result: undefined } : item)));
    const jobId = job.submit({ prompt: batchIdPrompt(state.options, slice.length), imagePaths: slice.map((i) => i.path), expected: slice.length, steps: STEPS });
    batch.current = { index, jobId };
  };

  // Map collected images onto the running batch, then start the next one
  useEffect(() => {
    const current = batch.current;
    const s = job.state;
    if (!current || !s || s.jobId !== current.jobId) return;
    const start = current.index * BATCH_SIZE;
    state.setItems((prev) =>
      prev.map((item, i) => {
        const result = s.results[i - start];
        if (i < start || i >= start + BATCH_SIZE) return item;
        if (result) return { ...item, status: "done", result };
        if (!isJobRunning(s.status) && item.status === "processing") return { ...item, status: "error" };
        return item;
      }),
    );
    if (isJobRunning(s.status)) return;
    batch.current = null;
    if (!batchRunning) return;
    if (s.status === "done" || s.status === "partial") {
      const next = current.index + 1;
      if (next * BATCH_SIZE < state.items.length) {
        const timer = window.setTimeout(() => submitBatch(next), 1600);
        return () => window.clearTimeout(timer);
      }
      toast({ title: "Đã hoàn tất tất cả các đợt ảnh thẻ" });
    }
    setBatchRunning(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.state]);

  const run = () => {
    if (state.kind === "single") {
      if (!state.source) {
        toast({ title: "Chưa có ảnh", description: "Hãy tải ảnh chân dung trước." });
        return;
      }
      job.submit({
        prompt: singleIdPrompt({ ...state.options, hasOutfitImage: !!state.outfitImage }),
        imagePaths: state.outfitImage ? [state.source, state.outfitImage] : [state.source],
        steps: STEPS,
      });
      return;
    }
    if (!state.items.length) {
      toast({ title: "Chưa có ảnh", description: "Hãy thêm ảnh chân dung cần xử lý." });
      return;
    }
    // Resume from the first batch that still has unfinished photos
    const firstOpen = state.items.findIndex((i) => i.status !== "done");
    setBatchRunning(true);
    submitBatch(firstOpen === -1 ? 0 : Math.floor(firstOpen / BATCH_SIZE));
  };

  const stop = () => {
    setBatchRunning(false);
    job.cancel();
    state.setItems((prev) => prev.map((i) => (i.status === "processing" ? { ...i, status: "pending" } : i)));
  };

  return { run, stop, batchRunning, job };
}

/** Right side: the single result view or the batch grid. */
export function AiStage({
  state,
  onCrop,
  onLayout,
}: {
  state: AiPanelState;
  onCrop: (path: string) => void;
  onLayout: (path: string) => void;
}) {
  const { toast } = useToast();

  if (state.kind === "single") {
    return (
      <ChatGptResults
        toolId="id-photo"
        steps={STEPS}
        before={state.source || undefined}
        resultLabel="Ảnh thẻ AI"
        inputPaths={[state.source, state.outfitImage].filter(Boolean)}
        emptyText="Tải ảnh chân dung lên hoặc dán Ctrl+V. AI sẽ tự động nhận diện khuôn mặt, đổi trang phục, phông nền & làm đẹp."
        extraActions={(current) => (
          <>
            <button className="btn btn-sm" onClick={() => onCrop(current)}>
              <Crop className="h-4 w-4" /> Cắt ảnh
            </button>
            <button className="btn btn-sm" onClick={() => onLayout(current)}>
              <LayoutGrid className="h-4 w-4" /> Xếp in
            </button>
          </>
        )}
      />
    );
  }

  const done = state.items.filter((i) => i.result);
  const saveAll = async () => {
    const count = await saveFilesToFolder({
      folderName: `Anh the AI ${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}`,
      files: done.map((item, index) => ({ sourcePath: item.result!, name: `anh-the_${index + 1}.${fileExtension(item.result!)}` })),
    });
    if (count) toast({ title: `Đã lưu ${count} ảnh` });
  };
  const saveOne = async (path: string, index: number) => {
    const ext = fileExtension(path);
    const saved = await saveFileAs({ defaultName: `anh-the_${index + 1}.${ext}`, filters: [{ name: ext.toUpperCase(), extensions: [ext] }], sourcePath: path });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <ChatGptJobBanner toolId="id-photo" steps={STEPS} />
      <div className="flex items-center gap-2 text-xs">
        <span>
          Tiến độ xử lý: <b>{done.length}</b> / {state.items.length} ảnh · Quy mô chia đợt: {BATCH_SIZE} ảnh/lượt
        </span>
        {done.length > 0 && (
          <button className="btn btn-primary btn-sm ml-auto" onClick={saveAll}>
            <Download className="h-4 w-4" /> Tải tất cả ({done.length})
          </button>
        )}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-2 gap-3 overflow-y-auto md:grid-cols-3 xl:grid-cols-5">
        {state.items.map((item, index) => (
          <div key={item.path + index} className="flex flex-col overflow-hidden rounded-2xl border border-base-content/10 bg-base-100">
            <div className="relative aspect-[3/4] bg-base-200">
              <img src={fileUrl(item.result ?? item.path)} alt="" className={cn("h-full w-full object-cover", !item.result && "opacity-50")} />
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                {item.status === "done" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : item.status === "processing" ? <Loader2 className="h-3 w-3 animate-spin" /> : item.status === "error" ? <XCircle className="h-3 w-3 text-red-400" /> : null}
                Ảnh {index + 1}
              </span>
            </div>
            {item.result && (
              <div className="grid grid-cols-3 gap-1 p-1.5">
                <button className="btn btn-ghost btn-xs" onClick={() => saveOne(item.result!, index)} data-tooltip-id="tooltip" data-tooltip-content="Tải ảnh về máy">
                  <Download className="h-3.5 w-3.5" />
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => onCrop(item.result!)} data-tooltip-id="tooltip" data-tooltip-content="Cắt ảnh">
                  <Crop className="h-3.5 w-3.5" />
                </button>
                <button className="btn btn-ghost btn-xs" onClick={() => onLayout(item.result!)} data-tooltip-id="tooltip" data-tooltip-content="Xếp in ảnh này">
                  <LayoutGrid className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
