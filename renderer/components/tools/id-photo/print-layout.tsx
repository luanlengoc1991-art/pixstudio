import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, LayoutGrid, Printer, RotateCw, Trash2, Undo2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import { ColorChoices, EmptyState, fileUrl, ImageInput, saveFileAs, Section, Segmented } from "../common";
import { canvasToBytes, loadImage, mmToPx, newId, PHOTO_SIZES, PhotoSource } from "./shared";

type Paper = { key: string; label: string; shortMm: number; longMm: number };

const PAPERS: Paper[] = [
  { key: "10x15", label: "Khổ 10x15 cm (4x6 inch)", shortMm: 101.6, longMm: 152.4 },
  { key: "a5", label: "Khổ A5 (14.8x21 cm)", shortMm: 148, longMm: 210 },
  { key: "a4", label: "Khổ A4 (21x29.7 cm)", shortMm: 210, longMm: 297 },
];

const FIXED_SIZES = PHOTO_SIZES.filter((s) => s.widthMm);
const sizeByKey = (key: string) => FIXED_SIZES.find((s) => s.key === key)!;

type Item = { id: string; sourceId: string; sizeKey: string; rotated: boolean };
type Placed = Item & { x: number; y: number; w: number; h: number };

const LINE_WIDTHS = { thin: 0.1, medium: 0.2, thick: 0.4 } as const;

export function usePrintState() {
  const [sources, setSources] = useState<PhotoSource[]>([]);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [paperKey, setPaperKey] = useState("10x15");
  const [landscape, setLandscape] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [gapMm, setGapMm] = useState(2);
  const [marginMm, setMarginMm] = useState(3);
  const [cutLines, setCutLines] = useState(true);
  const [lineWidth, setLineWidth] = useState<keyof typeof LINE_WIDTHS>("thin");
  const [lineColor, setLineColor] = useState("#c8c8c8");
  const [dpi, setDpi] = useState<"300" | "600">("300");
  const [format, setFormat] = useState<"png" | "jpg">("jpg");

  const addSource = (source: PhotoSource) => {
    setSources((list) => [...list, source]);
    setActiveSource(source.id);
  };

  return {
    sources, addSource, setSources, activeSource, setActiveSource,
    paperKey, setPaperKey, landscape, setLandscape, items, setItems,
    gapMm, setGapMm, marginMm, setMarginMm, cutLines, setCutLines,
    lineWidth, setLineWidth, lineColor, setLineColor, dpi, setDpi, format, setFormat,
  };
}
type PrintState = ReturnType<typeof usePrintState>;

const paperSize = (state: PrintState) => {
  const paper = PAPERS.find((p) => p.key === state.paperKey)!;
  return state.landscape
    ? { w: paper.longMm, h: paper.shortMm }
    : { w: paper.shortMm, h: paper.longMm };
};

const itemSize = (item: Item) => {
  const size = sizeByKey(item.sizeKey);
  return item.rotated
    ? { w: size.heightMm!, h: size.widthMm! }
    : { w: size.widthMm!, h: size.heightMm! };
};

/** Row-by-row packing; returns null when an item does not fit on the sheet. */
const pack = (items: Item[], state: PrintState): Placed[] | null => {
  const sheet = paperSize(state);
  const right = sheet.w - state.marginMm;
  const bottom = sheet.h - state.marginMm;
  let x = state.marginMm;
  let y = state.marginMm;
  let rowHeight = 0;
  const placed: Placed[] = [];
  for (const item of items) {
    const { w, h } = itemSize(item);
    if (x + w > right + 0.01) {
      x = state.marginMm;
      y += rowHeight + state.gapMm;
      rowHeight = 0;
    }
    if (x + w > right + 0.01 || y + h > bottom + 0.01) return null;
    placed.push({ ...item, x, y, w, h });
    x += w + state.gapMm;
    rowHeight = Math.max(rowHeight, h);
  }
  return placed;
};

