import React, { useState } from "react";
import { useAtomValue } from "jotai";
import { ImagePlus, Trash2, X } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { cn } from "@/lib/utils";
import { activeTabAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import { fileUrl, storeImageFile } from "../common";

/**
 * Several reference images in a grid: click the + tile to choose, drop one or
 * more files, or Ctrl+V when this list takes the paste. Optional per-image note.
 */
export function ImageList({
  label,
  hint,
  paths,
  onChange,
  max,
  notes,
  onNotesChange,
  numberFrom,
  acceptPaste,
}: {
  label: string;
  hint?: string;
  paths: string[];
  onChange: (paths: string[]) => void;
  max: number;
  /** Per-image notes, kept aligned with `paths` */
  notes?: string[];
  onNotesChange?: (notes: string[]) => void;
  /** "Ảnh n" numbering, matching the order the prompt describes */
  numberFrom: number;
  acceptPaste?: boolean;
}) {
  const { toast } = useToast();
  const activeTab = useAtomValue(activeTabAtom);
  const [dragging, setDragging] = useState(false);
  const full = paths.length >= max;

  const add = (added: string[]) => {
    const room = max - paths.length;
    if (room <= 0) return;
    const taken = added.slice(0, room);
    onChange([...paths, ...taken]);
    onNotesChange?.([...(notes ?? paths.map(() => "")), ...taken.map(() => "")]);
    if (added.length > room) toast({ title: `Tối đa ${max} ảnh`, description: `Đã thêm ${room} ảnh đầu tiên.` });
  };

  const remove = (index: number) => {
    onChange(paths.filter((_, i) => i !== index));
    onNotesChange?.((notes ?? []).filter((_, i) => i !== index));
  };

  const addFiles = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    add(await Promise.all(images.map((f) => storeImageFile(f, f.name || "anh.png"))));
  };

  React.useEffect(() => {
    if (activeTab !== "ad-designer" || !acceptPaste) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.items ?? [])
        .filter((i) => i.type.startsWith("image/"))
        .map((i) => i.getAsFile())
        .filter((f): f is File => !!f);
      if (!files.length) return;
      event.preventDefault();
      addFiles(files).then(() => toast({ title: "Đã dán ảnh từ Clipboard" }));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  });

  const choose = async () => {
    const path = await window.electron.invoke(ELECTRON_COMMANDS.SELECT_FILE);
    if (path) add([path]);
  };

  return (
    <div
      className={cn("rounded-2xl border p-2.5 transition-colors", dragging ? "border-primary bg-primary/10" : "border-base-content/10 bg-base-100")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        addFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-bold">{label}</span>
        <span className="text-[11px] font-light text-base-content/60">
          {paths.length}/{max}
        </span>
        {paths.length > 0 && (
          <button className="btn btn-ghost btn-xs ml-auto" onClick={() => { onChange([]); onNotesChange?.([]); }}>
            <Trash2 className="h-3 w-3" /> Xóa hết
          </button>
        )}
      </div>
      {hint && <p className="-mt-1 mb-2 text-[11px] font-light leading-4 text-base-content/60">{hint}</p>}
      <div className="grid grid-cols-3 gap-2">
        {paths.map((path, index) => (
          <div key={path} className="flex flex-col gap-1">
            <div className="group relative aspect-square overflow-hidden rounded-xl border border-base-content/10">
              <img src={fileUrl(path)} alt="" className="checkerboard h-full w-full object-cover" draggable={false} />
              <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] font-bold text-white">Ảnh {numberFrom + index}</span>
              <button
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => remove(index)}
                aria-label={`Xóa ảnh ${numberFrom + index}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {onNotesChange && (
              <input
                className="input input-bordered input-xs w-full"
                placeholder="Ghi chú ảnh"
                value={notes?.[index] ?? ""}
                onChange={(e) => onNotesChange((notes ?? paths.map(() => "")).map((n, i) => (i === index ? e.target.value : n)))}
              />
            )}
          </div>
        ))}
        {!full && (
          <button
            onClick={choose}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-base-content/20 text-base-content/60 hover:border-primary/60 hover:text-primary"
          >
            <ImagePlus className="h-5 w-5" />
            <span className="mt-1 text-[10px] font-semibold">Thêm ảnh</span>
          </button>
        )}
      </div>
    </div>
  );
}
