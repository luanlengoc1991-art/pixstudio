import { atom } from "jotai";
import { ChatGptStatus } from "@common/types/types";
import { ToolId } from "@/lib/tools";

export type WorkspaceTab = "home" | ToolId;

/** The tab shown in the workspace */
export const activeTabAtom = atom<WorkspaceTab>("home");

/** Tools open as tabs, in the order they were opened (at most 6) */
export const openToolsAtom = atom<ToolId[]>([]);

export const MAX_OPEN_TOOLS = 6;

/** Progress text for the local tools (background removal, die-cut...) */
export const toolProgressAtom = atom<string>("");

/** Image path handed to the upscaler from another tool ("" when none) */
export const pendingUpscaleImageAtom = atom("");

/** Opens a tool tab (or focuses it if already open) */
export const openToolAtom = atom(null, (get, set, tool: ToolId) => {
  const open = get(openToolsAtom);
  if (!open.includes(tool)) {
    // Drop the oldest tab once the limit is reached
    const next = [...open, tool];
    set(openToolsAtom, next.slice(-MAX_OPEN_TOOLS));
  }
  set(activeTabAtom, tool);
});

export const closeToolAtom = atom(null, (get, set, tool: ToolId) => {
  const open = get(openToolsAtom);
  const index = open.indexOf(tool);
  const next = open.filter((id) => id !== tool);
  set(openToolsAtom, next);
  if (get(activeTabAtom) === tool) {
    set(activeTabAtom, next[Math.max(0, index - 1)] ?? "home");
  }
});

/** Images downloaded from the ChatGPT window, per tool, newest first */
export const chatGptResultsAtom = atom<Partial<Record<ToolId, string[]>>>({});

/** Last ChatGPT window status, per tool */
export const chatGptStatusAtom = atom<Partial<Record<ToolId, ChatGptStatus>>>({});
