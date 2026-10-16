import React, { useEffect, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Cpu, House, MemoryStick, MessageCircle, Moon, Plus, Sun, X } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { cn } from "@/lib/utils";
import { getTool } from "@/lib/tools";
import { activeTabAtom, closeToolAtom, openToolsAtom } from "@/atoms/workspace-atom";
import { chatGptActivatedAtom, chatGptConnectionAtom, chatGptQueueAtom } from "@/atoms/chatgpt-atom";
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
      data-tooltip-content={theme === DARK ? "Chuyển giao diện sáng" : "Chuyển giao diện tối"}
    >
      {theme === DARK ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

type Stats = {
  ramUsedGb: number;
  ramTotalGb: number;
  gpuUsage: number | null;
  vramUsedGb: number | null;
  vramTotalGb: number | null;
  gpuTemperature: number | null;
};

/** One labelled gauge in the header: value text and a thin usage bar. */
function StatPill({ icon: Icon, label, value, percent }: { icon: React.ElementType; label: string; value: string; percent: number | null }) {
  const level = percent === null ? "bg-base-content/20" : percent > 85 ? "bg-error" : percent > 60 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex h-10 min-w-[118px] shrink-0 flex-col justify-center gap-1 rounded-xl border border-base-content/10 bg-base-200/70 px-3">
      <div className="flex items-center gap-1.5 text-[11px] leading-none">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="font-black uppercase tracking-wide">{label}</span>
        <span className="ml-auto font-semibold tabular-nums text-base-content/80">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-base-content/10">
        <div className={cn("h-full rounded-full transition-all duration-700", level)} style={{ width: `${percent ?? 0}%` }} />
      </div>
    </div>
  );
}

/** VRAM, RAM and GPU load, refreshed every few seconds. */
function SystemStats() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const next = await window.electron.invoke(ELECTRON_COMMANDS.GET_SYSTEM_STATS, undefined);
        if (alive) setStats(next);
      } catch {}
    };
    read();
    const timer = window.setInterval(read, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!stats) return null;
  const vramPercent = stats.vramUsedGb !== null && stats.vramTotalGb ? (100 * stats.vramUsedGb) / stats.vramTotalGb : null;
  const gpu = stats.gpuUsage;

  return (
    <div className="hidden items-center gap-2 lg:flex">
      {stats.vramUsedGb !== null && (
        <StatPill
          icon={MemoryStick}
          label="VRAM"
          value={stats.vramTotalGb ? `${stats.vramUsedGb} / ${stats.vramTotalGb} GB` : `${stats.vramUsedGb} GB`}
          percent={vramPercent}
        />
      )}
      <StatPill
        icon={MemoryStick}
        label="RAM"
        value={`${stats.ramUsedGb} / ${stats.ramTotalGb} GB`}
        percent={(100 * stats.ramUsedGb) / stats.ramTotalGb}
      />
      {gpu !== null && (
        <StatPill
          icon={Cpu}
          label="GPU"
          value={`${gpu > 5 ? "Đang xử lý" : "Rảnh"} ${gpu}%${stats.gpuTemperature ? ` · ${stats.gpuTemperature}°C` : ""}`}
          percent={gpu}
        />
      )}
    </div>
  );
}

/** ChatGPT status pill; opens the embedded ChatGPT tab. */
function ChatGptStatus() {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const setActivated = useSetAtom(chatGptActivatedAtom);
  const [connection, setConnection] = useAtom(chatGptConnectionAtom);
  const busy = useAtomValue(chatGptQueueAtom).length > 0;
  const connected = connection === "connected";

  // Before the ChatGPT tab is opened, a saved login cookie is enough to show "đã kết nối"
  useEffect(() => {
    if (connection !== "idle") return;
    window.electron
      .invoke(ELECTRON_COMMANDS.CHATGPT_SESSION_STATUS, undefined)
      .then((loggedIn: boolean) => loggedIn && setConnection((current) => (current === "idle" ? "connected" : current)))
      .catch(() => {});
  }, [connection]);

  return (
    <button
      onClick={() => {
        setActivated(true);
        setActiveTab("chatgpt");
      }}
      className={cn(
        "flex h-10 shrink-0 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition-all",
        connected
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300",
        activeTab === "chatgpt" && "ring-2 ring-emerald-500/40",
      )}
      data-tooltip-id="tooltip"
      data-tooltip-content={connected ? "Mở tab ChatGPT" : "Mở ChatGPT để đăng nhập (dùng cho các công cụ AI)"}
    >
      <span className="relative flex h-2.5 w-2.5">
        {(busy || !connected) && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", connected ? "bg-emerald-400" : "bg-amber-400")} />
        )}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
      </span>
      <MessageCircle className="h-4 w-4" />
      {connection === "idle" ? "Kết nối GPT" : connected ? (busy ? "GPT đang xử lý" : "GPT đã kết nối") : "GPT chưa kết nối"}
    </button>
  );
}

export default function TopBar({ version }: { version: string }) {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const openTools = useAtomValue(openToolsAtom);
  const closeTool = useSetAtom(closeToolAtom);

  return (
    <header className="shrink-0 border-b border-base-content/10 bg-base-100">
      {/* Brand and machine status */}
      <div className="flex h-14 items-center gap-3 px-4">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 shadow-md shadow-sky-500/30">
            <UpscaylSVGLogo className="h-6 w-6" />
          </span>
          <div className="leading-none">
            <p className="text-base font-black tracking-tight">Luan_MKT_Studio</p>
            <p className="mt-0.5 text-[10px] font-light text-base-content/60">Bộ công cụ AI xử lý ảnh · {version}</p>
          </div>
        </div>
        <ThemeToggle />
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <SystemStats />
        </div>
        <ChatGptStatus />
      </div>

      {/* Workspace tabs */}
      <nav className="flex h-10 items-end gap-1 overflow-x-auto px-3" aria-label="Workspace tabs">
        <button
          onClick={() => setActiveTab("home")}
          className={cn(
            "flex h-9 shrink-0 items-center gap-1.5 rounded-t-xl px-4 text-xs font-bold transition-colors",
            activeTab === "home" ? "bg-base-300 text-primary" : "text-base-content/70 hover:bg-base-200",
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
                "group flex h-9 shrink-0 items-center rounded-t-xl pl-4 pr-1.5 text-xs font-bold transition-colors",
                active ? "bg-base-300 text-primary" : "text-base-content/70 hover:bg-base-200",
              )}
            >
              <button className="flex items-center gap-1.5" onClick={() => setActiveTab(id)}>
                <Icon className="h-4 w-4" /> {tool.title}
              </button>
              <button
                className="ml-1.5 rounded p-0.5 opacity-50 hover:bg-base-content/10 hover:opacity-100"
                onClick={() => closeTool(id)}
                aria-label={`Đóng ${tool.title}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        <button
          className="mb-1 ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-base-content/15 text-base-content/60 hover:border-primary hover:text-primary"
          onClick={() => setActiveTab("home")}
          data-tooltip-id="tooltip"
          data-tooltip-content="Mở thêm công cụ"
        >
          <Plus className="h-4 w-4" />
        </button>
      </nav>
    </header>
  );
}
