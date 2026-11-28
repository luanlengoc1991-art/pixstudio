import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Crop,
  Download,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Lock,
  Redo2,
  RefreshCw,
  Scissors,
  Trash2,
  Undo2,
  Unlock,
  X,
} from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import {
  AlignmentStatus,
  BackgroundDetection,
  buildCompositionSvg,
  CompositionLayerItem,
  LayerPlacement,
  preserveLockedLayers,
  reorderCompositionLayers,
  ResizeHandle,
  resizeLayerCrop,
  resizeLayerPlacement,
} from "@common/layer-composition";
import { DesignAppTarget } from "@common/types/types";
import { cn } from "@/lib/utils";
import { errorMessage, saveFileAs } from "../common";
import { OpenInDesignMenu } from "../common/open-in-design-menu";
import {
  autoTrimLayerFrame,
  buildCompositionJpg,
  composeExtractedLayers,
  cropCompositionLayer,
  RawLayerInput,
} from "./composition-helpers";
import { buildCompositionPsd } from "./psd-export";

type ExportFormat = "psd" | "pdf" | "jpg";
type ViewLayout = "reference-sidebar" | "side-by-side" | "overlay";

interface SnapshotState {
  layers: CompositionLayerItem[];
  backgroundDetection: BackgroundDetection;
  backgroundOverride?: string;
  deletedLayerIds?: string[];
}

interface HistoryStack {
  present: SnapshotState;
  past: SnapshotState[];
  future: SnapshotState[];
  group?: object;
}

