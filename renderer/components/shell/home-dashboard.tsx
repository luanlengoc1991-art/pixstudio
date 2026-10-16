import React, { useEffect, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowRight, Cpu, Sparkles } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { cn } from "@/lib/utils";
import { ToolInfo, TOOLS } from "@/lib/tools";
import { TOOL_ACCENT, toolImage } from "@/lib/tool-style";
import { openToolAtom } from "@/atoms/workspace-atom";
import { chatGptConnectionAtom } from "@/atoms/chatgpt-atom";
import { useToast } from "@/components/ui/use-toast";

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

/** Current time, refreshed every second. */
const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
};

type Stats = { ramUsedGb: number; ramTotalGb: number; gpuUsage: number | null; vramUsedGb: number | null; vramTotalGb: number | null };

/** Machine load, refreshed every 3 seconds. */
const useStats = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    const read = () =>
      window.electron
        .invoke(ELECTRON_COMMANDS.GET_SYSTEM_STATS, undefined)
        .then((s: Stats) => alive && setStats(s))
        .catch(() => {});
    read();
    const timer = window.setInterval(read, 3000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  return stats;
};

/** Splits a title so the first half is heavy and the rest light, for contrast. */
const splitTitle = (title: string) => {
  const words = title.split(" ");
  const strong = Math.ceil(words.length / 2);
  return [words.slice(0, strong).join(" "), words.slice(strong).join(" ")];
};

/** Deep blue stage: gradient, glowing horizon, perspective floor grid, light streaks and a giant faded mark. */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_115%,#2a4dff_0%,#1530b8_22%,#0a1450_48%,#050a24_75%)]" />
      <span className="font-display absolute -left-10 top-1/4 select-none text-[30rem] font-bold leading-none text-white/[0.03]">AI</span>
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1600 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="streak" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7dd3fc" stopOpacity="0" />
            <stop offset="0.5" stopColor="#bae6fd" stopOpacity="0.55" />
            <stop offset="1" stopColor="#7dd3fc" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points="0,620 180,520 260,560 420,380 470,430 640,120 700,60" fill="none" stroke="url(#streak)" strokeWidth="2" />
        <polyline points="60,760 240,640 300,690 520,470" fill="none" stroke="url(#streak)" strokeWidth="1.5" />
        <polyline points="1000,0 1180,140 1240,110 1600,330" fill="none" stroke="url(#streak)" strokeWidth="1.2" />
      </svg>
      <div className="absolute inset-x-0 top-[66%] h-px bg-gradient-to-r from-transparent via-sky-200/80 to-transparent shadow-[0_0_40px_8px_rgba(96,165,250,0.45)]" />
      <div className="absolute inset-x-[-20%] bottom-[-10%] top-[66%] [perspective:600px]">
        <div
          className="h-full w-full origin-top [transform:rotateX(70deg)]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(147,197,253,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(147,197,253,0.18) 1px, transparent 1px)",
            backgroundSize: "70px 70px",
            maskImage: "linear-gradient(to bottom, black, transparent 85%)",
          }}
        />
      </div>
      <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full" viewBox="0 0 1600 300" preserveAspectRatio="none">
        <path d="M0,120 Q800,20 1600,120" fill="none" stroke="rgba(191,219,254,0.35)" strokeWidth="1.5" />
        <path d="M0,240 Q800,150 1600,240" fill="none" stroke="rgba(191,219,254,0.25)" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

/** Live clock: big HH:MM with light seconds, weekday and date underneath. */
function LiveClock() {
  const now = useNow();
  return (
    <div className="text-right">
      <div className="font-display leading-none text-white">
        <span className="text-5xl font-bold tabular-nums">
          {pad(now.getHours())}:{pad(now.getMinutes())}
        </span>
        <span className="ml-1 text-2xl font-extralight tabular-nums text-cyan-300">:{pad(now.getSeconds())}</span>
      </div>
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="font-display text-xs font-light uppercase tracking-[0.25em] text-white/70">{WEEKDAYS[now.getDay()]}</span>
        <span className="font-display bg-blue-600 px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest text-white shadow-[0_0_16px_rgba(37,99,235,0.6)]">
          Hôm nay · {pad(now.getDate())}.{pad(now.getMonth() + 1)}.{now.getFullYear()}
        </span>
      </div>
    </div>
  );
}

function EngineTag({ tool }: { tool: ToolInfo }) {
  const chatgpt = tool.engine === "chatgpt";
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-1 px-2 py-px text-[10px] font-semibold uppercase tracking-wider",
        chatgpt ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-600 text-white",
      )}
    >
      {chatgpt ? <Sparkles className="h-2.5 w-2.5" /> : <Cpu className="h-2.5 w-2.5" />}
      {chatgpt ? "ChatGPT" : "Trên máy"}
    </span>
  );
}

