import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Loader2,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { SaveFilePayload, SaveFilesToFolderPayload } from "@common/types/types";
import { sanitizePath } from "@common/sanitize-path";
import { cn } from "@/lib/utils";
import { getTool, ToolId } from "@/lib/tools";
import { activeTabAtom, pendingToolImageAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";

// The app's file:// handler treats a query string as part of the file name,
// so results get unique file names instead of cache-busting parameters.
export const fileUrl = (path: string) => `file:///${sanitizePath(path)}`;

export const fileName = (path: string) =>
  path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "anh";

/** Opens a save dialog; returns the saved path or null when cancelled. */
export const saveFileAs = (payload: SaveFilePayload): Promise<string | null> =>
  window.electron.invoke(ELECTRON_COMMANDS.SAVE_FILE_AS, payload);

/** Asks for a folder and copies all files into it; returns the count saved (0 when cancelled). */
export const saveFilesToFolder = async (payload: SaveFilesToFolderPayload): Promise<number> => {
  const result = await window.electron.invoke(ELECTRON_COMMANDS.SAVE_FILES_TO_FOLDER, payload);
  return result?.count ?? 0;
};

export const fileExtension = (path: string) => path.split(".").pop()?.toLowerCase() || "png";

/** Delivers an image another tool sent here ("Chuyển sang ..."), once. */
export const usePendingToolImage = (toolId: ToolId, onImage: (path: string) => void) => {
  const [pending, setPending] = useAtom(pendingToolImageAtom);
  const path = pending[toolId];
  useEffect(() => {
    if (!path) return;
    setPending((prev) => ({ ...prev, [toolId]: undefined }));
    onImage(path);
  }, [path]);
};

const IMAGE_FILTERS = [{ name: "Ảnh", extensions: ["png", "jpg", "jpeg", "webp"] }];

/** Writes an in-memory image (drop, paste) to a temp file and returns its path. */
export const storeImageFile = async (file: Blob, name = "dan-anh.png") =>
  (await window.electron.invoke(ELECTRON_COMMANDS.SAVE_TEMP_IMAGE, {
    bytes: await file.arrayBuffer(),
    name,
  })) as string;

export const errorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  // ipcRenderer.invoke wraps main-process errors in a long prefix
  return message.replace(/^Error invoking remote method '[^']+': (Error: )?/, "");
};

// ---------------------------------------------------------------------------
// Layout

