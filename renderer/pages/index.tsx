"use client";
import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { activeTabAtom, openToolsAtom, toolProgressAtom } from "@/atoms/workspace-atom";
import TopBar from "@/components/shell/top-bar";
import HomeDashboard from "@/components/shell/home-dashboard";
import UpscaleTool from "@/components/tools/upscale-tool";
import RemoveBgTool from "@/components/tools/remove-bg-tool";
import VectorTool from "@/components/tools/vector-tool";
import DieCutTool from "@/components/tools/die-cut-tool";
import IdPhotoTool from "@/components/tools/id-photo";
import useUpscaylVersion from "@/components/hooks/use-upscayl-version";
import { ToolId } from "@/lib/tools";

const TOOL_VIEWS: Partial<Record<ToolId, () => JSX.Element>> = {
  "remove-bg": RemoveBgTool,
  vector: VectorTool,
  "die-cut": DieCutTool,
  "id-photo": IdPhotoTool,
};

const App = () => {
  const activeTab = useAtomValue(activeTabAtom);
  const openTools = useAtomValue(openToolsAtom);
  const setToolProgress = useSetAtom(toolProgressAtom);
  const version = useUpscaylVersion();

  useEffect(() => {
    window.electron.on(ELECTRON_COMMANDS.REMOVE_BACKGROUND_PROGRESS, (_, data: string) => {
      if (data) setToolProgress(data);
    });
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-base-300 text-base-content">
      <TopBar version={version} />
      <div className="relative min-h-0 flex-1">
        <section className={activeTab === "home" ? "h-full" : "hidden"}>
          <HomeDashboard />
        </section>
        {/* The upscaler registers IPC listeners once, so it stays mounted */}
        <section className={activeTab === "upscayl" ? "h-full" : "hidden"}>
          <UpscaleTool />
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
      </div>
    </div>
  );
};

export default App;
