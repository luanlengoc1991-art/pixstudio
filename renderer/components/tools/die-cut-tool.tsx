import React, { useState } from "react";
import { useAtom, useSetAtom } from "jotai";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { Download, FileCode2, ImageUpscale, Maximize2, Scissors } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { DieCutPayload, DieCutResult, DieCutType } from "@common/types/types";
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
  ImageInput,
  usePendingToolImage,
  OptionCards,
  saveFileAs,
  Section,
  Segmented,
  ToolLayout,
  ZoomModal,
} from "./common";

type ViewMode = "result" | "compare" | "line";

export default function DieCutTool() {
  const { toast } = useToast();
  const [progress, setProgress] = useAtom(toolProgressAtom);
  const openTool = useSetAtom(openToolAtom);
  const setPendingUpscale = useSetAtom(pendingUpscaleImageAtom);

  const [imagePath, setImagePath] = useState("");
  const [cutType, setCutType] = useState<DieCutType>("contour");
  const [offsetMm, setOffsetMm] = useState(2);
  const [smoothness, setSmoothness] = useState<DieCutPayload["smoothness"]>("auto");
  const [lineWidth, setLineWidth] = useState<DieCutPayload["lineWidth"]>("medium");
  const [lineColor, setLineColor] = useState("#ff0000");
  const [background, setBackground] = useState<DieCutPayload["background"]>("transparent");
  const [result, setResult] = useState<DieCutResult | null>(null);
  const [view, setView] = useState<ViewMode>("result");
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState(false);

  usePendingToolImage("die-cut", (path) => {
    setImagePath(path);
    setResult(null);
  });

  const run = async () => {
    if (!imagePath) {
      toast({ title: "Chưa có ảnh", description: "Hãy tải ảnh thiết kế PNG / JPG trước." });
      return;
    }
    setBusy(true);
    setProgress("Đang tạo đường bế...");
    try {
      const payload: DieCutPayload = {
        imagePath,
        cutType,
        offsetMm,
        smoothness,
        lineWidth,
        lineColor,
        background,
      };
      const output: DieCutResult = await window.electron.invoke(ELECTRON_COMMANDS.DIE_CUT, payload);
      setResult(output);
      if (output.usedAi) {
        toast({
          title: "Đã dùng AI để nhận diện hình",
          description: "Ảnh không có nền trong suốt nên AI đã tự tìm viền đối tượng.",
        });
      }
    } catch (error) {
      toast({ title: "Không tạo được đường bế", description: errorMessage(error) });
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const savePng = async () => {
    if (!result) return;
    const saved = await saveFileAs({
      defaultName: `${fileName(imagePath)}_be.png`,
      filters: [{ name: "PNG", extensions: ["png"] }],
      sourcePath: result.previewPath,
    });
    if (saved) toast({ title: "Đã lưu ảnh PNG", description: saved });
  };

  const saveSvg = async () => {
    if (!result) return;
    const saved = await saveFileAs({
      defaultName: `${fileName(imagePath)}_duong-be.svg`,
      filters: [{ name: "SVG", extensions: ["svg"] }],
      sourcePath: result.svgPath,
    });
    if (saved) {
      toast({
        title: "Đã xuất Vector SVG",
        description: "Đường cắt nằm ở lớp CutContour, mở bằng Corel / Illustrator / phần mềm máy cắt.",
      });
    }
  };

  const viewSrc =
    result && (view === "line" ? fileUrl(result.cutOnlyPath) : fileUrl(result.previewPath));

  const aside = (
    <>
      <Section step="01" title="Ảnh thiết kế (PNG / JPG)" hint="PNG nền trong suốt cho kết quả chuẩn nhất.">
        <ImageInput
          toolId="die-cut"
          imagePath={imagePath}
          onChange={(path) => {
            setImagePath(path);
            setResult(null);
          }}
          label="Tải ảnh thiết kế PNG / JPG"
        />
      </Section>
      <Section step="02" title="Kiểu bế">
        <OptionCards
          value={cutType}
          onChange={setCutType}
          options={[
            { value: "contour", label: "Theo viền đối tượng", hint: "Bám sát mép hình" },
            { value: "all", label: "Theo toàn bộ thiết kế", hint: "Bao cụm, lấp lỗ trống" },
            { value: "rounded", label: "Bo tròn", hint: "Khung bo cong mềm" },
            { value: "rect", label: "Chữ nhật", hint: "Khung vuông vức" },
          ]}
        />
      </Section>
      <Section title={`Khoảng cách đường bế: ${offsetMm.toFixed(1)} mm`}>
        <input
          type="range"
          min={0.5}
          max={5}
          step={0.5}
          value={offsetMm}
          onChange={(e) => setOffsetMm(Number(e.target.value))}
          className="range range-primary range-sm"
        />
      </Section>
      {(cutType === "contour" || cutType === "all") && (
        <Section title="Độ mượt">
          <Segmented
            value={smoothness}
            onChange={setSmoothness}
            options={[
              { value: "auto", label: "Tự động" },
              { value: "smooth", label: "Mượt" },
              { value: "very_smooth", label: "Rất mượt" },
            ]}
          />
        </Section>
      )}
      <Section title="Đường bế">
        <Segmented
          value={lineWidth}
          onChange={setLineWidth}
          options={[
            { value: "thin", label: "Mảnh" },
            { value: "medium", label: "Vừa" },
            { value: "thick", label: "Dày" },
          ]}
        />
      </Section>
      <Section title="Màu đường bế">
        <ColorChoices
          colors={["#ff0000", "#ff00ff", "#00a2ff", "#000000"]}
          value={lineColor}
          onChange={setLineColor}
        />
      </Section>
      <Section title="Nền kết quả">
        <Segmented
          value={background}
          onChange={setBackground}
          options={[
            { value: "transparent", label: "Trong suốt" },
            { value: "white", label: "Trắng" },
          ]}
        />
      </Section>
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={busy} onClick={run}>
      <Scissors className="h-4 w-4" />
      {busy ? "Đang xử lý..." : "TẠO ẢNH BẾ"}
    </button>
  );

  return (
    <ToolLayout toolId="die-cut" aside={aside} footer={footer}>
      {busy && <BusyOverlay text={progress || "Đang tạo đường bế..."} />}
      {!imagePath ? (
        <EmptyState
          icon={Scissors}
          title="Tạo Đường Bế File In Tự Động (Cut Contour)"
          text="1. Tải file thiết kế PNG trong suốt hoặc JPG · 2. Chọn kiểu bế, khoảng cách 0.5–5mm, độ mượt & màu · 3. Tải PNG in ấn và SVG cho máy cắt bế."
        />
      ) : (
        <div className="flex h-full flex-col gap-3 p-4">
          {result && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-base-content/70">Chế độ xem:</span>
              <div className="w-[420px]">
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "result", label: "Ảnh có đường bế" },
                    { value: "compare", label: "So sánh trước / sau" },
                    { value: "line", label: "Chỉ đường bế" },
                  ]}
                />
              </div>
            </div>
          )}
          <div className="checkerboard relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-content/10">
            {result && view === "compare" ? (
              <ReactCompareSlider
                className="h-full w-full"
                itemOne={
                  <ReactCompareSliderImage src={fileUrl(imagePath)} alt="Thiết kế gốc" style={{ objectFit: "contain", padding: 24 }} />
                }
                itemTwo={
                  <ReactCompareSliderImage src={fileUrl(result.previewPath)} alt="Đã tạo đường bế" style={{ objectFit: "contain" }} />
                }
              />
            ) : (
              <img
                src={viewSrc || fileUrl(imagePath)}
                alt=""
                className="h-full w-full cursor-zoom-in object-contain"
                onClick={() => result && setZoom(true)}
              />
            )}
          </div>
          {result && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-auto text-xs text-base-content/60">
                Kích thước thành phẩm: <b>{result.widthMm.toFixed(1)} × {result.heightMm.toFixed(1)} mm</b>
              </span>
              <button className="btn btn-sm" onClick={() => setZoom(true)}>
                <Maximize2 className="h-4 w-4" /> Phóng to
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  setPendingUpscale(result.previewPath);
                  openTool("upscayl");
                }}
              >
                <ImageUpscale className="h-4 w-4" /> Kích nét 4K
              </button>
              <button className="btn btn-sm" onClick={saveSvg}>
                <FileCode2 className="h-4 w-4" /> Xuất Vector SVG
              </button>
              <button className="btn btn-primary btn-sm" onClick={savePng}>
                <Download className="h-4 w-4" /> Tải ảnh PNG
              </button>
            </div>
          )}
        </div>
      )}
      <ZoomModal
        src={zoom && viewSrc ? viewSrc : null}
        title="Soi chi tiết đường bế thành phẩm"
        onClose={() => setZoom(false)}
      />
    </ToolLayout>
  );
}
