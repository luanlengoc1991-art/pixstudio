import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Cpu, House, MemoryStick, MessageCircle, Monitor, Moon, Plus, Search, Sun, X } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { cn } from "@/lib/utils";
import { getTool, TOOLS } from "@/lib/tools";
import { TOOL_ACCENT, toolImage } from "@/lib/tool-style";
import { activeTabAtom, closeToolAtom, openToolAtom, openToolsAtom } from "@/atoms/workspace-atom";
import { chatGptActivatedAtom, chatGptConnectionAtom, chatGptQueueAtom } from "@/atoms/chatgpt-atom";
import UpscaylSVGLogo from "@/components/icons/upscayl-logo-svg";
import Icon3D from "@/components/ui/icon-3d";

const THEME_KEY = "theme";
const LIGHT = "pixstudio";
const DARK = "pixstudio-dark";

/** Applies the saved theme (dark studio by default) and toggles light/dark. */
function ThemeToggle() {
  const [theme, setTheme] = useState(DARK);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {}
    const initial = saved === LIGHT ? LIGHT : DARK;
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
      {theme === DARK ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
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

/** One gauge in the header: icon box, label, value and a usage bar. */
function StatPill({ icon: Icon, label, value, percent }: { icon: React.ElementType; label: string; value: string; percent: number | null }) {
  const bar =
    percent === null
      ? "bg-base-content/20"
      : percent > 85
        ? "bg-gradient-to-r from-rose-400 to-red-500"
        : percent > 60
          ? "bg-gradient-to-r from-amber-300 to-orange-500"
          : "bg-gradient-to-r from-sky-400 to-blue-500";
  return (
    <div className="glass flex h-12 min-w-[170px] shrink-0 items-center gap-3 rounded-2xl px-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 text-xs leading-none">
          <span className="font-black uppercase tracking-wide">{label}</span>
          <span className="ml-auto whitespace-nowrap font-semibold tabular-nums text-base-content/80">{value}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-base-content/10">
          <div className={cn("h-full rounded-full transition-all duration-700", bar)} style={{ width: `${percent ?? 0}%` }} />
        </div>
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
    <div className="hidden items-center gap-2.5 lg:flex">
      {stats.vramUsedGb !== null && (
        <StatPill
          icon={Monitor}
          label="VRAM"
          value={stats.vramTotalGb ? `${stats.vramUsedGb} / ${stats.vramTotalGb} GB` : `${stats.vramUsedGb} GB`}
          percent={vramPercent}
        />
      )}
      <StatPill icon={MemoryStick} label="RAM" value={`${stats.ramUsedGb} / ${stats.ramTotalGb} GB`} percent={(100 * stats.ramUsedGb) / stats.ramTotalGb} />
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
        "flex h-12 shrink-0 items-center gap-2.5 rounded-2xl border px-4 text-sm font-bold transition-all",
        connected
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-500 shadow-[0_0_24px_-6px_rgba(16,185,129,0.6)] hover:bg-emerald-500/20 dark:text-emerald-300"
          : "border-amber-400/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-300",
        activeTab === "chatgpt" && "ring-2 ring-emerald-400/50",
      )}
      data-tooltip-id="tooltip"
      data-tooltip-content={connected ? "Mở tab ChatGPT" : "Mở ChatGPT để đăng nhập (dùng cho các công cụ AI)"}
    >
      <span className="relative flex h-2.5 w-2.5">
        {(busy || !connected) && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", connected ? "bg-emerald-400" : "bg-amber-400")} />
        )}
        <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", connected ? "bg-emerald-400" : "bg-amber-400")} />
      </span>
      <MessageCircle className="h-5 w-5" />
      {connected ? (busy ? "GPT đang xử lý" : "GPT đã kết nối") : "Kết nối GPT"}
    </button>
  );
}