/** One tool as a broadcast "match" row: number box, logo, name with weight contrast, tag and an open button. */
function ToolRow({ tool, index, onOpen }: { tool: ToolInfo; index: number; onOpen: () => void }) {
  const [light, main] = TOOL_ACCENT[tool.id];
  const [strong, soft] = splitTitle(tool.title);
  return (
    <button
      onClick={onOpen}
      className="panel-cut-sm group relative flex w-full items-stretch overflow-hidden bg-gradient-to-r from-[#1b2346]/95 via-[#151c3a]/95 to-[#11173a]/95 text-left shadow-[0_14px_30px_-18px_rgba(0,0,0,0.8)] transition-all duration-200 hover:from-[#222c58] hover:via-[#1a2247] hover:to-[#141b44]"
    >
      {/* Overlay number behind the row */}
      <span className="font-display pointer-events-none absolute -bottom-6 right-24 select-none text-[110px] font-bold leading-none text-white/[0.05] mix-blend-overlay">
        {pad(index + 1)}
      </span>
      <span className="absolute inset-y-3 left-0 w-[3px]" style={{ background: main, boxShadow: `0 0 12px ${main}` }} />
      <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-white/10 py-3">
        <span className="font-display text-[28px] font-bold leading-none text-white">{pad(index + 1)}</span>
        <span className="mt-1 font-display text-[9px] font-light uppercase tracking-[0.2em] text-white/50">Công cụ</span>
      </div>
      <div className="relative flex min-w-0 flex-1 items-center gap-3 px-4 py-3">
        <img
          src={toolImage(tool.id)}
          alt=""
          draggable={false}
          className="h-14 w-14 shrink-0 object-contain transition-transform duration-300 group-hover:scale-110"
          style={{ filter: `drop-shadow(0 6px 10px ${main}66)` }}
        />
        <div className="min-w-0">
          {/* Room above the caps so Vietnamese marks (Ấ, Ổ...) are not clipped by truncate */}
          <h3 className="font-display truncate pt-0.5 text-[21px] uppercase leading-[1.3] tracking-wide text-white">
            <span className="font-bold">{strong}</span>
            {soft && <span className="font-extralight text-white/85"> {soft}</span>}
          </h3>
          <p className="line-clamp-1 text-[12px] font-light leading-5 text-white/65">{tool.description}</p>
          <div className="mt-1.5">
            <EngineTag tool={tool} />
          </div>
        </div>
      </div>
      <div className="relative flex shrink-0 items-center pr-4">
        <span
          className="font-display flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white transition-all group-hover:gap-2.5"
          style={{ background: `linear-gradient(135deg, ${light}, ${main})`, boxShadow: `0 6px 16px -8px ${main}` }}
        >
          Mở <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </button>
  );
}

function SidePanel({ title, live, children }: { title: string; live?: boolean; children: React.ReactNode }) {
  return (
    <section className="panel-cut-sm bg-gradient-to-b from-[#1b2346]/95 to-[#11173a]/95 shadow-[0_14px_30px_-18px_rgba(0,0,0,0.8)]">
      <h3 className="font-display flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-base font-bold uppercase tracking-wide text-white">
        <span className="h-4 w-[3px] bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
        {title}
        {live && (
          <span className="ml-auto flex items-center gap-1.5 text-[10px] font-semibold tracking-widest text-rose-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> Trực tiếp
          </span>
        )}
      </h3>
      <div className="divide-y divide-white/10 px-2.5 pb-1.5">{children}</div>
    </section>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between px-2 py-2">
      <span className="font-display text-[13px] font-light uppercase tracking-wide text-white/75">{label}</span>
      <span className={cn("font-display text-sm font-bold tabular-nums", ok === false ? "text-amber-300" : "text-cyan-300")}>{value}</span>
    </div>
  );
}

