import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Loader2 } from "lucide-react";
import { DesignAppTarget } from "@common/types/types";
import { cn } from "@/lib/utils";
import { IS_WEB } from "@/lib/platform";

export interface DesignAppOption {
  target: DesignAppTarget;
  label: string;
  hint: string;
}

const DEFAULT_APPS: DesignAppOption[] = [
  { target: "photoshop", label: "Adobe Photoshop", hint: "Xuất PSD giữ từng layer & tự mở Photoshop" },
  { target: "corel", label: "CorelDRAW", hint: "Đẩy thẳng đa layer / PDF vào CorelDRAW" },
  { target: "illustrator", label: "Adobe Illustrator", hint: "Xuất PDF / SVG & tự mở Illustrator" },
];

export function OpenInDesignMenu({
  onSelect,
  apps = DEFAULT_APPS,
  disabled,
  busyTarget,
  size = "sm",
  label = "Mở bằng app",
}: {
  onSelect: (target: DesignAppTarget) => void | Promise<void>;
  apps?: DesignAppOption[];
  disabled?: boolean;
  busyTarget?: DesignAppTarget | null;
  size?: "xs" | "sm";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (IS_WEB) return null;

  const activeText =
    busyTarget === "photoshop"
      ? "Đang mở Photoshop..."
      : busyTarget === "corel"
        ? "Đang mở CorelDRAW..."
        : busyTarget === "illustrator"
          ? "Đang mở Illustrator..."
          : label;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled || !!busyTarget}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "btn border-emerald-500/40 bg-emerald-600 text-white hover:border-emerald-500 hover:bg-emerald-700",
          size === "xs" ? "btn-xs" : "btn-sm",
        )}
      >
        {busyTarget ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
        <span>{activeText}</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Chọn phần mềm thiết kế"
          className="absolute right-0 top-full z-50 mt-1.5 w-64 overflow-hidden rounded-2xl border border-base-content/15 bg-base-100 p-1.5 shadow-2xl"
        >
          {apps.map((item) => (
            <button
              key={item.target}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void onSelect(item.target);
              }}
              className="flex w-full flex-col rounded-xl px-3 py-2 text-left transition-colors hover:bg-base-200"
            >
              <span className="text-xs font-extrabold text-base-content">{item.label}</span>
              <span className="text-[11px] font-light text-base-content/65">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
