import React, { useRef, useState } from "react";
import { Crop, LayoutGrid, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { errorMessage, Segmented, ToolLayout } from "../common";
import { CropAside, CropStage, cropToSource, saveCrop, useCropState } from "./crop-panel";
import { PrintAside, PrintStage, usePrintState } from "./print-layout";

type Mode = "crop" | "print" | "ai";

export default function IdPhotoTool() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>("crop");
  const crop = useCropState();
  const print = usePrintState();
  const stageRef = useRef<{ exportCrop: () => Promise<HTMLCanvasElement | null> }>(null);

  const withCrop = async (action: (canvas: HTMLCanvasElement) => Promise<void> | void) => {
    try {
      const canvas = await stageRef.current?.exportCrop();
      if (canvas) await action(canvas);
    } catch (error) {
      toast({ title: "Không cắt được ảnh", description: errorMessage(error) });
    }
  };

  const modeSwitch = (
    <Segmented
      value={mode}
      onChange={setMode}
      options={[
        { value: "crop", label: "Cắt ảnh" },
        { value: "print", label: "Xếp in" },
        { value: "ai", label: "AI ✨" },
      ]}
    />
  );

  const aside = (
    <>
      {modeSwitch}
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
      {mode === "ai" && (
        <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-xs leading-5">
          <p className="mb-1 flex items-center gap-1 font-bold text-primary">
            <Sparkles className="h-4 w-4" /> Chỉnh sửa ảnh thẻ bằng AI · Đợt 2
          </p>
          Đổi trang phục (sơ mi, vest, áo dài...), kiểu tóc, phông nền xanh CCCD / trắng Visa, làm đẹp da và xử lý
          hàng loạt qua ChatGPT sẽ có trong bản cập nhật tiếp theo.
        </div>
      )}
    </>
  );

  return (
    <ToolLayout toolId="id-photo" aside={aside}>
      {mode === "print" ? (
        <PrintStage state={print} />
      ) : mode === "crop" ? (
        <CropStage ref={stageRef} state={crop} />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex gap-3 text-primary">
            <Crop className="h-8 w-8" />
            <LayoutGrid className="h-8 w-8" />
            <Sparkles className="h-8 w-8" />
          </div>
          <p className="max-w-md text-sm text-base-content/70">
            Trong lúc chờ, bạn có thể dùng <b>Cắt ảnh</b> để cắt chuẩn kích thước và <b>Xếp in</b> để dàn ảnh lên khổ
            10x15 / A4.
          </p>
        </div>
      )}
    </ToolLayout>
  );
}
