import React, { useMemo, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ImageUpscale,
  Loader2,
  LogOut,
  Maximize2,
  MessageSquareShare,
  Trash2,
} from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { ChatGptOpenPayload } from "@common/types/types";
import { cn } from "@/lib/utils";
import { getTool, ToolId } from "@/lib/tools";
import { AI_TOOLS, withNote } from "@/lib/ai-tools";
import {
  chatGptResultsAtom,
  chatGptStatusAtom,
  openToolAtom,
  pendingUpscaleImageAtom,
} from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  EmptyState,
  errorMessage,
  fileUrl,
  IMAGE_SAVE_FILTERS,
  ImageInput,
  OptionCards,
  saveFileAs,
  Section,
  ToolLayout,
  ZoomModal,
} from "./common";

const STEP_LABELS = ["01", "02", "03", "04", "05", "06", "07", "08"];

const extension = (path: string) => path.split(".").pop()?.toLowerCase() || "png";

/** Shared screen for the tools that run through the user's ChatGPT window. */
export default function ChatGptTool({ toolId }: { toolId: ToolId }) {
  const config = AI_TOOLS[toolId]!;
  const tool = getTool(toolId);
  const { toast } = useToast();
  const openTool = useSetAtom(openToolAtom);
  const setPendingUpscale = useSetAtom(pendingUpscaleImageAtom);
  const [allResults, setAllResults] = useAtom(chatGptResultsAtom);
  const status = useAtomValue(chatGptStatusAtom)[toolId];
  const results = allResults[toolId] ?? [];

  const [images, setImages] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [field.key, field.type === "choice" ? field.options[0].value : ""]),
    ),
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);

  const imagePaths = config.slots.map((slot) => images[slot.key]).filter(Boolean);
  const prompt = useMemo(() => {
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    return withNote(
      config.buildPrompt({ ...trimmed, __hasImages: imagePaths.length ? "1" : "0" }),
      note,
    );
  }, [config, values, note, imagePaths.length]);

  // Ctrl+V fills the first empty slot (or the first slot once all are filled)
  const firstEmpty = config.slots.findIndex((slot) => !images[slot.key]);
  const pasteSlot = firstEmpty === -1 ? 0 : firstEmpty;

  const missing = () => {
    const slot = config.slots.find((s) => s.required && !images[s.key]);
    if (slot) return `Hãy chọn ${slot.label.toLowerCase()}.`;
    const field = config.fields.find((f) => f.type === "text" && f.required && !values[f.key]?.trim());
    if (field) return `Hãy nhập "${field.title}".`;
    return "";
  };

  const send = async () => {
    const problem = missing();
    if (problem) {
      toast({ title: "Còn thiếu thông tin", description: problem });
      return;
    }
    setBusy(true);
    try {
      const payload: ChatGptOpenPayload = { toolId, imagePaths, prompt };
      await window.electron.invoke(ELECTRON_COMMANDS.CHATGPT_OPEN, payload);
    } catch (error) {
      toast({ title: "Không mở được ChatGPT", description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt);
    toast({ title: "Đã sao chép yêu cầu" });
  };

  const logout = async () => {
    await window.electron.invoke(ELECTRON_COMMANDS.CHATGPT_LOGOUT, undefined);
    toast({ title: "Đã đăng xuất ChatGPT", description: "Lần sau mở ChatGPT sẽ cần đăng nhập lại." });
  };

  const save = async (path: string, index: number) => {
    const ext = extension(path);
    const saved = await saveFileAs({
      defaultName: `${toolId}_${results.length - index}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, ...IMAGE_SAVE_FILTERS],
      sourcePath: path,
    });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  const removeResult = (path: string) =>
    setAllResults((prev) => ({ ...prev, [toolId]: (prev[toolId] ?? []).filter((p) => p !== path) }));

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
        <p className="mt-2 whitespace-pre-wrap leading-5 text-base-content/70">{prompt}</p>
        <button className="btn btn-ghost btn-xs mt-2" onClick={copyPrompt}>
          <Copy className="h-3.5 w-3.5" /> Sao chép
        </button>
      </details>

      <div className="flex items-center justify-between text-[11px] text-base-content/60">
        <span>Dùng tài khoản ChatGPT của bạn (cần gói có tạo ảnh).</span>
        <button className="btn btn-ghost btn-xs" onClick={logout} data-tooltip-id="tooltip" data-tooltip-content="Xóa phiên đăng nhập ChatGPT đã lưu">
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={busy} onClick={send}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquareShare className="h-4 w-4" />}
      {busy ? "Đang chuyển sang ChatGPT..." : status ? "Dán lại vào ChatGPT" : config.action}
    </button>
  );

  return (
    <ToolLayout toolId={toolId} aside={aside} footer={footer}>
      {status && (
        <div
          className={cn(
            "m-4 mb-0 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs",
            status.state === "error" || status.state === "login"
              ? "border-warning/40 bg-warning/10"
              : status.state === "ready"
                ? "border-success/40 bg-success/10"
                : "border-primary/30 bg-primary/10",
          )}
        >
          {status.state === "error" || status.state === "login" ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          ) : status.state === "ready" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          ) : (
            <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
          )}
          <span>{status.message}</span>
        </div>
      )}

      {results.length === 0 ? (
        <EmptyState
          icon={tool.icon}
          title="Chạy bằng ChatGPT của bạn"
          text={`1. Chọn ảnh và tùy chọn bên trái, bấm "${config.action}". 2. PixStudio mở ChatGPT, tự dán ảnh và yêu cầu; bạn kiểm tra rồi bấm Gửi. 3. Khi ChatGPT tạo xong, bấm nút tải xuống trên ảnh (hoặc chuột phải → "Đưa ảnh này về PixStudio"), ảnh sẽ hiện ở đây.`}
        />
      ) : (
        <div className="grid min-h-0 flex-1 auto-rows-[minmax(260px,1fr)] grid-cols-1 gap-4 overflow-y-auto p-4 lg:grid-cols-2">
          {results.map((path, index) => (
            <div key={path} className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 shadow-sm">
              <div className="flex items-center justify-between border-b border-base-content/10 px-3 py-2">
                <span className="text-[11px] font-black uppercase tracking-wide text-base-content/70">
                  Kết quả {results.length - index}
                </span>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-xs" onClick={() => setZoomed(path)} data-tooltip-id="tooltip" data-tooltip-content="Phóng to">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => {
                      setPendingUpscale(path);
                      openTool("upscayl");
                    }}
                    data-tooltip-id="tooltip"
                    data-tooltip-content="Kích nét 4K"
                  >
                    <ImageUpscale className="h-3.5 w-3.5" />
                  </button>
                  <button className="btn btn-ghost btn-xs" onClick={() => removeResult(path)} data-tooltip-id="tooltip" data-tooltip-content="Bỏ khỏi danh sách">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button className="btn btn-primary btn-xs" onClick={() => save(path, index)}>
                    <Download className="h-3.5 w-3.5" /> Lưu
                  </button>
                </div>
              </div>
              <div className="checkerboard flex min-h-0 flex-1 items-center justify-center p-3">
                <img src={fileUrl(path)} alt="" className="max-h-full max-w-full object-contain" draggable={false} />
              </div>
            </div>
          ))}
        </div>
      )}

      <ZoomModal src={zoomed ? fileUrl(zoomed) : null} title={tool.title} onClose={() => setZoomed(null)} />
    </ToolLayout>
  );
}
