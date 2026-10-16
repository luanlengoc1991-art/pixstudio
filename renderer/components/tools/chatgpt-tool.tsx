import React, { useEffect, useMemo, useState } from "react";
import { useSetAtom } from "jotai";
import {
  Copy,
  Download,
  FolderDown,
  ImageUpscale,
  Maximize2,
  PenTool,
  Sparkles,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTool, ToolId } from "@/lib/tools";
import { AI_TOOLS, withNote } from "@/lib/ai-tools";
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

const STEP_LABELS = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];

/** Shared screen for the tools that run through the embedded ChatGPT tab. */
export default function ChatGptTool({ toolId }: { toolId: ToolId }) {
  const config = AI_TOOLS[toolId]!;
  const tool = getTool(toolId);
  const { toast } = useToast();
  const sendImageToTool = useSetAtom(sendImageToToolAtom);
  const job = useChatGptJob(toolId);

  const [images, setImages] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [field.key, field.type === "choice" ? field.options[0].value : ""]),
    ),
  );
  const [note, setNote] = useState("");
  const [editText, setEditText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"compare" | "single">("compare");
  const [zoomed, setZoomed] = useState<string | null>(null);

  // An image sent from another tool fills the first slot
  usePendingToolImage(toolId, (path) => setImages((prev) => ({ ...prev, [config.slots[0].key]: path })));

  const imagePaths = config.slots.map((slot) => images[slot.key]).filter(Boolean);
  const prompt = useMemo(() => {
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    return withNote(config.buildPrompt({ ...trimmed, __hasImages: imagePaths.length ? "1" : "0" }), note);
  }, [config, values, note, imagePaths.length]);

  // Show the newest result as soon as it arrives
  const newest = job.history[0];
  useEffect(() => {
    if (newest) setSelected(newest);
  }, [newest]);
  const current = selected && job.history.includes(selected) ? selected : newest;
  const before = images[config.slots[0].key];

  const firstEmpty = config.slots.findIndex((slot) => !images[slot.key]);
  const pasteSlot = firstEmpty === -1 ? 0 : firstEmpty;

  const missing = () => {
    const slot = config.slots.find((s) => s.required && !images[s.key]);
    if (slot) return `Hãy chọn ${slot.label.toLowerCase()}.`;
    const field = config.fields.find((f) => f.type === "text" && f.required && !values[f.key]?.trim());
    if (field) return `Hãy nhập "${field.title}".`;
    return "";
  };

  const run = () => {
    const problem = missing();
    if (problem) {
      toast({ title: "Còn thiếu thông tin", description: problem });
      return;
    }
    job.submit({
      prompt,
      imagePaths,
      expected: config.expected?.(values) ?? 1,
      steps: config.steps,
    });
  };

  const refine = () => {
    if (!editText.trim()) return;
    job.submit({
      prompt: `Hãy chỉnh sửa lại ảnh vừa tạo theo yêu cầu sau, giữ nguyên mọi thứ khác: ${editText.trim()}`,
      imagePaths: [],
      newChat: false,
      nativeEdit: true,
      steps: config.steps,
    });
    setEditText("");
  };

  const save = async (path: string) => {
    const ext = fileExtension(path);
    const saved = await saveFileAs({
      defaultName: `${toolId}_${Date.now()}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, ...IMAGE_SAVE_FILTERS],
      sourcePath: path,
    });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  const saveAll = async () => {
    const count = await saveFilesToFolder({
      folderName: `${tool.title} ${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}`,
      files: [...job.history].reverse().map((path, index) => ({
        sourcePath: path,
        name: `${toolId}_${index + 1}.${fileExtension(path)}`,
      })),
    });
    if (count) toast({ title: `Đã lưu ${count} ảnh` });
  };

  let step = 0;
  const aside = (
    <>
      {config.slots.map((slot, index) => (
        <Section key={slot.key} step={STEP_LABELS[step++]} title={slot.label} hint={slot.hint}>
          <ImageInput
            toolId={toolId}
            compact={config.slots.length > 1}
            acceptPaste={index === pasteSlot}
            imagePath={images[slot.key] ?? ""}
            onChange={(path) => setImages((prev) => ({ ...prev, [slot.key]: path }))}
          />
        </Section>
      ))}

      {config.fields.map((field) => (
        <Section key={field.key} step={STEP_LABELS[step++]} title={field.title}>
          {field.type === "choice" ? (
            <OptionCards
              columns={field.columns}
              options={field.options}
              value={values[field.key]}
              onChange={(value: string) => setValues((prev) => ({ ...prev, [field.key]: value }))}
            />
          ) : (
            <input
              className="input input-bordered input-sm w-full"
              placeholder={field.placeholder}
              value={values[field.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          )}
        </Section>
      ))}

      <Section step={STEP_LABELS[step++]} title="Ghi chú thêm" hint="Không bắt buộc, có thể viết tiếng Việt.">
        <textarea
          className="textarea textarea-bordered textarea-sm min-h-[64px] w-full"
          placeholder="Ví dụ: giữ nguyên logo, tông màu xanh dương..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Section>

      <details className="rounded-xl border border-base-content/10 bg-base-100 p-3 text-xs">
        <summary className="cursor-pointer font-bold">Xem yêu cầu gửi cho ChatGPT</summary>
        <p className="mt-2 whitespace-pre-wrap font-light leading-5 text-base-content/70">{prompt}</p>
        <button
          className="btn btn-ghost btn-xs mt-2"
          onClick={async () => {
            await navigator.clipboard.writeText(prompt);
            toast({ title: "Đã sao chép yêu cầu" });
          }}
        >
          <Copy className="h-3.5 w-3.5" /> Sao chép
        </button>
      </details>
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={job.running} onClick={run}>
      <Sparkles className="h-4 w-4" />
      {job.running ? "Đang xử lý..." : config.action}
    </button>
  );

  return (
    <ToolLayout toolId={toolId} aside={aside} footer={footer}>
      <div className="flex h-full min-h-0 flex-col gap-3 p-4">
        <ChatGptJobBanner toolId={toolId} steps={config.steps} />

        {!current ? (
          <div className="min-h-0 flex-1">
            <EmptyState
              icon={tool.icon}
              title="Kết quả sẽ hiển thị tại đây"
              text={`Chọn ảnh và tùy chọn bên trái rồi bấm "${config.action}". PixStudio tự gửi sang ChatGPT (tài khoản của bạn), chờ tạo xong và lấy ảnh về đây.`}
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {before && (
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "compare", label: "So sánh Trước / Sau" },
                    { value: "single", label: "Kết quả đơn" },
                  ]}
                />
              )}
              <div className="ml-auto flex flex-wrap gap-1.5">
                <button className="btn btn-sm" onClick={() => setZoomed(current)}>
                  <Maximize2 className="h-4 w-4" /> Phóng to
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "upscayl", path: current })}>
                  <ImageUpscale className="h-4 w-4" /> Kích nét 4K
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "vector", path: current })}>
                  <PenTool className="h-4 w-4" /> Chuyển Vector
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => save(current)}>
                  <Download className="h-4 w-4" /> Tải về
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-content/10 bg-base-100">
              {before && view === "compare" ? (
                <CompareView before={fileUrl(before)} after={fileUrl(current)} beforeLabel="Ảnh gốc" afterLabel={config.resultLabel} />
              ) : (
                <div className="checkerboard flex h-full items-center justify-center p-3">
                  <img src={fileUrl(current)} alt="" className="max-h-full max-w-full cursor-zoom-in object-contain" onClick={() => setZoomed(current)} />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder="Chỉnh bằng AI: mô tả thay đổi (VD: đổi nền sang màu hồng pastel, làm chữ to hơn...)"
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
      </div>

      <ZoomModal src={zoomed ? fileUrl(zoomed) : null} title={tool.title} onClose={() => setZoomed(null)} />
    </ToolLayout>
  );
}
