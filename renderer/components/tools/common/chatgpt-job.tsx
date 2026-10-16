import React, { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { AlertTriangle, CheckCircle2, Download, Loader2, MessageCircle, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolId } from "@/lib/tools";
import { activeTabAtom } from "@/atoms/workspace-atom";
import {
  cancelChatGptJobAtom,
  chatGptHistoryAtom,
  chatGptToolStateAtom,
  submitChatGptJobAtom,
} from "@/atoms/chatgpt-atom";

export const isJobRunning = (status?: string) => status === "queued" || status === "sending" || status === "waiting";

/** Job state, history and actions of a tool that runs through ChatGPT. */
export const useChatGptJob = (toolId: ToolId) => {
  const state = useAtomValue(chatGptToolStateAtom)[toolId];
  const history = useAtomValue(chatGptHistoryAtom)[toolId] ?? [];
  const submit = useSetAtom(submitChatGptJobAtom);
  const cancel = useSetAtom(cancelChatGptJobAtom);
  return {
    state,
    history,
    running: isJobRunning(state?.status),
    submit: (job: Omit<Parameters<typeof submit>[0], "toolId">) => submit({ ...job, toolId }),
    cancel: () => cancel(toolId),
  };
};

/**
 * Progress banner for a ChatGPT job: cycles the tool's progress lines while
 * waiting and offers Stop and "Xem ChatGPT".
 */
export function ChatGptJobBanner({
  toolId,
  steps,
  className,
  onFetch,
}: {
  toolId: ToolId;
  steps: string[];
  className?: string;
  /** Collects the images already made in the ChatGPT chat (shown after an error or partial result) */
  onFetch?: () => void;
}) {
  const { state, running, cancel } = useChatGptJob(toolId);
  const setActiveTab = useSetAtom(activeTabAtom);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (state?.status !== "waiting") return;
    const timer = window.setInterval(() => setTick((t) => t + 1), 3500);
    return () => window.clearInterval(timer);
  }, [state?.status]);

  if (!state || state.status === "cancelled") return null;
  const failed = state.status === "error";
  const partial = state.status === "partial";
  const done = state.status === "done";
  const text =
    state.status === "waiting" && steps.length && state.results.length === 0
      ? steps[Math.min(tick, steps.length - 1)]
      : state.message;
  const elapsed = Math.round((Date.now() - state.startedAt) / 1000);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border px-4 py-3 text-xs shadow-sm",
        failed || partial
          ? "border-warning/40 bg-warning/10"
          : done
            ? "border-success/40 bg-success/10"
            : "border-primary/30 bg-primary/10",
        className,
      )}
    >
      {failed || partial ? (
        <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
      ) : done ? (
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
      ) : (
        <span className="relative flex h-6 w-6 shrink-0 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-bold">{text}</p>
        {running && (
          <p className="mt-0.5 text-[11px] font-light text-base-content/60">
            {state.expected > 1 ? `${state.results.length}/${state.expected} ảnh · ` : ""}
            {elapsed > 0 ? `${elapsed}s · ` : ""}Có thể chuyển sang công cụ khác trong lúc chờ.
          </p>
        )}
      </div>
      <button className="btn btn-ghost btn-xs" onClick={() => setActiveTab("chatgpt")}>
        <MessageCircle className="h-3.5 w-3.5" /> Xem ChatGPT
      </button>
      {onFetch && (failed || partial) && (
        <button className="btn btn-secondary btn-xs" onClick={onFetch}>
          <Download className="h-3.5 w-3.5" /> Lấy kết quả từ ChatGPT
        </button>
      )}
      {running && (
        <button className="btn btn-ghost btn-xs text-error" onClick={cancel}>
          <Square className="h-3.5 w-3.5" /> Dừng
        </button>
      )}
    </div>
  );
}