export default function HomeDashboard() {
  const openTool = useSetAtom(openToolAtom);
  const connection = useAtomValue(chatGptConnectionAtom);
  const stats = useStats();
  const { toast } = useToast();
  const local = TOOLS.filter((t) => t.status === "ready" && t.engine === "local");
  const viaChatGpt = TOOLS.filter((t) => t.status === "ready" && t.engine === "chatgpt");
  const open = (tool: ToolInfo) =>
    tool.status === "soon"
      ? toast({ title: `${tool.title} · sắp ra mắt`, description: "Công cụ này sẽ có trong bản cập nhật tiếp theo." })
      : openTool(tool.id);

  const section = (strong: string, soft: string, tools: ToolInfo[], offset: number) => (
    <div>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="h-5 w-[3px] bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
        <h2 className="font-display text-lg uppercase tracking-wide text-white">
          <span className="font-bold">{strong}</span> <span className="font-extralight">{soft}</span>
        </h2>
        <span className="font-display text-xs font-semibold uppercase tracking-widest text-sky-300">{tools.length} công cụ</span>
      </div>
      <div className="grid grid-cols-1 gap-2.5 2xl:grid-cols-2">
        {tools.map((tool, i) => (
          <ToolRow key={tool.id} tool={tool} index={offset + i} onOpen={() => open(tool)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative h-full overflow-hidden bg-[#050a24]">
      <Backdrop />
      <div className="relative h-full overflow-y-auto pb-12">
        <div className="mx-auto max-w-[1600px] px-8 pt-6">
          {/* Masthead with overlay text behind the title */}
          <div className="relative">
            <span
              className="font-display pointer-events-none absolute -top-6 left-0 select-none text-[150px] font-bold uppercase leading-none text-white/[0.07] mix-blend-overlay"
              style={{ WebkitTextStroke: "1.5px rgba(255,255,255,0.3)" }}
              aria-hidden
            >
              Studio
            </span>
            <div className="relative flex items-start justify-between gap-6">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-2xl uppercase tracking-tight text-white">
                    <span className="font-bold">Luan_MKT</span>
                    <span className="font-extralight">_Studio</span>
                  </span>
                  <span className="h-7 w-px bg-white/30" />
                  <div className="font-display text-[10px] font-semibold uppercase leading-4 tracking-[0.25em] text-white/80">
                    <p>Bộ công cụ AI xử lý ảnh</p>
                    <p className="font-light text-white/55">Sáng tạo không giới hạn</p>
                  </div>
                </div>
                <h1 className="font-display mt-2 text-[60px] uppercase leading-[1.05] tracking-tight text-white">
                  <span className="font-extralight">Bộ công cụ </span>
                  <span className="font-bold text-cyan-300 drop-shadow-[0_0_24px_rgba(103,232,249,0.45)]">AI</span>
                </h1>
                <p className="font-display mt-1.5 text-[13px] uppercase tracking-[0.18em] text-white/85">
                  <b className="font-bold">{TOOLS.length}</b> <span className="font-light">công cụ</span>
                  <span className="mx-2 text-sky-400">/</span>
                  <b className="font-bold">{local.length}</b> <span className="font-light">chạy trên máy</span>
                  <span className="mx-2 text-sky-400">/</span>
                  <b className="font-bold">{viaChatGpt.length}</b> <span className="font-light">qua ChatGPT</span>
                  <span className="mx-2 text-sky-400">/</span>
                  <span className="font-light">mở nhiều tab cùng lúc</span>
                </p>
              </div>
              <LiveClock />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex flex-col gap-6">
              {section("AI", "qua ChatGPT", viaChatGpt, 0)}
              {section("Chạy", "trên máy", local, viaChatGpt.length)}
            </div>

            <aside className="flex flex-col gap-4">
              <SidePanel title="Trạng thái" live>
                <StatusRow label="Kết nối ChatGPT" value={connection === "connected" ? "Đã kết nối" : "Chưa kết nối"} ok={connection === "connected"} />
                <StatusRow label="GPU" value={stats?.gpuUsage != null ? `${stats.gpuUsage}%` : "—"} />
                <StatusRow
                  label="VRAM"
                  value={stats?.vramUsedGb != null ? `${stats.vramUsedGb}${stats.vramTotalGb ? ` / ${stats.vramTotalGb}` : ""} GB` : "—"}
                />
                <StatusRow label="RAM" value={stats ? `${stats.ramUsedGb} / ${stats.ramTotalGb} GB` : "—"} />
                <StatusRow label="Công cụ sẵn sàng" value={`${TOOLS.filter((t) => t.status === "ready").length} / ${TOOLS.length}`} />
              </SidePanel>

              <SidePanel title="Danh sách công cụ">
                {[...viaChatGpt, ...local].map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => open(tool)}
                    className="flex w-full items-center gap-2.5 px-1.5 py-1.5 text-left transition-colors hover:bg-white/5"
                  >
                    <img src={toolImage(tool.id)} alt="" className="h-7 w-7 object-contain" draggable={false} />
                    <span className="font-display min-w-0 flex-1 truncate pt-0.5 text-[13px] font-semibold uppercase leading-[1.4] text-white">
                      {tool.title}
                    </span>
                    <span
                      className={cn(
                        "font-display text-[10px] font-light uppercase tracking-wider",
                        tool.engine === "chatgpt" ? "text-emerald-300" : "text-sky-300",
                      )}
                    >
                      {tool.engine === "chatgpt" ? "GPT" : "Máy"}
                    </span>
                  </button>
                ))}
              </SidePanel>
            </aside>
          </div>
        </div>
      </div>

      {/* Ticker */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-blue-400/40 bg-blue-700/90 py-1.5">
        <div className="animate-ticker flex w-max gap-14 whitespace-nowrap">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className={cn("font-display text-xs uppercase tracking-[0.2em]", i % 2 ? "font-light text-cyan-200" : "font-bold text-white")}>
              Luan_MKT_Studio · Sáng tạo không giới hạn
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