/** "Tìm công cụ nhanh" box with Ctrl+K; Enter opens the first match. */
function ToolSearch() {
  const openTool = useSetAtom(openToolAtom);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    return TOOLS.filter((t) => !q || normalize(`${t.title} ${t.description}`).includes(q));
  }, [query]);

  const choose = (id: (typeof TOOLS)[number]["id"]) => {
    openTool(id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative w-72 shrink-0">
      <div className="glass flex h-10 items-center gap-2 rounded-xl px-3">
        <Search className="h-4 w-4 text-base-content/60" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) choose(matches[0].id);
            if (e.key === "Escape") inputRef.current?.blur();
          }}
          placeholder="Tìm công cụ nhanh..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-base-content/50"
        />
        <kbd className="rounded-md border border-base-content/20 px-1.5 py-0.5 text-[10px] font-semibold text-base-content/60">Ctrl K</kbd>
      </div>
      {open && (
        <div className="glass absolute right-0 top-12 z-[100] max-h-96 w-80 overflow-y-auto rounded-2xl p-1.5 shadow-2xl">
          {matches.length === 0 && <p className="p-3 text-xs text-base-content/60">Không tìm thấy công cụ.</p>}
          {matches.map((t) => (
            <button
              key={t.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(t.id)}
              className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-base-content/10"
            >
              <Icon3D icon={t.icon} image={toolImage(t.id)} colors={TOOL_ACCENT[t.id]} size="sm" tilt={false} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{t.title}</span>
                <span className="block truncate text-[11px] font-light text-base-content/60">{t.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ version }: { version: string }) {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom);
  const openTools = useAtomValue(openToolsAtom);
  const closeTool = useSetAtom(closeToolAtom);

  return (
    <header className="relative z-30 shrink-0 border-b border-base-content/10 bg-base-100/40 backdrop-blur-xl">
      {/* Brand and machine status */}
      <div className="flex h-[68px] items-center gap-4 px-5">
        <div className="flex shrink-0 items-center gap-3">
          <span className="relative">
            <span className="absolute inset-0 rounded-2xl bg-fuchsia-500/60 blur-lg" />
            <UpscaylSVGLogo className="relative h-11 w-11 drop-shadow-lg" />
          </span>
          <div className="leading-none">
            <p className="flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight">LMS</span>
              <span className="text-[11px] font-bold tracking-[0.2em] text-base-content/70">LUAN MKT STUDIO</span>
            </p>
            <p className="mt-1 text-[11px] font-light text-base-content/60">Bộ công cụ AI xử lý ảnh · Sáng tạo không giới hạn</p>
          </div>
        </div>
        <div className="ml-4 flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden">
          <SystemStats />
        </div>
        {version && <span className="hidden text-[10px] text-base-content/40 xl:inline">v{version}</span>}
        <ThemeToggle />
        <ChatGptStatus />
      </div>

      {/* Workspace tabs */}
      <div className="flex h-14 items-center gap-3 px-5 pb-2">
        <nav className="glass flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-2xl p-1" aria-label="Workspace tabs">
          <button
            onClick={() => setActiveTab("home")}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold transition-all",
              activeTab === "home"
                ? "bg-gradient-to-r from-sky-500/30 to-blue-600/30 text-sky-400 ring-1 ring-sky-400/60 shadow-[0_0_18px_-4px_rgba(56,189,248,0.7)]"
                : "text-base-content/75 hover:bg-base-content/10",
            )}
          >
            <House className="h-4 w-4" /> Trang chủ
          </button>
          {openTools.map((id) => {
            const tool = getTool(id);
            const Icon = tool.icon;
            const active = activeTab === id;
            const [, main] = TOOL_ACCENT[id];
            return (
              <div
                key={id}
                className={cn(
                  "group flex h-9 shrink-0 items-center rounded-xl pl-4 pr-1.5 text-sm font-semibold transition-all",
                  active ? "bg-base-content/10 text-base-content" : "text-base-content/75 hover:bg-base-content/10",
                )}
                style={active ? { boxShadow: `inset 0 0 0 1px ${main}aa, 0 0 18px -6px ${main}` } : undefined}
              >
                <button className="flex items-center gap-2" onClick={() => setActiveTab(id)}>
                  <Icon className="h-4 w-4" style={{ color: main }} /> {tool.title}
                </button>
                <button
                  className="ml-1.5 rounded-md p-0.5 opacity-50 hover:bg-base-content/15 hover:opacity-100"
                  onClick={() => closeTool(id)}
                  aria-label={`Đóng ${tool.title}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
          <button
            className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-base-content/15 text-base-content/60 hover:border-primary hover:text-primary"
            onClick={() => setActiveTab("home")}
            data-tooltip-id="tooltip"
            data-tooltip-content="Mở thêm công cụ"
          >
            <Plus className="h-4 w-4" />
          </button>
        </nav>
        <ToolSearch />
      </div>
    </header>
  );
}
