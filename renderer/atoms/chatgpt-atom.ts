import { atom } from "jotai";
import { ToolId } from "@/lib/tools";

export type ChatGptConnection = "idle" | "checking" | "connected" | "disconnected";

/** A request a tool hands to the ChatGPT tab. */
export type ChatGptJob = {
  id: string;
  toolId: ToolId;
  prompt: string;
  /** Images attached to the message, in order */
  imagePaths: string[];
  /** How many images to collect before the job is complete */
  expected: number;
  /** false continues the current conversation (follow-up edits) */
  newChat: boolean;
  /** Use ChatGPT's "Edit" on the last generated image */
  nativeEdit?: boolean;
  /** Progress lines shown while waiting, cycled by the tool */
  steps?: string[];
};

export type ChatGptJobStatus = "queued" | "sending" | "waiting" | "done" | "partial" | "error" | "cancelled";

export type ChatGptToolState = {
  jobId: string;
  status: ChatGptJobStatus;
  message: string;
  expected: number;
  /** Images collected by the current job, in arrival order */
  results: string[];
  startedAt: number;
};

/** Whether the ChatGPT webview has been created (it is created on first use) */
export const chatGptActivatedAtom = atom(false);

export const chatGptConnectionAtom = atom<ChatGptConnection>("idle");

/** Jobs waiting for the ChatGPT tab; the first one is the running job */
export const chatGptQueueAtom = atom<ChatGptJob[]>([]);

/** Latest job state per tool */
export const chatGptToolStateAtom = atom<Partial<Record<ToolId, ChatGptToolState>>>({});

/** Every image collected per tool across jobs, newest first (the tool's history) */
export const chatGptHistoryAtom = atom<Partial<Record<ToolId, string[]>>>({});

/** Tool of the most recent job: manual downloads in the ChatGPT tab go there */
// "" when no job has run yet (a null initial value would make jotai pick its read-only overload)
export const chatGptLastToolAtom = atom<ToolId | "">("");

const newId = () => `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** Queues a job for a tool and resets that tool's state. Returns the job id. */
export const submitChatGptJobAtom = atom(
  null,
  (get, set, job: Omit<ChatGptJob, "id" | "newChat" | "expected"> & Partial<Pick<ChatGptJob, "newChat" | "expected">>) => {
    const full: ChatGptJob = { newChat: true, expected: 1, ...job, id: newId() };
    set(chatGptActivatedAtom, true);
    set(chatGptLastToolAtom, full.toolId);
    // A tool has at most one pending job: replace an older queued one
    set(chatGptQueueAtom, (queue) => [
      ...queue.filter((j, index) => index === 0 || j.toolId !== full.toolId),
      full,
    ]);
    set(chatGptToolStateAtom, (prev) => ({
      ...prev,
      [full.toolId]: {
        jobId: full.id,
        status: "queued",
        message: get(chatGptQueueAtom).length > 1 ? "Đang chờ yêu cầu trước hoàn tất..." : "Đang chuẩn bị gửi sang ChatGPT...",
        expected: full.expected,
        results: [],
        startedAt: Date.now(),
      },
    }));
    return full.id;
  },
);

export const updateChatGptToolStateAtom = atom(
  null,
  (_get, set, { toolId, jobId, patch }: { toolId: ToolId; jobId: string; patch: Partial<ChatGptToolState> }) =>
    set(chatGptToolStateAtom, (prev) => {
      const current = prev[toolId];
      if (!current || current.jobId !== jobId) return prev;
      return { ...prev, [toolId]: { ...current, ...patch } };
    }),
);

/** Adds a collected image to the tool's running job and history. */
export const addChatGptResultAtom = atom(
  null,
  (_get, set, { toolId, jobId, path }: { toolId: ToolId; jobId?: string; path: string }) => {
    set(chatGptToolStateAtom, (prev) => {
      const current = prev[toolId];
      if (!current || (jobId && current.jobId !== jobId)) return prev;
      return { ...prev, [toolId]: { ...current, results: [...current.results, path] } };
    });
    set(chatGptHistoryAtom, (prev) => ({ ...prev, [toolId]: [path, ...(prev[toolId] ?? [])] }));
  },
);

/** Stops the tool's job (running or queued). */
export const cancelChatGptJobAtom = atom(null, (get, set, toolId: ToolId) => {
  const state = get(chatGptToolStateAtom)[toolId];
  if (!state) return;
  set(chatGptQueueAtom, (queue) => queue.filter((job, index) => index === 0 || job.toolId !== toolId));
  if (["queued", "sending", "waiting"].includes(state.status)) {
    set(chatGptToolStateAtom, (prev) => ({
      ...prev,
      [toolId]: { ...state, status: "cancelled", message: "Đã dừng." },
    }));
  }
});