/** Draws the sheet at the given resolution. */
const renderSheet = async (state: PrintState, placed: Placed[], dpi: number) => {
  const sheet = paperSize(state);
  const canvas = document.createElement("canvas");
  canvas.width = mmToPx(sheet.w, dpi);
  canvas.height = mmToPx(sheet.h, dpi);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = "high";

  const images = new Map<string, HTMLImageElement>();
  for (const source of state.sources) {
    if (placed.some((p) => p.sourceId === source.id)) images.set(source.id, await loadImage(source.url));
  }

  for (const item of placed) {
    const image = images.get(item.sourceId);
    if (!image) continue;
    const x = (item.x / 25.4) * dpi;
    const y = (item.y / 25.4) * dpi;
    const w = (item.w / 25.4) * dpi;
    const h = (item.h / 25.4) * dpi;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    if (item.rotated) ctx.rotate(Math.PI / 2);
    const dw = item.rotated ? h : w;
    const dh = item.rotated ? w : h;
    // Cover-fit: crop the source to the slot's aspect ratio
    const scale = Math.max(dw / image.naturalWidth, dh / image.naturalHeight);
    const sw = dw / scale;
    const sh = dh / scale;
    ctx.drawImage(image, (image.naturalWidth - sw) / 2, (image.naturalHeight - sh) / 2, sw, sh, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    if (state.cutLines) {
      ctx.strokeStyle = state.lineColor;
      ctx.lineWidth = Math.max(1, (LINE_WIDTHS[state.lineWidth] / 25.4) * dpi);
      ctx.strokeRect(x, y, w, h);
    }
  }
  return canvas;
};

export function PrintAside({ state }: { state: PrintState }) {
  const { toast } = useToast();
  const [manualSize, setManualSize] = useState("3x4");

  const tryItems = (next: Item[]) => {
    if (pack(next, state)) {
      state.setItems(next);
      return true;
    }
    return false;
  };

  const requireSource = () => {
    if (!state.activeSource) {
      toast({ title: "Chưa có ảnh", description: "Thêm ảnh nguồn hoặc gửi ảnh từ mục Cắt ảnh trước." });
      return null;
    }
    return state.activeSource;
  };

  /** Adds photos of the given sizes in rotation until the sheet is full. */
  const fill = (sizeKeys: string[], keep = false) => {
    const sourceId = requireSource();
    if (!sourceId) return;
    let next = keep ? [...state.items] : [];
    for (let i = 0; i < 500; i++) {
      const candidate = [...next, { id: newId(), sourceId, sizeKey: sizeKeys[i % sizeKeys.length], rotated: false }];
      if (!pack(candidate, state)) break;
      next = candidate;
    }
    state.setItems(next);
  };

  const addOne = (sizeKey: string) => {
    const sourceId = requireSource();
    if (!sourceId) return;
    if (!tryItems([...state.items, { id: newId(), sourceId, sizeKey, rotated: false }])) {
      toast({ title: "Hết chỗ trên trang", description: "Không thể xếp thêm ảnh này. Hãy đổi khổ giấy hoặc giảm lề." });
    }
  };

  const combo = () => {
    // Two 4x6 photos first, then fill the rest with 3x4
    const sourceId = requireSource();
    if (!sourceId) return;
    let next: Item[] = [];
    for (let i = 0; i < 2; i++) {
      const candidate = [...next, { id: newId(), sourceId, sizeKey: "4x6", rotated: false }];
      if (pack(candidate, state)) next = candidate;
    }
    for (let i = 0; i < 500; i++) {
      const candidate = [...next, { id: newId(), sourceId, sizeKey: "3x4", rotated: false }];
      if (!pack(candidate, state)) break;
      next = candidate;
    }
    state.setItems(next);
  };

  return (
    <>
      <Section step="01" title="Ảnh nguồn" hint="Bấm chọn ảnh dùng để xếp. Ảnh gửi từ mục Cắt ảnh sẽ có ở đây.">
        <div className="flex flex-wrap gap-2">
          {state.sources.map((source) => (
            <button
              key={source.id}
              onClick={() => state.setActiveSource(source.id)}
              className={cn(
                "h-16 w-12 overflow-hidden rounded-lg border-2",
                state.activeSource === source.id ? "border-primary" : "border-transparent opacity-70",
              )}
              data-tooltip-id="tooltip"
              data-tooltip-content={source.name}
            >
              <img src={source.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <ImageInput
          toolId="id-photo"
          imagePath=""
          compact
          label="Thêm ảnh nguồn"
          onChange={(path) =>
            state.addSource({ id: newId(), name: path.split(/[\\/]/).pop() || "Ảnh", url: fileUrl(path) })
          }
        />
      </Section>

      <Section step="02" title="Khổ giấy">
        <select
          className="select select-bordered select-sm w-full"
          value={state.paperKey}
          onChange={(e) => state.setPaperKey(e.target.value)}
        >
          {PAPERS.map((paper) => (
            <option key={paper.key} value={paper.key}>
              {paper.label}
            </option>
          ))}
        </select>
        <Segmented
          value={state.landscape ? "landscape" : "portrait"}
          onChange={(v) => state.setLandscape(v === "landscape")}
          options={[
            { value: "portrait", label: "Khổ dọc" },
            { value: "landscape", label: "Khổ ngang" },
          ]}
        />
      </Section>

      <Section step="03" title="⚡ Tự động lấp đầy">
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-sm" onClick={() => fill(["3x4"])}>Dàn kín ảnh 3x4</button>
          <button className="btn btn-sm" onClick={() => fill(["4x6"])}>Dàn kín ảnh 4x6</button>
          <button className="btn btn-sm" onClick={() => fill(["2x3"])}>Dàn kín ảnh 2x3</button>
          <button className="btn btn-sm" onClick={() => fill(["visa"])}>Dàn kín Visa</button>
        </div>
        <button className="btn btn-sm btn-outline btn-primary" onClick={combo}>
          🌟 Xếp chung 3x4 & 4x6 cm · Combo hồ sơ xin việc
        </button>
      </Section>

      <Section step="04" title="🛠️ Xếp thủ công">
        <div className="flex gap-2">
          <select
            className="select select-bordered select-sm flex-1"
            value={manualSize}
            onChange={(e) => setManualSize(e.target.value)}
          >
            {FIXED_SIZES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
          <button className="btn btn-primary btn-sm" onClick={() => addOne(manualSize)}>
            + Thêm
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button
            className="btn btn-xs"
            disabled={!state.items.length}
            onClick={() => {
              const last = state.items[state.items.length - 1];
              if (!tryItems([...state.items.slice(0, -1), { ...last, rotated: !last.rotated }])) {
                toast({ title: "Không đủ chỗ để xoay ảnh này" });
              }
            }}
          >
            <RotateCw className="h-3 w-3" /> Xoay 90°
          </button>
          <button className="btn btn-xs" disabled={!state.items.length} onClick={() => state.setItems(state.items.slice(0, -1))}>
            <Undo2 className="h-3 w-3" /> Xóa ảnh cuối
          </button>
          <button className="btn btn-xs" disabled={!state.items.length} onClick={() => state.setItems([])}>
            <Trash2 className="h-3 w-3" /> Xóa hết
          </button>
        </div>
      </Section>

      <Section step="05" title={`Khe cắt ${state.gapMm} mm · Lề an toàn ${state.marginMm} mm`}>
        <input type="range" className="range range-primary range-xs" min={0} max={6} step={0.5} value={state.gapMm} onChange={(e) => state.setGapMm(Number(e.target.value))} />
        <input type="range" className="range range-primary range-xs" min={0} max={10} step={0.5} value={state.marginMm} onChange={(e) => state.setMarginMm(Number(e.target.value))} />
      </Section>

      <Section title="Kẻ viền cắt">
        <label className="flex items-center gap-2 text-xs font-semibold">
          <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={state.cutLines} onChange={(e) => state.setCutLines(e.target.checked)} />
          Vẽ đường viền quanh từng ảnh
        </label>
        {state.cutLines && (
          <>
            <Segmented
              value={state.lineWidth}
              onChange={state.setLineWidth}
              options={[
                { value: "thin", label: "Mảnh" },
                { value: "medium", label: "Vừa" },
                { value: "thick", label: "Dày" },
              ]}
            />
            <ColorChoices colors={["#c8c8c8", "#000000", "#35a9e8"]} value={state.lineColor} onChange={state.setLineColor} />
          </>
        )}
      </Section>

      <Section title="Chất lượng & định dạng xuất">
        <Segmented
          value={state.dpi}
          onChange={state.setDpi}
          options={[
            { value: "300", label: "300 DPI (Tiêu chuẩn)" },
            { value: "600", label: "600 DPI (Ultra HD)" },
          ]}
        />
        <Segmented
          value={state.format}
          onChange={state.setFormat}
          options={[
            { value: "jpg", label: "JPG tối đa (100%)" },
            { value: "png", label: "PNG gốc" },
          ]}
        />
      </Section>
    </>
  );
}

export function PrintStage({ state }: { state: PrintState }) {
  const { toast } = useToast();
  const [preview, setPreview] = useState("");
  // `state` is a new object every render; depend on the values that matter
  const layoutDeps = [
    state.items, state.sources, state.paperKey, state.landscape, state.gapMm,
    state.marginMm, state.cutLines, state.lineWidth, state.lineColor,
  ];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const placed = useMemo(() => pack(state.items, state) ?? [], layoutDeps);
  const sheet = paperSize(state);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    renderSheet(state, placed, 72).then((canvas) => {
      if (!cancelled) setPreview(canvas.toDataURL("image/png"));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, state.lineColor, state.lineWidth, state.cutLines]);

  const exportSheet = async () => {
    const canvas = await renderSheet(state, placed, Number(state.dpi));
    const saved = await saveFileAs({
      defaultName: `xep-anh-the-${state.paperKey}.${state.format}`,
      filters: [{ name: state.format.toUpperCase(), extensions: [state.format] }],
      bytes: await canvasToBytes(canvas, state.format === "png" ? "image/png" : "image/jpeg"),
    });
    if (saved) toast({ title: "Đã lưu bản in", description: saved });
  };

  const print = async () => {
    const canvas = await renderSheet(state, placed, Number(state.dpi));
    const frame = frameRef.current;
    if (!frame?.contentWindow) return;
    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(
      `<!doctype html><html><head><style>@page{size:${sheet.w}mm ${sheet.h}mm;margin:0}html,body{margin:0}img{display:block;width:${sheet.w}mm;height:${sheet.h}mm}</style></head><body><img src="${canvas.toDataURL("image/png")}"></body></html>`,
    );
    doc.close();
    const image = doc.querySelector("img")!;
    const printNow = () => frame.contentWindow?.print();
    // A data URL image may already be decoded by the time we get here
    if (image.complete) printNow();
    else image.onload = printNow;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === "p" && placed.length) {
        e.preventDefault();
        print();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-base-content/10 bg-base-100 px-4 py-2 text-xs">
        <span>
          Kích thước bản in: <b>{sheet.w.toFixed(1)} × {sheet.h.toFixed(1)} mm</b>
        </span>
        <span>
          Số lượng ảnh xếp: <b>{placed.length}</b>
        </span>
        <div className="ml-auto flex gap-2">
          <button className="btn btn-sm" disabled={!placed.length} onClick={print}>
            <Printer className="h-4 w-4" /> In ngay (Ctrl+P)
          </button>
          <button className="btn btn-primary btn-sm" disabled={!placed.length} onClick={exportSheet}>
            <Download className="h-4 w-4" /> Tải bản in
          </button>
        </div>
      </div>
      {placed.length ? (
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <img src={preview} alt="Bản xếp in" className="max-h-full max-w-full bg-white shadow-xl ring-1 ring-black/10" />
        </div>
      ) : (
        <EmptyState
          icon={LayoutGrid}
          title="Studio Xếp Ảnh In Chuyên Nghiệp"
          text="Dàn trang ảnh thẻ tự động & thủ công, bản in 300 DPI sắc nét. Bấm các nút lấp đầy ở cột bên trái để xếp ảnh lên trang."
        />
      )}
      <iframe ref={frameRef} className="hidden" title="print" />
    </div>
  );
}
