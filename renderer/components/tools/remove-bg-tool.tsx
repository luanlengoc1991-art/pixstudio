import React, { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { Download, Eraser, ImageUpscale, Maximize2 } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { BackgroundRemovalModel, RemoveBackgroundPayload } from "@common/types/types";
import {
  openToolAtom,
  pendingUpscaleImageAtom,
  toolProgressAtom,
} from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  BusyOverlay,
  ColorChoices,
  EmptyState,
  errorMessage,
  fileName,
  fileUrl,
  IMAGE_SAVE_FILTERS,
  ImageInput,
  OptionCards,
  saveFileAs,
  Section,
  Segmented,
  ToolLayout,
  ZoomModal,
} from "./common";

type BackgroundMode = "transparent" | "white" | "color";

export default function RemoveBgTool() {
  const { toast } = useToast();
  const [progress, setProgress] = useAtom(toolProgressAtom);
  const openTool = useSetAtom(openToolAtom);
  const setPendingUpscale = useSetAtom(pendingUpscaleImageAtom);

  const [imagePath, setImagePath] = useState("");
  const [model, setModel] = useState<BackgroundRemovalModel>("general");
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>("transparent");
  const [color, setColor] = useState("#35a9e8");
  const [resultPath, setResultPath] = useState("");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);

  const run = async () => {
    if (!imagePath) {
      toast({ title: "Chưa có ảnh", description: "Hãy chọn hoặc dán một ảnh trước." });
      return;
    }
    setBusy(true);
    setProgress("AI đang tách nền...");
    try {
      const payload: RemoveBackgroundPayload = {
        imagePath,
        outputPath: "",
        model,
        background:
          backgroundMode === "transparent"
            ? "transparent"
            : backgroundMode === "white"
              ? "#ffffff"
              : color,
      };
      const result: string = await window.electron.invoke(
        ELECTRON_COMMANDS.REMOVE_BACKGROUND,
        payload,
      );
      setResultPath(result);
    } catch (error) {
      toast({ title: "Tách nền thất bại", description: errorMessage(error) });
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const save = async () => {
    const saved = await saveFileAs({
      defaultName: `${fileName(imagePath)}_xoa-nen.png`,
      filters: [{ name: "PNG", extensions: ["png"] }, ...IMAGE_SAVE_FILTERS],
      sourcePath: resultPath,
    });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  const aside = (
    <>
      <Section step="01" title="Ảnh đầu vào">
        <ImageInput
          toolId="remove-bg"
          imagePath={imagePath}
          onChange={(path) => {
            setImagePath(path);
            setResultPath("");
          }}
        />
      </Section>
      <Section step="02" title="Model AI">
        <OptionCards
          value={model}
          onChange={setModel}
          options={[
            { value: "general", label: "Tổng hợp", hint: "Sản phẩm, đồ vật, động vật" },
            { value: "portrait", label: "Chân dung", hint: "Tối ưu cho ảnh người" },
          ]}
        />
      </Section>
      <Section step="03" title="Nền kết quả">
        <Segmented
          value={backgroundMode}
          onChange={setBackgroundMode}
          options={[
            { value: "transparent", label: "Trong suốt" },
            { value: "white", label: "Trắng" },
            { value: "color", label: "Màu" },
          ]}
        />
        {backgroundMode === "color" && (
          <ColorChoices
            colors={["#35a9e8", "#1e3a8a", "#ef4444", "#f5f5f4", "#111827"]}
            value={color}
            onChange={setColor}
          />
        )}
      </Section>
      <p className="text-[11px] text-base-content/60">
        Lần đầu dùng sẽ tải model AI (khoảng 170 MB), sau đó chạy offline trên máy.
      </p>
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={busy} onClick={run}>
      <Eraser className="h-4 w-4" />
      {busy ? "Đang xử lý..." : "Xóa nền ngay"}
    </button>
  );

  return (
    <ToolLayout toolId="remove-bg" aside={aside} footer={footer}>
      {busy && <BusyOverlay text={progress || "AI đang tách nền..."} />}
      {!imagePath ? (
        <EmptyState
          icon={Eraser}
          title="Chưa có ảnh nào được chọn"
          text="Chọn ảnh, kéo thả file hoặc dán Ctrl+V để AI tự động xóa nền và xuất PNG trong suốt."
        />
      ) : (
        <div className="flex h-full flex-col gap-3 p-4">
          <div className="checkerboard relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-content/10">
            {resultPath ? (
              <ReactCompareSlider
                className="h-full w-full"
                itemOne={
                  <ReactCompareSliderImage src={fileUrl(imagePath)} alt="Ảnh gốc" style={{ objectFit: "contain" }} />
                }
                itemTwo={
                  <ReactCompareSliderImage src={fileUrl(resultPath)} alt="Đã xóa nền" style={{ objectFit: "contain" }} />
                }
              />
            ) : (
              <img src={fileUrl(imagePath)} alt="" className="h-full w-full object-contain" />
            )}
          </div>
          {resultPath && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="mr-auto text-xs text-base-content/60">Kéo thanh giữa để so sánh trước / sau</span>
              <button className="btn btn-sm" onClick={() => setZoom(true)}>
                <Maximize2 className="h-4 w-4" /> Phóng to
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setPendingUpscale(resultPath);
                  openTool("upscayl");
                }}
              >
                <ImageUpscale className="h-4 w-4" /> Kích nét 4K
              </button>
              <button className="btn btn-primary btn-sm" onClick={save}>
                <Download className="h-4 w-4" /> Tải ảnh PNG
              </button>
            </div>
          )}
        </div>
      )}
      <ZoomModal
        src={zoom && resultPath ? fileUrl(resultPath) : null}
        title="Ảnh đã xóa nền"
        onClose={() => setZoom(false)}
      />
    </ToolLayout>
  );
}
