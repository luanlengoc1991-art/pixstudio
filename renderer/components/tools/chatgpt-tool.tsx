import React, { useMemo, useState } from "react";
import { Copy, Sparkles } from "lucide-react";
import { ToolId } from "@/lib/tools";
import { AI_TOOLS, withNote } from "@/lib/ai-tools";
import { useToast } from "@/components/ui/use-toast";
import { ImageInput, OptionCards, Section, ToolLayout, usePendingToolImage } from "./common";
import { useChatGptJob } from "./common/chatgpt-job";
import { ChatGptResults } from "./common/chatgpt-results";

const STEP_LABELS = ["01", "02", "03", "04", "05", "06", "07", "08", "09"];

/** Shared screen for the tools that run through the embedded ChatGPT tab. */
export default function ChatGptTool({ toolId }: { toolId: ToolId }) {
  const config = AI_TOOLS[toolId]!;
  const { toast } = useToast();
  const job = useChatGptJob(toolId);

  const [images, setImages] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.fields.map((field) => [field.key, field.type === "choice" ? field.options[0].value : ""]),
    ),
  );
  const [note, setNote] = useState("");

  // An image sent from another tool fills the first slot
  usePendingToolImage(toolId, (path) => setImages((prev) => ({ ...prev, [config.slots[0].key]: path })));

  const imagePaths = config.slots.map((slot) => images[slot.key]).filter(Boolean);
  const prompt = useMemo(() => {
    const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]));
    return withNote(config.buildPrompt({ ...trimmed, __hasImages: imagePaths.length ? "1" : "0" }), note);
  }, [config, values, note, imagePaths.length]);

  const firstEmpty = config.slots.findIndex((slot) => !images[slot.key]);
  const pasteSlot = firstEmpty === -1 ? 0 : firstEmpty;
  const expected = config.expected?.(values) ?? 1;

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
    job.submit({ prompt, imagePaths, expected, steps: config.steps });
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

      <PromptPreview prompt={prompt} />
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
      <ChatGptResults
        toolId={toolId}
        steps={config.steps}
        before={images[config.slots[0].key]}
        resultLabel={config.resultLabel}
        inputPaths={imagePaths}
        expected={expected}
        emptyText={`Chọn ảnh và tùy chọn bên trái rồi bấm "${config.action}". App tự gửi sang ChatGPT (tài khoản của bạn), chờ tạo xong và lấy ảnh về đây.`}
      />
    </ToolLayout>
  );
}

/** Collapsible view of the exact request sent to ChatGPT, with a copy button. */
export function PromptPreview({ prompt }: { prompt: string }) {
  const { toast } = useToast();
  return (
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
  );
}