export function ToolLayout({
  toolId,
  aside,
  children,
  footer,
}: {
  toolId: ToolId;
  aside: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const tool = getTool(toolId);
  const setActiveTab = useSetAtom(activeTabAtom);
  const Icon = tool.icon;

  return (
    <div className="flex h-full w-full overflow-hidden bg-base-300 text-base-content">
      <aside className="flex w-[370px] shrink-0 flex-col overflow-hidden border-r border-base-content/10 bg-base-200">
        <div className="flex items-center gap-3 border-b border-base-content/10 px-4 py-3">
          <button
            className="btn btn-ghost btn-sm btn-square"
            onClick={() => setActiveTab("home")}
            data-tooltip-id="tooltip"
            data-tooltip-content="Về Trang chủ"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", tool.tint)}>
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-extrabold">{tool.title}</h2>
            <p className="truncate text-xs text-base-content/60">{tool.description}</p>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">{aside}</div>
        {footer && (
          <div className="border-t border-base-content/10 bg-base-200 p-4">{footer}</div>
        )}
      </aside>
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}

export function Section({
  step,
  title,
  hint,
  children,
}: {
  step?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        {step && <span className="text-xs font-black text-primary">{step}</span>}
        <h3 className="text-xs font-bold uppercase tracking-wide text-base-content/80">{title}</h3>
      </div>
      {hint && <p className="-mt-1 text-xs text-base-content/60">{hint}</p>}
      {children}
    </section>
  );
}

export type Option<T extends string> = { value: T; label: string; hint?: string };

/** Grid of selectable cards with an optional one-line hint. */
export function OptionCards<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  // The renderer is compiled without `strict`, where T always widens to
  // string here; callers pass typed setters, so accept any setter
  options: Option<string>[];
  value: T;
  onChange: (value: any) => void;
  columns?: 2 | 3 | 4;
}) {
  const grid = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[columns];
  return (
    <div className={cn("grid gap-2", grid)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value as T)}
            className={cn(
              "flex flex-col items-start rounded-xl border px-3 py-2 text-left transition-all",
              selected
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-base-content/10 bg-base-100 hover:border-primary/50",
            )}
          >
            <span className={cn("text-xs font-bold", selected && "text-primary")}>
              {option.label}
            </span>
            {option.hint && (
              <span className="text-[11px] leading-4 text-base-content/60">{option.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact segmented control. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  // The renderer is compiled without `strict`, where T always widens to
  // string here; callers pass typed setters, so accept any setter
  options: Option<string>[];
  value: T;
  onChange: (value: any) => void;
}) {
  return (
    <div className="flex rounded-xl border border-base-content/10 bg-base-100 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value as T)}
          className={cn(
            "flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition-all",
            option.value === value
              ? "bg-primary text-primary-content shadow"
              : "text-base-content/70 hover:bg-base-200",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function ColorChoices({
  colors,
  value,
  onChange,
}: {
  colors: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            "h-7 w-7 rounded-full border-2 transition-transform",
            value === color ? "scale-110 border-primary" : "border-base-content/20",
          )}
          style={{ background: color }}
          aria-label={color}
        />
      ))}
      <label className="flex h-7 cursor-pointer items-center gap-1 rounded-full border border-base-content/20 bg-base-100 px-2 text-[11px] font-bold">
        <input
          type="color"
          className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        Khác
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Image input

/**
 * Click to choose, drag & drop, or Ctrl+V while the tool is the active tab.
 * Always reports a file path on disk.
 */
export function ImageInput({
  toolId,
  imagePath,
  onChange,
  label = "Kéo thả ảnh hoặc bấm chọn",
  compact,
  acceptPaste = true,
}: {
  toolId: ToolId;
  imagePath: string;
  onChange: (path: string) => void;
  label?: string;
  compact?: boolean;
  /** Only one input per tool should take Ctrl+V */
  acceptPaste?: boolean;
}) {
  const { toast } = useToast();
  const activeTab = useAtomValue(activeTabAtom);
  const [dragging, setDragging] = useState(false);

  const acceptFile = useCallback(
    async (file: File | null | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast({ title: "Tệp không hợp lệ", description: "Vui lòng chọn ảnh JPG, PNG hoặc WEBP." });
        return;
      }
      onChange(await storeImageFile(file, file.name || "anh.png"));
    },
    [onChange, toast],
  );

  useEffect(() => {
    if (activeTab !== toolId || !acceptPaste) return;
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      if (!item) return;
      event.preventDefault();
      acceptFile(item.getAsFile()).then(() =>
        toast({ title: "Đã dán ảnh từ Clipboard" }),
      );
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [activeTab, toolId, acceptPaste, acceptFile, toast]);

  const choose = async () => {
    const path = await window.electron.invoke(ELECTRON_COMMANDS.SELECT_FILE);
    if (path) onChange(path);
  };

  return (
    <div
      onClick={choose}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        acceptFile(e.dataTransfer.files[0]);
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed text-center transition-all",
        compact ? "h-28" : "h-40",
        dragging
          ? "border-primary bg-primary/10"
          : "border-base-content/20 bg-base-100 hover:border-primary/60",
      )}
    >
      {imagePath ? (
        <>
          <img
            src={fileUrl(imagePath)}
            alt=""
            className="checkerboard h-full w-full object-contain"
            draggable={false}
          />
          <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            Bấm để đổi ảnh khác
          </span>
        </>
      ) : (
        <>
          <ImagePlus className="mb-2 h-7 w-7 text-primary" />
          <p className="text-xs font-bold">{label}</p>
          <p className="mt-1 text-[11px] text-base-content/60">
            JPG, PNG, WEBP · <kbd className="kbd kbd-xs">Ctrl+V</kbd> để dán
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result area

export function EmptyState({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
        <Icon className="h-8 w-8" />
      </span>
      <h3 className="text-lg font-extrabold">{title}</h3>
      <p className="max-w-md text-sm text-base-content/60">{text}</p>
    </div>
  );
}

export function BusyOverlay({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-base-300/80 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="text-sm font-bold">{text}</p>
    </div>
  );
}

export function PreviewCard({
  label,
  src,
  onZoom,
  checker = true,
  children,
}: {
  label: string;
  src?: string;
  onZoom?: () => void;
  checker?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-content/10 bg-base-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-base-content/10 px-3 py-2">
        <span className="text-[11px] font-black uppercase tracking-wide text-base-content/70">{label}</span>
        {onZoom && (
          <button className="btn btn-ghost btn-xs" onClick={onZoom} data-tooltip-id="tooltip" data-tooltip-content="Xem toàn màn hình">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className={cn("flex min-h-0 flex-1 items-center justify-center p-3", checker && "checkerboard")}>
        {src ? (
          <img src={src} alt={label} className="max-h-full max-w-full object-contain" draggable={false} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/** Before / after slider over two images. */
export function CompareView({
  before,
  after,
  beforeLabel = "Trước",
  afterLabel = "Sau",
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}) {
  return (
    <div className="checkerboard relative h-full w-full overflow-hidden rounded-2xl">
      <ReactCompareSlider
        className="h-full w-full"
        itemOne={<ReactCompareSliderImage src={before} alt={beforeLabel} style={{ objectFit: "contain" }} />}
        itemTwo={<ReactCompareSliderImage src={after} alt={afterLabel} style={{ objectFit: "contain" }} />}
      />
      <span className="pointer-events-none absolute left-3 top-3 rounded-md bg-slate-950/75 px-2.5 py-1 text-xs font-bold text-white">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-md bg-emerald-600/90 px-2.5 py-1 text-xs font-bold text-white">
        {afterLabel}
      </span>
    </div>
  );
}

/** Full-screen viewer with wheel zoom and drag to pan. */
export function ZoomModal({
  src,
  title,
  onClose,
  onPrev,
  onNext,
}: {
  src: string | null;
  title: string;
  onClose: () => void;
  /** Optional gallery navigation (also on the arrow keys) */
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") onPrev?.();
      if (e.key === "ArrowRight") onNext?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, onClose, onPrev, onNext]);

  if (!src) return null;
  const zoom = (delta: number) =>
    setScale((s) => {
      const next = Math.min(8, Math.max(1, +(s + delta).toFixed(2)));
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-base-300/95 backdrop-blur-lg">
      <div className="flex items-center justify-between border-b border-base-content/10 bg-base-100 px-5 py-3">
        <h3 className="text-sm font-extrabold">{title}</h3>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost btn-sm" onClick={() => zoom(-0.25)} disabled={scale <= 1}>
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-14 text-center text-xs font-bold">{Math.round(scale * 100)}%</span>
          <button className="btn btn-ghost btn-sm" onClick={() => zoom(0.25)}>
            <Plus className="h-4 w-4" />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }}>
            <RotateCcw className="h-4 w-4" />
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            <X className="h-4 w-4" /> Đóng (Esc)
          </button>
        </div>
      </div>
      <div
        className={cn("checkerboard relative flex flex-1 items-center justify-center overflow-hidden", scale > 1 ? "cursor-grab" : "")}
        onWheel={(e) => zoom(e.deltaY < 0 ? 0.25 : -0.25)}
        onMouseDown={(e) => {
          if (scale > 1) drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
        }}
        onMouseMove={(e) => {
          if (drag.current) setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y });
        }}
        onMouseUp={() => (drag.current = null)}
        onMouseLeave={() => (drag.current = null)}
      >
        <img
          src={src}
          alt={title}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        />
        {onPrev && (
          <button
            className="btn btn-circle absolute left-4 top-1/2 -translate-y-1/2 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onPrev}
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {onNext && (
          <button
            className="btn btn-circle absolute right-4 top-1/2 -translate-y-1/2 shadow-lg"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onNext}
            aria-label="Ảnh tiếp theo"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}

export const IMAGE_SAVE_FILTERS = IMAGE_FILTERS;
