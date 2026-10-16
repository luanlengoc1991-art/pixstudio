import React, { useEffect, useRef, useState } from "react";
import { Check, Info, MousePointerSquareDashed, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Region } from "./prompts";

export const MAX_REGIONS = 9;

type Draft = { x: number; y: number; width: number; height: number };

const clamp = (v: number) => Math.min(1, Math.max(0, v));

/** Full-screen editor: drag on the image to draw red boxes and name each object. */
export default function RegionEditor({
  src,
  initial,
  onClose,
  onSave,
}: {
  src: string;
  initial: Region[];
  onClose: () => void;
  onSave: (regions: Region[]) => void;
}) {
  const [regions, setRegions] = useState<Region[]>(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [active, setActive] = useState<string | null>(initial[0]?.id ?? null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const point = (e: React.MouseEvent) => {
    const rect = box.current!.getBoundingClientRect();
    return { x: clamp((e.clientX - rect.left) / rect.width), y: clamp((e.clientY - rect.top) / rect.height) };
  };

  const onDown = (e: React.MouseEvent) => {
    if (regions.length >= MAX_REGIONS) return;
    start.current = point(e);
    setDraft({ ...start.current, width: 0, height: 0 });
  };
  const onMove = (e: React.MouseEvent) => {
    if (!start.current) return;
    const p = point(e);
    setDraft({
      x: Math.min(p.x, start.current.x),
      y: Math.min(p.y, start.current.y),
      width: Math.abs(p.x - start.current.x),
      height: Math.abs(p.y - start.current.y),
    });
  };
  const onUp = () => {
    if (draft && draft.width > 0.01 && draft.height > 0.01) {
      const region: Region = { id: `r-${Date.now()}`, ...draft, name: "" };
      setRegions((prev) => [...prev, region]);
      setActive(region.id);
    }
    start.current = null;
    setDraft(null);
  };

  const rename = (id: string, name: string) => setRegions((prev) => prev.map((r) => (r.id === id ? { ...r, name } : r)));
  const remove = (id: string) => setRegions((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-slate-950/90 backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-3 text-white">
        <div className="flex items-center gap-2">
          <MousePointerSquareDashed className="h-5 w-5 text-red-400" />
          <h3 className="text-sm font-extrabold">Khoanh vùng đối tượng cần tách</h3>
          <span className="text-xs font-light text-slate-400">Kéo chuột trên ảnh để vẽ khung đỏ (tối đa {MAX_REGIONS} vùng)</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm text-white" onClick={onClose}>
            <X className="h-4 w-4" /> Đóng
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => onSave(regions)}>
            <Check className="h-4 w-4" /> Xong ({regions.length} vùng)
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 items-center justify-center p-6">
          <div
            ref={box}
            className="relative max-h-full max-w-full cursor-crosshair select-none"
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={onUp}
          >
            <img src={src} alt="" className="block max-h-[calc(100vh-140px)] max-w-full" draggable={false} />
            {[...regions, ...(draft ? [{ id: "draft", name: "", ...draft }] : [])].map((r, i) => (
              <div
                key={r.id}
                onMouseDown={(e) => {
                  if (r.id === "draft") return;
                  e.stopPropagation();
                  setActive(r.id);
                }}
                className={cn(
                  "absolute border-[3px] border-red-500",
                  r.id === active && "shadow-[0_0_0_3px_rgba(239,68,68,0.35)]",
                )}
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.width * 100}%`, height: `${r.height * 100}%` }}
              >
                {r.id !== "draft" && (
                  <span className="absolute -top-6 left-[-3px] whitespace-nowrap rounded-t bg-red-500 px-1.5 py-0.5 text-[11px] font-black text-white">
                    VÙNG {i + 1}
                    {r.name.trim() ? ` · ${r.name.trim()}` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <aside className="flex w-80 shrink-0 flex-col border-l border-white/10 bg-slate-900 text-white">
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {regions.length === 0 && (
              <p className="p-4 text-center text-xs text-slate-400">Chưa có vùng nào. Kéo chuột trên ảnh để khoanh đối tượng.</p>
            )}
            {regions.map((r, i) => (
              <div
                key={r.id}
                onClick={() => setActive(r.id)}
                className={cn(
                  "rounded-xl border p-2.5 transition-colors",
                  r.id === active ? "border-red-500 bg-red-500/10" : "border-slate-700 bg-slate-950/50",
                )}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="rounded bg-red-500/20 px-1.5 py-0.5 text-[11px] font-black text-red-400">VÙNG {i + 1}</span>
                  <span className="text-[10px] text-slate-500">
                    {Math.round(r.width * 100)}% × {Math.round(r.height * 100)}%
                  </span>
                  <button className="rounded-lg p-1 text-slate-400 hover:bg-red-500/20 hover:text-red-400" onClick={() => remove(r.id)} title="Xóa vùng này">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <label className="mb-1 block text-[10px] font-bold text-slate-400">Tên / Mô tả đối tượng:</label>
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-red-500 focus:outline-none"
                  placeholder={`VD: Người mẫu áo trắng, chai nước...`}
                  value={r.name}
                  onChange={(e) => rename(r.id, e.target.value)}
                />
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 p-3">
            <p className="flex items-start gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 p-2.5 text-[11px] text-blue-300">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <b>Mẹo:</b> Đặt tên cụ thể (màu sắc, loại đồ vật) giúp AI bóc tách chính xác hơn. AI sẽ trả về từng vùng thành PNG
                không nền và 1 ảnh gốc đã xóa sạch các vùng.
              </span>
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