const ALIGNMENT_LABELS: Record<AlignmentStatus, { label: string; badge: string }> = {
  good: { label: "Khớp tốt", badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  review: { label: "Cần kiểm tra", badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  weak: { label: "Khớp thấp", badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400" },
  manual: { label: "Đã chỉnh tay", badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400" },
};

const HANDLES: [ResizeHandle, string][] = [
  ["nw", "góc trên trái"],
  ["ne", "góc trên phải"],
  ["sw", "góc dưới trái"],
  ["se", "góc dưới phải"],
  ["w", "cạnh trái"],
  ["e", "cạnh phải"],
  ["n", "cạnh trên"],
  ["s", "cạnh dưới"],
];

function pushHistory(stack: HistoryStack, next: SnapshotState, group?: object): HistoryStack {
  return {
    present: next,
    past: group && group === stack.group ? stack.past : [...stack.past, stack.present].slice(-80),
    future: [],
    group,
  };
}

function clampViewport(vp: { scale: number; x: number; y: number }) {
  return {
    scale: vp.scale,
    x: Math.max(1 - vp.scale, Math.min(0, vp.x)),
    y: Math.max(1 - vp.scale, Math.min(0, vp.y)),
  };
}

export default function LayerCompositionModal({
  originalSource,
  inputs,
  fileName,
  onClose,
}: {
  originalSource: string;
  inputs: RawLayerInput[];
  fileName: string;
  onClose: () => void;
}) {
  const sourceRef = useRef({ originalSource, inputs });
  sourceRef.current = { originalSource, inputs };
  const dialogRef = useRef<HTMLDivElement>(null);
  const runIdRef = useRef(0);
  const bgOverrideRef = useRef<string | undefined>(undefined);

  const [history, setHistory] = useState<HistoryStack>({
    present: { layers: [], backgroundDetection: { backgroundId: null, status: "missing" } },
    past: [],
    future: [],
  });
  const { layers, backgroundDetection } = history.present;
  const presentRef = useRef(history.present);
  presentRef.current = history.present;

  const [canvasSize, setCanvasSize] = useState({ width: 1, height: 1 });
  const [selectedId, setSelectedId] = useState("");
  const [composing, setComposing] = useState(true);
  const [progressCount, setProgressCount] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("psd");
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [openingApp, setOpeningApp] = useState<DesignAppTarget | null>(null);
  const [pdfWidthMm, setPdfWidthMm] = useState(300);
  const [keepAspect, setKeepAspect] = useState(true);
  const [viewLayout, setViewLayout] = useState<ViewLayout>("reference-sidebar");
  const [overlayOpacity, setOverlayOpacity] = useState(65);
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [cropDraft, setCropDraft] = useState<{ source: CompositionLayerItem; bounds: LayerPlacement } | null>(null);
  const [cropping, setCropping] = useState(false);

  const exportMenuRef = useRef<HTMLDivElement>(null);
  const stageHostRef = useRef<HTMLDivElement>(null);
  const [hostRect, setHostRect] = useState({ width: 0, height: 0 });
  const panDragRef = useRef<{ pointerId: number; x: number; y: number; width: number; height: number } | null>(null);
  const layerDragRef = useRef<{
    pointerId: number;
    id: string;
    startX: number;
    startY: number;
    start: LayerPlacement;
    corner?: ResizeHandle;
    canvasWidth: number;
    canvasHeight: number;
    group: object;
    altCrop: boolean;
  } | null>(null);

  const selectedLayer = layers.find((l) => l.id === selectedId);
  const activeBounds = cropDraft?.source.id === selectedId ? cropDraft.bounds : selectedLayer;
  const anyLocked = layers.some((l) => l.locked);

  useEffect(() => {
    if (cropDraft && (selectedLayer !== cropDraft.source || composing)) {
      setCropDraft(null);
    }
  }, [selectedLayer, composing, cropDraft]);

  const mutateLayers = useCallback(
    (updater: (current: CompositionLayerItem[]) => CompositionLayerItem[], group?: object) => {
      const grp = layerDragRef.current?.group || group;
      setHistory((prev) => {
        const nextLayers = updater(prev.present.layers);
        if (
          nextLayers.length === prev.present.layers.length &&
          nextLayers.every((item, idx) => item === prev.present.layers[idx])
        ) {
          return prev;
        }
        return pushHistory(prev, { ...prev.present, layers: nextLayers }, grp);
      });
    },
    [],
  );

  const stepHistory = useCallback(
    (dir: "undo" | "redo") => {
      if (cropping) return;
      if (cropDraft) {
        setCropDraft(null);
        return;
      }
      if (composing || exporting || layerDragRef.current || panDragRef.current) return;
      setHistory((prev) => {
        const list = dir === "undo" ? prev.past : prev.future;
        const target = list[list.length - 1];
        if (!target) return prev;
        bgOverrideRef.current = target.backgroundOverride;
        if (!target.layers.some((l) => l.id === selectedId)) {
          setSelectedId(
            target.layers.find((l) => l.visible && !l.isBackground)?.id ||
              target.layers[target.layers.length - 1]?.id ||
              "",
          );
        }
        return dir === "undo"
          ? { present: target, past: prev.past.slice(0, -1), future: [...prev.future, prev.present] }
          : { present: target, past: [...prev.past, prev.present].slice(-80), future: prev.future.slice(0, -1) };
      });
    },
    [composing, cropDraft, cropping, exporting, selectedId],
  );

  const runAutoCompose = useCallback(async () => {
    const id = ++runIdRef.current;
    setComposing(true);
    setError("");
    setNotice("");
    setProgressCount(0);
    try {
      const deleted = presentRef.current.deletedLayerIds || [];
      const composed = await composeExtractedLayers(
        sourceRef.current.originalSource,
        sourceRef.current.inputs.filter((i) => !deleted.includes(i.id)),
        (done) => {
          if (runIdRef.current === id) setProgressCount(done);
        },
        () => runIdRef.current !== id,
        bgOverrideRef.current,
      );
      if (runIdRef.current !== id) return;
      setCanvasSize({ width: composed.width, height: composed.height });
      const override = bgOverrideRef.current;
      setHistory((prev) => {
        const next: SnapshotState = {
          layers: preserveLockedLayers(prev.present.layers, composed.layers),
          backgroundDetection: composed.backgroundDetection,
          backgroundOverride: override,
          deletedLayerIds: deleted,
        };
        return prev.present.layers.length || deleted.length
          ? pushHistory(prev, next)
          : { present: next, past: [], future: [] };
      });
      setSelectedId(composed.layers.find((l) => !l.isBackground)?.id || composed.layers[0]?.id || "");
    } catch (err) {
      if (runIdRef.current === id) setError(errorMessage(err));
    } finally {
      if (runIdRef.current === id) setComposing(false);
    }
  }, []);

  useEffect(() => {
    void runAutoCompose();
    return () => {
      runIdRef.current++;
    };
  }, [runAutoCompose]);

  // Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const inInput = e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]');
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !inInput) {
        const k = e.key.toLowerCase();
        if (k === "z" || k === "y") {
          e.preventDefault();
          stepHistory(k === "y" || e.shiftKey ? "redo" : "undo");
          return;
        }
      }
      if (e.key === "Escape" && !exporting && !openingApp) {
        if (exportMenuOpen) {
          setExportMenuOpen(false);
        } else if (cropDraft) {
          setCropDraft(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cropDraft, exportMenuOpen, exporting, onClose, openingApp, stepHistory]);

  // Outside click closes export dropdown
  useEffect(() => {
    if (!exportMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportMenuOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [exportMenuOpen]);

  // Wheel zoom inside viewport
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const vpEl = (e.target as Element | null)?.closest("[data-preview-viewport]") as HTMLElement | null;
      if (!vpEl) return;
      e.preventDefault();
      if (layerDragRef.current || panDragRef.current) return;
      const rect = vpEl.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      const dy = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rect.height : 1);
      setViewport((prev) => {
        const nextScale = Math.max(1, Math.min(4, prev.scale * Math.exp(-0.002 * Math.max(-200, Math.min(200, dy)))));
        if (nextScale === 1) return { scale: 1, x: 0, y: 0 };
        const ratio = nextScale / prev.scale;
        return clampViewport({
          scale: nextScale,
          x: rx - (rx - prev.x) * ratio,
          y: ry - (ry - prev.y) * ratio,
        });
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // ResizeObserver to fit stage cleanly
  useEffect(() => {
    if (composing) return;
    const el = stageHostRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);
      setHostRect((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [composing, viewLayout]);

  const fittedStage =
    hostRect.width > 0 && hostRect.height > 0 && canvasSize.width > 0 && canvasSize.height > 0
      ? (() => {
          const factor = Math.min(hostRect.width / canvasSize.width, hostRect.height / canvasSize.height);
          return {
            width: Math.max(1, Math.floor(canvasSize.width * factor)),
            height: Math.max(1, Math.floor(canvasSize.height * factor)),
          };
        })()
      : null;

  const updateLayer = (id: string, patch: Partial<CompositionLayerItem>) => {
    mutateLayers((list) =>
      list.map((layer) => {
        const hasPlacement = ["x", "y", "width", "height"].some((k) => k in patch);
        if (layer.id !== id || (layer.locked && hasPlacement)) return layer;
        const next = { ...layer, ...patch };
        if (hasPlacement) {
          if (keepAspect && "width" in patch && "height" in patch) {
            const fit = Math.min(1, 1 / next.width, 1 / next.height);
            next.width *= fit;
            next.height *= fit;
          }
          next.width = Math.max(0.002, Math.min(1, next.width));
          next.height = Math.max(0.002, Math.min(1, next.height));
          next.x = Math.max(0, Math.min(1 - next.width, next.x));
          next.y = Math.max(0, Math.min(1 - next.height, next.y));
        }
        return {
          ...next,
          ...(hasPlacement && !layer.isBackground
            ? {
                alignment: {
                  similarity: layer.alignment?.similarity || 0,
                  confidence: layer.alignment?.confidence || 0,
                  status: "manual" as const,
                },
              }
            : {}),
        };
      }),
    );
  };

  const applyCrop = async (target = cropDraft) => {
    if (!target || cropping) return;
    setCropping(true);
    setError("");
    setNotice("");
    try {
      const patch = await cropCompositionLayer(target.source, target.bounds);
      layerDragRef.current = null;
      updateLayer(target.source.id, patch);
      setCropDraft(null);
      setNotice("Đã cắt khung layer thành công.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCropping(false);
    }
  };

  const handleAutoTrim = async () => {
    if (!selectedLayer || selectedLayer.locked || !selectedLayer.visible || selectedLayer.isBackground || composing || exporting || cropping || cropDraft) {
      return;
    }
    setCropping(true);
    setError("");
    setNotice("");
    try {
      const trimmed = await autoTrimLayerFrame(selectedLayer);
      if (!trimmed) {
        setNotice("Khung đã sát nội dung, không có viền trong suốt thừa để cắt.");
        return;
      }
      layerDragRef.current = null;
      updateLayer(selectedLayer.id, trimmed);
      setNotice("Đã tự cắt sát viền đối tượng, giữ nguyên vị trí & tỷ lệ trên thiết kế.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setCropping(false);
    }
  };

  const onLayerPointerDown = (e: React.PointerEvent, layer: CompositionLayerItem, corner?: ResizeHandle) => {
    if (e.button !== 0 || layer.locked || composing || exporting || cropping) return;
    if (cropDraft && !corner) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(layer.id);
    const canvasEl = (e.currentTarget as Element).closest("[data-composition-canvas]") as HTMLElement | null;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const altCrop = !!(corner && !cropDraft && e.altKey && !layer.isBackground);
    const startBounds = { x: layer.x, y: layer.y, width: layer.width, height: layer.height };
    if (altCrop) {
      setError("");
      setNotice("");
      setCropDraft({ source: layer, bounds: startBounds });
    }
    layerDragRef.current = {
      pointerId: e.pointerId,
      id: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      start: cropDraft ? { ...cropDraft.bounds } : startBounds,
      corner,
      canvasWidth: rect.width,
      canvasHeight: rect.height,
      group: {},
      altCrop,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onLayerPointerMove = (e: React.PointerEvent) => {
    const drag = layerDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = (e.clientX - drag.startX) / drag.canvasWidth;
    const dy = (e.clientY - drag.startY) / drag.canvasHeight;
    if ((cropDraft || drag.altCrop) && drag.corner) {
      const c = drag.corner;
      setCropDraft((prev) => (prev ? { ...prev, bounds: resizeLayerCrop(drag.start, c, dx, dy, prev.source) } : prev));
      return;
    }
    updateLayer(
      drag.id,
      drag.corner
        ? resizeLayerPlacement(drag.start, drag.corner, dx, dy, keepAspect)
        : { x: Math.max(-1, Math.min(1, drag.start.x + dx)), y: Math.max(-1, Math.min(1, drag.start.y + dy)) },
    );
  };

  const onLayerPointerUp = (commitAltCrop: boolean) => {
    const drag = layerDragRef.current;
    layerDragRef.current = null;
    if (!drag?.altCrop) return;
    if (
      !commitAltCrop ||
      !cropDraft ||
      (Math.abs(cropDraft.bounds.x - cropDraft.source.x) < 1e-6 &&
        Math.abs(cropDraft.bounds.y - cropDraft.source.y) < 1e-6 &&
        Math.abs(cropDraft.bounds.width - cropDraft.source.width) < 1e-6 &&
        Math.abs(cropDraft.bounds.height - cropDraft.source.height) < 1e-6)
    ) {
      setCropDraft(null);
      return;
    }
    void applyCrop(cropDraft);
  };

  const moveLayerOrder = (id: string, delta: 1 | -1) => {
    mutateLayers((list) => {
      const idx = list.findIndex((l) => l.id === id);
      if (idx < 0 || idx + delta < 0 || idx + delta >= list.length) return list;
      return reorderCompositionLayers(list, id, list[idx + delta].id, delta > 0 ? "above" : "below");
    });
  };

  const deleteLayer = (id: string) => {
    const target = layers.find((l) => l.id === id);
    if (!target || target.locked || composing || exporting || cropping) return;
    setCropDraft(null);
    if (backgroundDetection.backgroundId === id) bgOverrideRef.current = undefined;
    const remaining = layers.filter((l) => l.id !== id);
    if (selectedId === id) setSelectedId(remaining[remaining.length - 1]?.id || "");
    setHistory((prev) => {
      const wasBg = prev.present.backgroundDetection.backgroundId === id;
      return pushHistory(prev, {
        ...prev.present,
        layers: prev.present.layers.filter((l) => l.id !== id),
        deletedLayerIds: [...(prev.present.deletedLayerIds || []), id],
        ...(wasBg ? { backgroundDetection: { backgroundId: null, status: "missing" }, backgroundOverride: undefined } : {}),
      });
    });
  };

  const buildExportBytes = async (format: ExportFormat): Promise<Uint8Array> => {
    if (format === "psd") {
      return buildCompositionPsd(canvasSize.width, canvasSize.height, layers);
    }
    if (format === "jpg") {
      return buildCompositionJpg(canvasSize.width, canvasSize.height, layers);
    }
    const svg = buildCompositionSvg(canvasSize.width, canvasSize.height, layers, pdfWidthMm);
    const pdfBytes: Uint8Array = await window.electron.invoke(ELECTRON_COMMANDS.EXPORT_VECTOR_PDF, { svg });
    return new Uint8Array(pdfBytes);
  };

  const handleSaveExport = async (format: ExportFormat) => {
    if (composing || exporting || cropping || cropDraft) return;
    if (!backgroundDetection.backgroundId) {
      setError("Hãy chọn đúng layer nền trước khi xuất file.");
      return;
    }
    setExportMenuOpen(false);
    setExporting(true);
    setExportFormat(format);
    setError("");
    setNotice("");
    try {
      const bytes = await buildExportBytes(format);
      const base = (fileName || "thiet-ke").replace(/\.[^/.]+$/, "").replace(/[/\\?%*:|"<>]/g, "_") || "thiet-ke";
      const saved = await saveFileAs({
        defaultName: `${base}-ghep-layer.${format}`,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
        bytes,
      });
      if (saved) setNotice(`Đã lưu file ${format.toUpperCase()}: ${saved}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const handleOpenInDesignApp = async (target: DesignAppTarget) => {
    if (composing || exporting || cropping || cropDraft) return;
    if (!backgroundDetection.backgroundId) {
      setError("Hãy chọn đúng layer nền trước khi mở bằng phần mềm thiết kế.");
      return;
    }
    const format: ExportFormat = target === "photoshop" ? "psd" : "pdf";
    const appNames: Record<DesignAppTarget, string> = {
      photoshop: "Adobe Photoshop",
      corel: "CorelDRAW",
      illustrator: "Adobe Illustrator",
    };
    setExporting(true);
    setOpeningApp(target);
    setExportFormat(format);
    setError("");
    setNotice("");
    try {
      const bytes = await buildExportBytes(format);
      const corelDocument =
        target === "corel"
          ? {
              width: canvasSize.width,
              height: canvasSize.height,
              layers: layers
                .filter((l) => l.visible)
                .map((l) => ({
                  title: l.title,
                  dataUrl: l.dataUrl,
                  x: l.x,
                  y: l.y,
                  width: l.width,
                  height: l.height,
                })),
            }
          : undefined;
      await window.electron.invoke(ELECTRON_COMMANDS.OPEN_IN_DESIGN_APP, {
        target,
        fileName,
        extension: format,
        bytes,
        corelDocument,
      });
      setNotice(`Đã gửi bản ghép sang ${appNames[target]} và đang mở phần mềm.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
      setOpeningApp(null);
    }
  };

  const viewportProps = {
    "data-preview-viewport": true,
    className: "relative mx-auto shrink-0 touch-none rounded-xl",
    style: fittedStage
      ? { width: fittedStage.width, height: fittedStage.height, overflow: "hidden" as const }
      : { aspectRatio: `${canvasSize.width}/${canvasSize.height}`, maxWidth: "100%", maxHeight: "100%", overflow: "hidden" as const },
    onPointerDownCapture: (e: React.PointerEvent<HTMLDivElement>) => {
      const isMiddle = e.button === 1;
      const isAltLeft = e.button === 0 && e.altKey && !(e.target as Element).closest("[data-resize-box] button");
      if (!isMiddle && !isAltLeft) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      panDragRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, width: rect.width, height: rect.height };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const pan = panDragRef.current;
      if (!pan || pan.pointerId !== e.pointerId) return;
      const dx = (e.clientX - pan.x) / pan.width;
      const dy = (e.clientY - pan.y) / pan.height;
      pan.x = e.clientX;
      pan.y = e.clientY;
      setViewport((prev) => clampViewport({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    },
    onPointerUp: () => {
      panDragRef.current = null;
    },
    onPointerCancel: () => {
      panDragRef.current = null;
    },
  };

  const transformStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    transformOrigin: "0 0",
    transform: `translate(${viewport.x * 100}%, ${viewport.y * 100}%) scale(${viewport.scale})`,
  };

  return (
    <div className="fixed inset-0 z-[9999] flex bg-slate-950/70 p-3 backdrop-blur-sm sm:p-5">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-base-content/15 bg-base-200 text-base-content shadow-2xl outline-none"
      >
        {/* Header */}
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-base-content/10 bg-base-100 px-4 py-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-extrabold">
              <Layers className="h-5 w-5 text-primary" />
              Ghép layer tự động & Xuất file thiết kế ({canvasSize.width}×{canvasSize.height}px)
            </h2>
            <p className="mt-0.5 text-xs font-light text-base-content/65">
              Kéo trong khung để di chuyển · Kéo góc/cạnh để thu phóng · Giữ Alt + kéo chốt để cắt khung · Xuất PSD giữ Smart Object cho Photoshop / Corel / AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn btn-sm"
              title="Hoàn tác (Ctrl+Z)"
              disabled={composing || exporting || cropping || !history.past.length}
              onClick={() => stepHistory("undo")}
            >
              <Undo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              title="Làm lại (Ctrl+Y)"
              disabled={composing || exporting || cropping || !history.future.length}
              onClick={() => stepHistory("redo")}
            >
              <Redo2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="btn btn-sm"
              title="Tự động căn chỉnh lại các layer chưa khóa"
              disabled={composing || exporting}
              onClick={() => void runAutoCompose()}
            >
              <RefreshCw className="h-4 w-4" /> Tự ghép lại
            </button>

            {/* Export dropdown */}
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                disabled={
                  composing ||
                  exporting ||
                  cropping ||
                  !!cropDraft ||
                  !backgroundDetection.backgroundId ||
                  !layers.some((l) => l.visible)
                }
                onClick={() => setExportMenuOpen((v) => !v)}
                className="btn btn-primary btn-sm"
              >
                {exporting && !openingApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {exporting && !openingApp ? `Đang xuất ${exportFormat.toUpperCase()}...` : "Xuất file"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-base-content/15 bg-base-100 p-1.5 shadow-2xl">
                  {(
                    [
                      ["psd", "Xuất PSD (Photoshop)", "Giữ từng layer, khóa & Smart Object"],
                      ["pdf", "Xuất PDF đa lớp", "Dùng cho in ấn, CorelDRAW, Illustrator"],
                      ["jpg", "Xuất JPG phẳng", "Ảnh gộp chất lượng cao tối đa 12K"],
                    ] as const
                  ).map(([fmt, title, hint]) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => void handleSaveExport(fmt)}
                      className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-base-200"
                    >
                      <span className="text-xs font-extrabold">{title}</span>
                      <span className="text-[11px] font-light text-base-content/65">{hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <OpenInDesignMenu
              onSelect={handleOpenInDesignApp}
              busyTarget={openingApp}
              disabled={
                composing ||
                exporting ||
                cropping ||
                !!cropDraft ||
                !backgroundDetection.backgroundId ||
                !layers.some((l) => l.visible)
              }
            />

            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              disabled={exporting}
              onClick={onClose}
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        {error && <div className="shrink-0 bg-error/15 px-4 py-2 text-xs font-semibold text-error">{error}</div>}
        {notice && <div className="shrink-0 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-300">{notice}</div>}

        {!composing && (
          <div
            className={cn(
              "shrink-0 border-b border-base-content/10 px-4 py-1.5 text-xs",
              backgroundDetection.backgroundId ? "bg-sky-500/10 text-sky-600 dark:text-sky-300" : "bg-amber-500/15 text-amber-600 dark:text-amber-300",
            )}
          >
            {backgroundDetection.backgroundId
              ? `${backgroundDetection.status === "manual" ? "Nền bạn đã chọn" : "Đã tự nhận diện nền"}: "${
                  layers.find((l) => l.id === backgroundDetection.backgroundId)?.title || "Background"
                }" — đặt dưới cùng và phủ kín khung thiết kế.`
              : "Chưa nhận diện chắc chắn ảnh nền. Hãy chọn đúng layer nền ở cột bên phải để hệ thống tự căn chỉnh tọa độ các lớp."}
          </div>
        )}

        {/* Main Workspace */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
          {/* Canvas Column */}
          <div className="flex min-w-0 flex-1 flex-col p-4 lg:min-h-0 lg:overflow-hidden">
            {/* Toolbar */}
            <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-xs"
                onClick={() => setViewport({ scale: 1, x: 0, y: 0 })}
                title="Đặt lại thu phóng 100%"
              >
                {Math.round(viewport.scale * 100)}% · Vừa khung
              </button>

              <div className="flex rounded-lg border border-base-content/15 bg-base-100 p-0.5 text-[11px] font-bold">
                {(
                  [
                    ["reference-sidebar", "Thiết kế"],
                    ["side-by-side", "So sánh 2 bên"],
                    ["overlay", "Chồng đối chiếu"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setViewLayout(id)}
                    className={cn(
                      "rounded-md px-2.5 py-1 transition-colors",
                      viewLayout === id ? "bg-primary text-primary-content" : "text-base-content/70 hover:bg-base-200",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="flex cursor-pointer items-center gap-1.5 text-xs font-semibold">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary checkbox-xs"
                  checked={keepAspect}
                  onChange={(e) => setKeepAspect(e.target.checked)}
                />
                Giữ tỉ lệ góc
              </label>

              {viewLayout === "overlay" && (
                <label className="flex items-center gap-2 text-xs">
                  <span>Độ rõ bản ghép: {overlayOpacity}%</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={overlayOpacity}
                    onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                    className="range range-primary range-xs w-28"
                  />
                </label>
              )}

              {selectedLayer && !cropDraft && (
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="btn btn-xs"
                    disabled={
                      selectedLayer.locked ||
                      !selectedLayer.visible ||
                      selectedLayer.isBackground ||
                      composing ||
                      exporting ||
                      cropping
                    }
                    onClick={() => {
                      setError("");
                      setNotice("");
                      setCropDraft({
                        source: selectedLayer,
                        bounds: {
                          x: selectedLayer.x,
                          y: selectedLayer.y,
                          width: selectedLayer.width,
                          height: selectedLayer.height,
                        },
                      });
                    }}
                  >
                    <Crop className="h-3.5 w-3.5" /> Cắt khung
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs"
                    disabled={
                      selectedLayer.locked ||
                      !selectedLayer.visible ||
                      selectedLayer.isBackground ||
                      composing ||
                      exporting ||
                      cropping
                    }
                    onClick={() => void handleAutoTrim()}
                    title="Tự động ôm sát phần đối tượng hiển thị, bỏ viền trong suốt thừa"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    {cropping ? "Đang cắt..." : "Tự cắt khung"}
                  </button>
                </div>
              )}

              {cropDraft && (
                <div className="ml-auto flex gap-1.5">
                  <button type="button" className="btn btn-warning btn-xs" disabled={cropping} onClick={() => void applyCrop()}>
                    {cropping ? "Đang cắt..." : "Áp dụng cắt"}
                  </button>
                  <button type="button" className="btn btn-xs" disabled={cropping} onClick={() => setCropDraft(null)}>
                    Hủy cắt
                  </button>
                </div>
              )}
            </div>

            {/* Stage */}
            {composing ? (
              <div className="flex min-h-64 flex-1 items-center justify-center gap-3 rounded-2xl border border-base-content/10 bg-base-100 text-sm font-bold">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                Đang tự nhận diện nền & căn chỉnh tọa độ layer {progressCount}/{inputs.length}...
              </div>
            ) : (
              <div className={cn("grid min-h-0 flex-1 grid-cols-1 gap-4", viewLayout === "side-by-side" && "md:grid-cols-2")}>
                {viewLayout === "side-by-side" && (
                  <section className="flex min-h-0 flex-col">
                    <h3 className="mb-1.5 text-xs font-bold">Ảnh gốc đối chiếu</h3>
                    <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 p-2">
                      <div {...viewportProps}>
                        <div className="relative overflow-hidden rounded-lg" style={transformStyle}>
                          <img src={originalSource} alt="Ảnh gốc" className="block h-full w-full object-contain" draggable={false} />
                          {selectedLayer?.visible && (
                            <div
                              aria-hidden
                              className="pointer-events-none absolute border-2 border-dashed border-sky-400"
                              style={{
                                left: `${selectedLayer.x * 100}%`,
                                top: `${selectedLayer.y * 100}%`,
                                width: `${selectedLayer.width * 100}%`,
                                height: `${selectedLayer.height * 100}%`,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                <section className="flex min-h-0 flex-col">
                  <h3 className="mb-1.5 text-xs font-bold">
                    {viewLayout === "overlay" ? "Chồng ảnh gốc & bản ghép" : "Khung ghép thiết kế"} ({layers.filter((l) => l.visible).length} lớp hiển thị)
                  </h3>
                  <div
                    ref={stageHostRef}
                    className="checkerboard flex min-h-[260px] flex-1 items-center justify-center overflow-hidden rounded-2xl border border-base-content/10 p-2"
                  >
                    <div {...viewportProps}>
                      <div
                        data-composition-canvas
                        className="relative isolate touch-none rounded-lg border border-base-content/20 bg-white shadow-lg"
                        style={transformStyle}
                      >
                        {viewLayout === "overlay" && (
                          <img
                            src={originalSource}
                            alt="Ảnh gốc để căn chồng"
                            draggable={false}
                            className="pointer-events-none absolute inset-0 h-full w-full select-none"
                          />
                        )}
                        {!backgroundDetection.backgroundId ? (
                          <div className="flex h-full items-center justify-center p-6 text-center text-xs text-slate-600">
                            Chọn đúng ảnh Background ở cột bên phải để bắt đầu ghép các đối tượng.
                          </div>
                        ) : (
                          <div
                            className="absolute inset-0 overflow-hidden rounded-[inherit]"
                            style={{ opacity: viewLayout === "overlay" ? overlayOpacity / 100 : 1 }}
                          >
                            {layers
                              .filter((l) => l.visible)
                              .map((layer) => (
                                <button
                                  key={layer.id}
                                  type="button"
                                  aria-label={`Chọn layer ${layer.title}`}
                                  tabIndex={layer.locked ? -1 : 0}
                                  onClick={() => setSelectedId(layer.id)}
                                  onPointerDown={(e) => onLayerPointerDown(e, layer)}
                                  onPointerMove={onLayerPointerMove}
                                  onPointerUp={() => {
                                    layerDragRef.current = null;
                                  }}
                                  onPointerCancel={() => {
                                    layerDragRef.current = null;
                                  }}
                                  onKeyDown={(e) => {
                                    if (layer.locked || composing || exporting || cropDraft) return;
                                    const stepVec: Record<string, [number, number]> = {
                                      ArrowLeft: [-1, 0],
                                      ArrowRight: [1, 0],
                                      ArrowUp: [0, -1],
                                      ArrowDown: [0, 1],
                                    };
                                    const dir = stepVec[e.key];
                                    if (!dir) return;
                                    e.preventDefault();
                                    const pxStep = e.shiftKey ? 10 : 1;
                                    updateLayer(layer.id, {
                                      x: layer.x + (dir[0] * pxStep) / canvasSize.width,
                                      y: layer.y + (dir[1] * pxStep) / canvasSize.height,
                                    });
                                  }}
                                  style={{
                                    position: "absolute",
                                    pointerEvents: layer.locked ? "none" : undefined,
                                    left: `${layer.x * 100}%`,
                                    top: `${layer.y * 100}%`,
                                    width: `${layer.width * 100}%`,
                                    height: `${layer.height * 100}%`,
                                    outline:
                                      layer.id === selectedId
                                        ? `2px solid ${layer.locked ? "#94a3b8" : "#0ea5e9"}`
                                        : undefined,
                                    outlineOffset: "-2px",
                                  }}
                                  className="touch-none cursor-move border-0 bg-transparent p-0"
                                >
                                  <img
                                    src={layer.dataUrl}
                                    alt={layer.title}
                                    draggable={false}
                                    className="pointer-events-none block h-full w-full select-none"
                                  />
                                </button>
                              ))}
                          </div>
                        )}

                        {backgroundDetection.backgroundId && selectedLayer?.visible && !selectedLayer.locked && activeBounds && (
                          <div
                            data-resize-box
                            style={{
                              position: "absolute",
                              pointerEvents: "none",
                              left: `${activeBounds.x * 100}%`,
                              top: `${activeBounds.y * 100}%`,
                              width: `${activeBounds.width * 100}%`,
                              height: `${activeBounds.height * 100}%`,
                              outline: cropDraft ? "2px dashed #f59e0b" : undefined,
                              boxShadow: cropDraft ? "0 0 0 9999px rgba(15, 23, 42, 0.35)" : undefined,
                            }}
                          >
                            {HANDLES.map(([handle, label]) => (
                              <button
                                key={handle}
                                type="button"
                                aria-label={`${cropDraft ? "Cắt khung" : "Thu phóng"} ${label}`}
                                onPointerDown={(e) => onLayerPointerDown(e, selectedLayer, handle)}
                                onPointerMove={onLayerPointerMove}
                                onPointerUp={() => onLayerPointerUp(true)}
                                onPointerCancel={() => onLayerPointerUp(false)}
                                className="absolute h-6 w-6 touch-none rounded-full border-0 bg-transparent p-0"
                                style={{
                                  pointerEvents: "auto",
                                  cursor:
                                    handle === "w" || handle === "e"
                                      ? "ew-resize"
                                      : handle === "n" || handle === "s"
                                        ? "ns-resize"
                                        : handle === "nw" || handle === "se"
                                          ? "nwse-resize"
                                          : "nesw-resize",
                                  left: handle.endsWith("w") ? -12 : handle.endsWith("e") ? undefined : "calc(50% - 12px)",
                                  right: handle.endsWith("e") ? -12 : undefined,
                                  top: handle.startsWith("n") ? -12 : handle.startsWith("s") ? undefined : "calc(50% - 12px)",
                                  bottom: handle.startsWith("s") ? -12 : undefined,
                                }}
                              >
                                <span
                                  aria-hidden
                                  className={cn(
                                    "pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-white bg-sky-500 shadow ring-1 ring-sky-600",
                                    handle.length === 2 && "rotate-45",
                                  )}
                                  style={
                                    handle.length === 1
                                      ? {
                                          width: handle === "w" || handle === "e" ? 6 : 12,
                                          height: handle === "w" || handle === "e" ? 12 : 6,
                                        }
                                      : undefined
                                  }
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>

          {/* Right Layer Stack Sidebar */}
          <aside className="flex w-full shrink-0 flex-col gap-3 border-t border-base-content/10 bg-base-100 p-3 lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
            {viewLayout === "reference-sidebar" && (
              <section>
                <h3 className="mb-1.5 text-xs font-extrabold">Ảnh gốc đối chiếu</h3>
                <div
                  className="relative overflow-hidden rounded-xl border border-base-content/10 bg-base-200"
                  style={{ aspectRatio: `${canvasSize.width}/${canvasSize.height}` }}
                >
                  <img src={originalSource} alt="Ảnh gốc" draggable={false} className="block h-full w-full object-contain" />
                  {selectedLayer?.visible && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute border border-dashed border-sky-400"
                      style={{
                        left: `${selectedLayer.x * 100}%`,
                        top: `${selectedLayer.y * 100}%`,
                        width: `${selectedLayer.width * 100}%`,
                        height: `${selectedLayer.height * 100}%`,
                      }}
                    />
                  )}
                </div>
              </section>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-bold">
                Layer làm nền
                <select
                  className="select select-bordered select-xs w-full"
                  value={backgroundDetection.backgroundId || ""}
                  disabled={composing || exporting || anyLocked}
                  title={anyLocked ? "Mở khóa các layer trước khi đổi nền" : undefined}
                  onChange={(e) => {
                    const nextBgId = e.target.value;
                    if (!nextBgId) return;
                    bgOverrideRef.current = nextBgId;
                    void runAutoCompose();
                  }}
                >
                  <option value="" disabled>
                    Chọn background...
                  </option>
                  {inputs
                    .filter((i) => !history.present.deletedLayerIds?.includes(i.id))
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.title}
                      </option>
                    ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-xs font-bold">
                Khổ rộng PDF (mm)
                <input
                  type="number"
                  min={10}
                  max={2000}
                  value={pdfWidthMm}
                  onChange={(e) => setPdfWidthMm(Math.max(10, Math.min(2000, Number(e.target.value) || 300)))}
                  className="input input-bordered input-xs w-full"
                />
              </label>
            </div>

            <div>
              <h3 className="text-xs font-extrabold">Danh sách lớp (Trên → Dưới)</h3>
              <p className="mb-2 text-[11px] font-light text-base-content/60">
                Đổi tên, ẩn/hiện, khóa vị trí hoặc sắp xếp thứ tự chồng lớp trước khi xuất PSD / Corel.
              </p>

              <div className="space-y-1.5">
                {[...layers].reverse().map((layer) => {
                  const active = layer.id === selectedId;
                  const alignMeta = !layer.isBackground && layer.alignment ? ALIGNMENT_LABELS[layer.alignment.status] : null;
                  return (
                    <div
                      key={layer.id}
                      onClick={() => setSelectedId(layer.id)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-2 transition-colors",
                        active ? "border-primary bg-primary/10" : "border-base-content/10 bg-base-200/50 hover:border-primary/40",
                      )}
                    >
                      <div className="checkerboard h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-base-content/10">
                        <img src={layer.dataUrl} alt="" className="h-full w-full object-contain" draggable={false} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <input
                          value={layer.title}
                          onChange={(e) => updateLayer(layer.id, { title: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full truncate bg-transparent text-xs font-bold outline-none focus:underline"
                        />
                        <div className="mt-0.5 flex items-center gap-1.5">
                          {layer.isBackground ? (
                            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-600 dark:text-violet-300">
                              Nền
                            </span>
                          ) : (
                            alignMeta && (
                              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", alignMeta.badge)}>
                                {alignMeta.label}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          disabled={layer.locked}
                          onClick={() => moveLayerOrder(layer.id, 1)}
                          title="Đưa lên trên"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          disabled={layer.locked}
                          onClick={() => moveLayerOrder(layer.id, -1)}
                          title="Đưa xuống dưới"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                          title={layer.visible ? "Ẩn layer" : "Hiện layer"}
                        >
                          {layer.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 opacity-50" />}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                          title={layer.locked ? "Mở khóa" : "Khóa vị trí"}
                        >
                          {layer.locked ? <Lock className="h-3.5 w-3.5 text-amber-500" /> : <Unlock className="h-3.5 w-3.5 opacity-60" />}
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square text-error"
                          disabled={layer.locked}
                          onClick={() => deleteLayer(layer.id)}
                          title="Xóa layer khỏi bản ghép"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
