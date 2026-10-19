import React, { useRef, useState } from "react";
import { useToast } from "@/components/ui/use-toast";
import { errorMessage, fileName, fileUrl, Segmented, ToolLayout } from "../common";
import { CropAside, CropStage, cropToSource, saveCrop, useCropState } from "./crop-panel";
import { PrintAside, PrintStage, usePrintState } from "./print-layout";
import { AiAside, AiStage, useAiPanelState, useAiRunner } from "./ai-panel";
import { newId } from "./shared";
import { IS_WEB } from "@/lib/platform";

type Mode = "ai" | "crop" | "print";

export default function IdPhotoTool() {
  const { toast } = useToast();
  // "Ảnh thẻ AI" goes through ChatGPT, which only the desktop app has
  const [mode, setMode] = useState<Mode>(IS_WEB ? "crop" : "ai");
  const crop = useCropState();
  const print = usePrintState();
  const ai = useAiPanelState();
  const runner = useAiRunner(ai);
  const stageRef = useRef<{ exportCrop: () => Promise<HTMLCanvasElement | null> }>(null);

  const withCrop = async (action: (canvas: HTMLCanvasElement) => Promise<void> | void) => {
    try {
      const canvas = await stageRef.current?.exportCrop();
      if (canvas) await action(canvas);
    } catch (error) {
      toast({ title: "Không cắt được ảnh", description: errorMessage(error) });
    }
  };

  // AI results go straight to cropping or the print layout
  const cropResult = (path: string) => {
    crop.setImagePath(path);
    setMode("crop");
  };
  const layoutResult = (path: string) => {
    print.addSource({ id: newId(), name: fileName(path), url: fileUrl(path) });
    setMode("print");
    toast({ title: "Đã thêm vào Xếp in", description: "Bấm một nút lấp đầy để dàn ảnh lên trang." });
  };

  const aside = (
    <>
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          ...(IS_WEB ? [] : [{ value: "ai", label: "Ảnh thẻ AI" }]),
          { value: "crop", label: "Cắt ảnh" },
          { value: "print", label: "Xếp in" },
        ]}
      />
      {mode === "ai" && <AiAside state={ai} onRun={runner.run} onStop={runner.stop} batchRunning={runner.batchRunning} />}
      {mode === "crop" && (
        <CropAside
          state={crop}
          onExport={() => withCrop((canvas) => saveCrop(canvas, crop.imagePath, crop.sizeKey, toast))}
          onSendToLayout={() =>
            withCrop((canvas) => {
              print.addSource(cropToSource(canvas, crop.imagePath, crop.sizeKey));
              setMode("print");
              toast({ title: "Đã thêm vào Xếp in", description: "Bấm một nút lấp đầy để dàn ảnh lên trang." });
            })
          }
        />
      )}
      {mode === "print" && <PrintAside state={print} />}
    </>
  );

  return (
    <ToolLayout toolId="id-photo" aside={aside}>
      {mode === "print" ? (
        <PrintStage state={print} />
      ) : mode === "crop" ? (
        <CropStage ref={stageRef} state={crop} />
      ) : (
        <AiStage state={ai} onCrop={cropResult} onLayout={layoutResult} />
      )}
    </ToolLayout>
  );
}
