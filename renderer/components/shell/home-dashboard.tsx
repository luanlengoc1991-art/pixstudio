import React, { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { ArrowRight, Cpu, Globe, Monitor, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { isAvailable, ToolInfo, TOOLS } from "@/lib/tools";
import { DOWNLOAD_APP_URL, IS_WEB } from "@/lib/platform";
import { TOOL_ACCENT, toolImage } from "@/lib/tool-style";
import { openToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

const pad = (n: number) => String(n).padStart(2, "0");
const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

/**
 * Current time, refreshed every second. Starts as null so the prerendered HTML
 * (built at another time) matches the first client render.
 */
const useNow = () => {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
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

/** Live clock: HH:MM bold, seconds extra-light, weekday and date underneath. */
function LiveClock() {
  const now = useNow();
  if (!now) return <div className="h-12" />;
  return (
    <div className="text-right">
      <div className="font-display leading-none text-white">
        <span className="text-[30px] font-bold tabular-nums">
          {pad(now.getHours())}:{pad(now.getMinutes())}
        </span>
        <span className="ml-0.5 text-lg font-extralight tabular-nums text-cyan-300">:{pad(now.getSeconds())}</span>
      </div>
      <div className="mt-1 flex items-center justify-end gap-2">
        <span className="font-display text-xs font-extralight text-white/80">{WEEKDAYS[now.getDay()]}</span>
        <span className="font-display bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white shadow-[0_0_16px_rgba(37,99,235,0.6)]">
          Hôm nay · {pad(now.getDate())}.{pad(now.getMonth() + 1)}.{now.getFullYear()}
        </span>
      </div>
    </div>
  );
}

function EngineTag({ tool }: { tool: ToolInfo }) {
  const chatgpt = tool.engine === "chatgpt";
  if (IS_WEB) {
    return (
      <span
        className={cn(
          "font-display inline-flex items-center gap-1 px-2 py-px text-[11px] font-semibold",
          chatgpt ? "bg-white/10 text-white/70" : "bg-blue-600 text-white",
        )}
      >
        {chatgpt ? <Monitor className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
        {chatgpt ? "Có trong app máy tính" : "Chạy trên trình duyệt"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-1 px-2 py-px text-[11px] font-semibold",
        chatgpt ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-600 text-white",
      )}
    >
      {chatgpt ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
      {chatgpt ? "ChatGPT" : "Trên máy"}
    </span>
  );
}

/** One tool as a broadcast-style row: number box, logo, bold name, extra-light description, tag and open button. */
function ToolRow({ tool, index, onOpen }: { tool: ToolInfo; index: number; onOpen: () => void }) {
  const [light, main] = TOOL_ACCENT[tool.id];
  return (
    <button
      onClick={onOpen}
      className="panel-cut-sm group relative flex w-full items-stretch overflow-hidden bg-gradient-to-r from-[#26315f] via-[#1d2650] to-[#161d44] text-left shadow-[0_14px_30px_-18px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-inset ring-white/10 transition-all duration-200 hover:from-[#2e3b72] hover:via-[#232e5e] hover:to-[#1b2350] hover:ring-white/25"
    >
      {/* Overlay number behind the row */}
      <span className="font-display pointer-events-none absolute -bottom-6 right-28 select-none text-[110px] font-bold leading-none text-white/[0.05] mix-blend-overlay">
        {pad(index + 1)}
      </span>
      <span className="absolute inset-y-3 left-0 w-1" style={{ background: main, boxShadow: `0 0 12px ${main}` }} />
      <div className="flex w-[84px] shrink-0 flex-col items-center justify-center border-r border-white/15 py-6">
        <span className="font-display text-[30px] font-bold leading-none text-white">{pad(index + 1)}</span>
        <span className="mt-1.5 font-display text-[11px] font-extralight text-white/75">Công cụ</span>
      </div>
      <div className="relative flex min-h-[150px] min-w-0 flex-1 items-center gap-5 px-6 py-6">
        <img
          src={toolImage(tool.id)}
          alt=""
          draggable={false}
          className="h-20 w-20 shrink-0 object-contain transition-transform duration-300 group-hover:scale-110"
          style={{ filter: `drop-shadow(0 6px 10px ${main}66)` }}
        />
        <div className="min-w-0">
          <h3 className="font-display truncate text-[21px] font-bold leading-snug text-white" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
            {tool.title}
          </h3>
          <p className="font-display mt-1 line-clamp-2 text-[13.5px] font-extralight leading-6 text-white/90">{tool.description}</p>
          <div className="mt-2.5">
            <EngineTag tool={tool} />
          </div>
        </div>
      </div>
      <div className="relative flex shrink-0 items-center pr-6">
        <span
          className="font-display flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white transition-all group-hover:gap-2.5"
          style={{ background: `linear-gradient(135deg, ${light}, ${main})`, boxShadow: `0 6px 16px -8px ${main}`, textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
        >
          Mở <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

export default function HomeDashboard() {
  const openTool = useSetAtom(openToolAtom);
  const { toast } = useToast();
  const local = TOOLS.filter((t) => t.status === "ready" && t.engine === "local");
  const viaChatGpt = TOOLS.filter((t) => t.status === "ready" && t.engine === "chatgpt");
  const open = (tool: ToolInfo) =>
    tool.status === "soon"
      ? toast({ title: `${tool.title} · sắp ra mắt`, description: "Công cụ này sẽ có trong bản cập nhật tiếp theo." })
      : !isAvailable(tool)
        ? toast({
            title: `${tool.title} · dùng trong app máy tính`,
            description: "Công cụ này chạy qua cửa sổ ChatGPT nhúng trong app LMS, trình duyệt không làm được. Tải app LMS miễn phí cho Windows hoặc Mac.",
            action: (
              <ToastAction altText="Tải app LMS" onClick={() => window.open(DOWNLOAD_APP_URL, "_blank")}>
                Tải app
              </ToastAction>
            ),
          })
        : openTool(tool.id);

  const section = (title: string, tools: ToolInfo[], offset: number, aside?: React.ReactNode) => (
    <div>
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="h-5 w-1 bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
          <h2 className="font-display text-lg font-bold text-white">{title}</h2>
          <span className="font-display text-sm font-extralight text-sky-200">{tools.length} công cụ</span>
        </div>
        {aside}
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2 min-[2200px]:grid-cols-3">
        {tools.map((tool, i) => (
          <ToolRow key={tool.id} tool={tool} index={offset + i} onOpen={() => open(tool)} />
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative h-full overflow-hidden bg-[#050a24]">
      <Backdrop />
      <div className="relative h-full overflow-y-auto pb-14">
        {/* Rows fill the width; the clock sits on the first section line, aligned with the rows' right edge */}
        <div className="mx-auto flex w-full max-w-[1760px] min-[2200px]:max-w-[2400px] flex-col gap-9 px-10 pt-7 xl:px-16">
          {IS_WEB ? (
            <>
              {section("Chạy ngay trên trình duyệt", local, 0, <LiveClock />)}
              {section("AI qua ChatGPT · trong app máy tính", viaChatGpt, local.length)}
            </>
          ) : (
            <>
              {section("AI qua ChatGPT", viaChatGpt, 0, <LiveClock />)}
              {local.length > 0 && section("Chạy trên máy", local, viaChatGpt.length)}
            </>
          )}
        </div>
      </div>

      {/* Ticker */}
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-blue-400/40 bg-blue-700/90 py-1.5">
        <div className="animate-ticker flex w-max gap-14 whitespace-nowrap">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className={cn("font-display text-xs", i % 2 ? "font-extralight text-cyan-200" : "font-bold text-white")}>
              LMS · LUAN MKT STUDIO · Sáng tạo không giới hạn
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
