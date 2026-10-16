import React, { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Download, LayoutGrid, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { EmptyState, fileName, fileUrl, ImageInput, OptionCards, saveFileAs, Section } from "../common";
import { canvasToBytes, loadImage, mmToPx, PHOTO_SIZES, PhotoSource } from "./shared";

type Box = { x: number; y: number; w: number; h: number };
type DragMode = "move" | "nw" | "ne" | "sw" | "se";

const EXPORT_DPI = 300;

/** Largest centred box with the given aspect that fills 80% of the image. */
const initialBox = (iw: number, ih: number, aspect: number | null): Box => {
  const ratio = aspect ?? iw / ih;
  let w = iw * 0.8;
  let h = w / ratio;
  if (h > ih * 0.8) {
    h = ih * 0.8;
    w = h * ratio;
  }
  return { x: (iw - w) / 2, y: (ih - h) / 2, w, h };
};

export function useCropState() {
  const [imagePath, setImagePath] = useState("");
  const [sizeKey, setSizeKey] = useState("3x4");
  return { imagePath, setImagePath, sizeKey, setSizeKey };
}

export function CropAside({
  state,
  onExport,
  onSendToLayout,
}: {
  state: ReturnType<typeof useCropState>;
  onExport: () => void;
  onSendToLayout: () => void;
}) {
  return (
    <>
      <Section step="01" title="Ảnh chân dung">
        <ImageInput toolId="id-photo" imagePath={state.imagePath} onChange={state.setImagePath} />
      </Section>
      <Section step="02" title="Kích thước ảnh thẻ">
        <OptionCards
          value={state.sizeKey}
          onChange={state.setSizeKey}
          options={PHOTO_SIZES.map((s) => ({ value: s.key, label: s.label, hint: s.hint }))}
        />
      </Section>
      <p className="text-[11px] text-base-content/60">
        💡 Bấm giữ & kéo bên trong khung để di chuyển · Kéo các góc chấm trắng để phóng to / thu nhỏ.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-sm" disabled={!state.imagePath} onClick={onSendToLayout}>
          <LayoutGrid className="h-4 w-4" /> Xếp in ảnh này
        </button>
        <button className="btn btn-primary btn-sm" disabled={!state.imagePath} onClick={onExport}>
          <Download className="h-4 w-4" /> Tải ảnh đã cắt
        </button>
      </div>
    </>
  );
}

/** Interactive crop frame. Exposes `exportCrop` through the ref. */
export const CropStage = React.forwardRef<
  { exportCrop: () => Promise<HTMLCanvasElement | null> },
  { state: ReturnType<typeof useCropState> }
>(function CropStage({ state }, ref) {
  const size = PHOTO_SIZES.find((s) => s.key === state.sizeKey)!;
  const aspect = size.widthMm && size.heightMm ? size.widthMm / size.heightMm : null;
  const containerRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [display, setDisplay] = useState({ w: 0, h: 0 });
  const [box, setBox] = useState<Box | null>(null);
  const drag = useRef<{ mode: DragMode; startX: number; startY: number; box: Box } | null>(null);

  // Fit the image into the available area
  useEffect(() => {
    if (!natural || !containerRef.current) return;
    const el = containerRef.current;
    const fit = () => {
      const scale = Math.min((el.clientWidth - 48) / natural.w, (el.clientHeight - 48) / natural.h, 1.5);
      setDisplay({ w: natural.w * scale, h: natural.h * scale });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    return () => observer.disconnect();
  }, [natural]);

  useEffect(() => {
    if (natural) setBox(initialBox(natural.w, natural.h, aspect));
  }, [natural, aspect]);

  useEffect(() => {
    setNatural(null);
    setBox(null);
  }, [state.imagePath]);

  const scale = natural ? display.w / natural.w : 1;

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!drag.current || !natural) return;
      const { mode, startX, startY, box: start } = drag.current;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      if (mode === "move") {
        setBox({
          ...start,
          x: Math.min(Math.max(0, start.x + dx), natural.w - start.w),
          y: Math.min(Math.max(0, start.y + dy), natural.h - start.h),
        });
        return;
      }
      // Resize from a corner, anchoring the opposite corner
      const right = mode === "ne" || mode === "se";
      const bottom = mode === "sw" || mode === "se";
      const anchorX = right ? start.x : start.x + start.w;
      const anchorY = bottom ? start.y : start.y + start.h;
      let w = Math.max(20, start.w + (right ? dx : -dx));
      let h = Math.max(20, start.h + (bottom ? dy : -dy));
      if (aspect) h = w / aspect;
      const maxW = right ? natural.w - anchorX : anchorX;
      const maxH = bottom ? natural.h - anchorY : anchorY;
      if (w > maxW) {
        w = maxW;
        if (aspect) h = w / aspect;
      }
      if (h > maxH) {
        h = maxH;
        if (aspect) w = h * aspect;
      }
      setBox({ x: right ? anchorX : anchorX - w, y: bottom ? anchorY : anchorY - h, w, h });
    },
    [natural, scale, aspect],
  );

  useEffect(() => {
    const up = () => (drag.current = null);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", up);
    };
  }, [onPointerMove]);

  React.useImperativeHandle(ref, () => ({
    exportCrop: async () => {
      if (!box || !state.imagePath) return null;
      const image = await loadImage(fileUrl(state.imagePath));
      const canvas = document.createElement("canvas");
      canvas.width = size.widthMm ? mmToPx(size.widthMm, EXPORT_DPI) : Math.round(box.w);
      canvas.height = size.heightMm ? mmToPx(size.heightMm, EXPORT_DPI) : Math.round(box.h);
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, box.x, box.y, box.w, box.h, 0, 0, canvas.width, canvas.height);
      return canvas;
    },
  }));

  if (!state.imagePath) {
    return (
      <EmptyState
        icon={Crop}
        title="Cắt ảnh thẻ thủ công"
        text="Tải ảnh chân dung lên hoặc dán Ctrl+V, rồi kéo khung hoặc các góc neo để căn chỉnh bố cục khuôn mặt chuẩn xác."
      />
    );
  }

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!box) return;
    e.preventDefault();
    e.stopPropagation();
    drag.current = { mode, startX: e.clientX, startY: e.clientY, box };
  };

  const outputLabel = size.widthMm
    ? `${mmToPx(size.widthMm, EXPORT_DPI)} × ${mmToPx(size.heightMm!, EXPORT_DPI)} px (300 DPI)`
    : box
      ? `${Math.round(box.w)} × ${Math.round(box.h)} px`
      : "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-base-content/10 bg-base-100 px-4 py-2 text-xs">
        <span>
          Kích thước xuất: <b>{outputLabel}</b>
        </span>
        <span>
          Tỷ lệ: <b>{size.label}</b>
        </span>
        <button
          className="btn btn-ghost btn-xs ml-auto"
          onClick={() => natural && setBox(initialBox(natural.w, natural.h, aspect))}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Đặt lại khung cắt
        </button>
      </div>
      <div ref={containerRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="relative select-none" style={{ width: display.w, height: display.h }}>
          <img
            src={fileUrl(state.imagePath)}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            className="h-full w-full"
          />
          {box && (
            <div
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{ left: box.x * scale, top: box.y * scale, width: box.w * scale, height: box.h * scale }}
              onPointerDown={startDrag("move")}
            >
              {/* Rule-of-thirds guides help line up eyes and chin */}
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="border border-white/25" />
                ))}
              </div>
              {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                <span
                  key={corner}
                  onPointerDown={startDrag(corner)}
                  className={cn(
                    "absolute h-4 w-4 rounded-full border-2 border-primary bg-white",
                    corner.includes("n") ? "-top-2" : "-bottom-2",
                    corner.includes("w") ? "-left-2" : "-right-2",
                    corner === "nw" || corner === "se" ? "cursor-nwse-resize" : "cursor-nesw-resize",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/** Saves the crop through a dialog. */
export async function saveCrop(
  canvas: HTMLCanvasElement,
  imagePath: string,
  sizeKey: string,
  toast: ReturnType<typeof useToast>["toast"],
) {
  const saved = await saveFileAs({
    defaultName: `${fileName(imagePath)}_anh-the-${sizeKey}.jpg`,
    filters: [
      { name: "JPG", extensions: ["jpg"] },
      { name: "PNG", extensions: ["png"] },
    ],
    bytes: await canvasToBytes(canvas, "image/jpeg"),
  });
  if (saved) toast({ title: "Đã lưu ảnh thẻ", description: saved });
}

export const cropToSource = (canvas: HTMLCanvasElement, imagePath: string, sizeKey: string): PhotoSource => ({
  id: Math.random().toString(36).slice(2, 10),
  name: `${fileName(imagePath)} (${sizeKey})`,
  url: canvas.toDataURL("image/jpeg", 0.95),
});
