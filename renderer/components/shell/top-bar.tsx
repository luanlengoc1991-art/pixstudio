import React, { useEffect, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { House, Moon, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTool } from "@/lib/tools";
import { activeTabAtom, closeToolAtom, openToolsAtom } from "@/atoms/workspace-atom";
import UpscaylSVGLogo from "@/components/icons/upscayl-logo-svg";

const THEME_KEY = "theme";
const LIGHT = "pixstudio";
const DARK = "pixstudio-dark";

/** Applies the saved theme (PixStudio light by default) and toggles light/dark. */
function ThemeToggle() {
  const [theme, setTheme] = useState(LIGHT);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {}
    const initial = saved || LIGHT;
    document.documentElement.setAttribute("data-theme", initial);
    setTheme(initial);
  }, []);

  const toggle = () => {
    const next = theme === DARK ? LIGHT : DARK;
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
    setTheme(next);
  };

  return (
    <button
      className="btn btn-ghost btn-sm btn-square"
      onClick={toggle}
      data-tooltip-id="tooltip"
      data-tooltip-content={theme === DARK ? "Giao diện sáng" : "Giao diện tối"}
    >
      {theme === DARK ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export default function TopBar({ version }: { version: string }) {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const openTools = useAtomValue(openToolsAtom);
  const closeTool = useSetAtom(closeToolAtom);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-base-content/10 bg-base-100 px-3">
      <div className="flex shrink-0 items-center gap-2 pr-2">
        <UpscaylSVGLogo className="h-7 w-7" />
        <span className="text-sm font-black tracking-tight">PixStudio</span>
        <span className="text-[10px] text-base-content/50">{version}</span>
      </div>

      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto" aria-label="Workspace tabs">
        <button
          onClick={() => setActiveTab("home")}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-colors",
            activeTab === "home" ? "bg-primary text-primary-content" : "hover:bg-base-200",
          )}
        >
          <House className="h-4 w-4" /> Trang chủ
        </button>
        {openTools.map((id) => {
          const tool = getTool(id);
          const Icon = tool.icon;
          const active = activeTab === id;
          return (
            <div
              key={id}
              className={cn(
                "group flex h-8 shrink-0 items-center rounded-lg pl-3 pr-1 text-xs font-bold transition-colors",
                active ? "bg-primary/15 text-primary ring-1 ring-primary/40" : "hover:bg-base-200",
              )}
            >
              <button className="flex items-center gap-1.5" onClick={() => setActiveTab(id)}>
                <Icon className="h-4 w-4" /> {tool.title}
              </button>
              <button
                className="ml-1 rounded p-0.5 opacity-50 hover:bg-base-300 hover:opacity-100"
                onClick={() => closeTool(id)}
                aria-label={`Đóng ${tool.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </nav>

      <ThemeToggle />
    </header>
  );
}
