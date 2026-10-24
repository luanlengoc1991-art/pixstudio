import React, { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { Maximize } from "lucide-react";
import { pendingToolImageAtom, pendingUpscaleImageAtom } from "@/atoms/workspace-atom";
import { IS_WEB } from "@/lib/platform";
import UpscaleTool from "./upscale-tool";
import RemoveBgTool from "./remove-bg-tool";
import ChatGptTool from "./chatgpt-tool";
import { EngineSwitch } from "./common/chatgpt-job";

type Engine = "chatgpt" | "local";

/** ChatGPT by default in the desktop app; the website only has the on-device version. */
const useEngine = () => useState<Engine>(IS_WEB ? "local" : "chatgpt");

/**
 * Kích nét: ChatGPT rebuilds a sharp, realistic photo; the on-device upscaler
 * stays for offline use and for enlarging a ChatGPT result 4x.
 */
export function UpscaleScreen() {
  const [engine, setEngine] = useEngine();
  const setPendingUpscale = useSetAtom(pendingUpscaleImageAtom);
  const pending = useAtomValue(pendingToolImageAtom).upscayl;

  // Images sent from other tools go to the ChatGPT screen
  useEffect(() => {
    if (pending && !IS_WEB) setEngine("chatgpt");
  }, [pending]);

  if (IS_WEB) return <UpscaleTool />;

  return (
    <>
      <div className={engine === "chatgpt" ? "h-full" : "hidden"}>
        <ChatGptTool
          toolId="upscayl"
          modeSwitch={<EngineSwitch value={engine} onChange={setEngine} />}
          extraActions={(current) => (
            <button
              className="btn btn-sm"
              onClick={() => {
                setPendingUpscale(current);
                setEngine("local");
              }}
              data-tooltip-id="tooltip"
              data-tooltip-content="Phóng to ảnh ChatGPT vừa làm nét lên 4 lần bằng model trên máy"
            >
              <Maximize className="h-4 w-4" /> Phóng to x4 trên máy
            </button>
          )}
        />
      </div>
      {/* The on-device upscaler registers IPC listeners once, so it stays mounted */}
      <div className={engine === "local" ? "flex h-full flex-col" : "hidden"}>
        <div className="shrink-0 border-b border-base-content/10 bg-base-200/60 px-4 py-2">
          <div className="max-w-[420px]">
            <EngineSwitch value={engine} onChange={setEngine} />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <UpscaleTool />
        </div>
      </div>
    </>
  );
}

/** Xóa nền: ChatGPT keeps hair and edges natural; the on-device model stays for offline use. */
export function RemoveBgScreen() {
  const [engine, setEngine] = useEngine();
  if (IS_WEB) return <RemoveBgTool />;
  const modeSwitch = <EngineSwitch value={engine} onChange={setEngine} />;
  return (
    <>
      <div className={engine === "chatgpt" ? "h-full" : "hidden"}>
        <ChatGptTool toolId="remove-bg" modeSwitch={modeSwitch} />
      </div>
      <div className={engine === "local" ? "h-full" : "hidden"}>
        <RemoveBgTool modeSwitch={modeSwitch} />
      </div>
    </>
  );
}
