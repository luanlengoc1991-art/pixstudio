"use client";
import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { activeTabAtom, openToolsAtom, toolProgressAtom } from "@/atoms/workspace-atom";
import { chatGptActivatedAtom } from "@/atoms/chatgpt-atom";
import ChatGptPanel from "@/components/chatgpt/chatgpt-panel";
import TopBar from "@/components/shell/top-bar";
import HomeDashboard from "@/components/shell/home-dashboard";
import { RemoveBgScreen, UpscaleScreen } from "@/components/tools/engine-screens";
import VectorTool from "@/components/tools/vector-tool";
import DieCutTool from "@/components/tools/die-cut-tool";
import IdPhotoTool from "@/components/tools/id-photo";
import ChatGptTool from "@/components/tools/chatgpt-tool";
import LayerSeparationTool from "@/components/tools/layer-separation";
import AdDesignerTool from "@/components/tools/ad-designer";
import useUpscaylVersion from "@/components/hooks/use-upscayl-version";
import { ToolId, TOOLS } from "@/lib/tools";

const TOOL_VIEWS: Partial<Record<ToolId, () => JSX.Element>> = {
  // Phase 2 tools share one screen driven by lib/ai-tools.ts
  ...Object.fromEntries(
    TOOLS.filter((tool) => tool.engine === "chatgpt").map((tool) => [
      tool.id,
      () => <ChatGptTool toolId={tool.id} />,
    ]),
  ),
  // Tools with their own screen (ChatGPT, on-device or both)
  "remove-bg": RemoveBgScreen,
  vector: VectorTool,
  "die-cut": DieCutTool,
  "id-photo": IdPhotoTool,
  "layer-separation": LayerSeparationTool,
  "ad-designer": AdDesignerTool,
};
// The upscaler is mounted on its own below
delete TOOL_VIEWS.upscayl;

const App = () => {
  const activeTab = useAtomValue(activeTabAtom);
  const openTools = useAtomValue(openToolsAtom);
  const setToolProgress = useSetAtom(toolProgressAtom);
  const chatGptActivated = useAtomValue(chatGptActivatedAtom);
  const version = useUpscaylVersion();

  useEffect(() => {
    window.electron.on(ELECTRON_COMMANDS.REMOVE_BACKGROUND_PROGRESS, (_, data: string) => {
      if (data) setToolProgress(data);
    });
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden text-base-content">
      <TopBar version={version} />
      <div className="relative min-h-0 flex-1">
        <section className={activeTab === "home" ? "h-full" : "hidden"}>
          <HomeDashboard />
        </section>
        {/* The upscaler registers IPC listeners once, so it stays mounted */}
        <section className={activeTab === "upscayl" ? "h-full" : "hidden"}>
          <UpscaleScreen />
        </section>
        {openTools.map((id) => {
          const View = TOOL_VIEWS[id];
          if (!View) return null;
          return (
            <section key={id} className={activeTab === id ? "h-full" : "hidden"}>
              <View />
            </section>
          );
        })}
        {/* Created on first use, then kept alive so jobs and the login survive tab switches */}
        {(chatGptActivated || activeTab === "chatgpt") && <ChatGptPanel />}
      </div>
    </div>
  );
};

export default App;
