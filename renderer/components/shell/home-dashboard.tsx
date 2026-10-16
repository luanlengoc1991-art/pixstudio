import React from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowRight, Cpu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ToolInfo, TOOLS } from "@/lib/tools";
import { TOOL_ACCENT, toolImage } from "@/lib/tool-style";
import { openToolAtom } from "@/atoms/workspace-atom";
import { chatGptConnectionAtom } from "@/atoms/chatgpt-atom";
import { useToast } from "@/components/ui/use-toast";

const pad = (n: number) => String(n).padStart(2, "0");

/** Deep blue stage: gradient, glowing horizon, perspective floor grid, light streaks and a giant faded mark. */
function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_115%,#2a4dff_0%,#1530b8_22%,#0a1450_48%,#050a24_75%)]" />
      {/* Giant faded mark */}
      <span className="font-display absolute -left-10 top-1/4 select-none text-[34rem] font-bold leading-none text-white/[0.035]">AI</span>
      {/* Light streaks */}
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
      {/* Horizon glow */}
      <div className="absolute inset-x-0 top-[66%] h-px bg-gradient-to-r from-transparent via-sky-200/80 to-transparent shadow-[0_0_40px_8px_rgba(96,165,250,0.45)]" />
      {/* Perspective floor grid */}
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
      {/* Curved floor lines */}
      <svg className="absolute inset-x-0 bottom-0 h-1/3 w-full" viewBox="0 0 1600 300" preserveAspectRatio="none">
        <path d="M0,120 Q800,20 1600,120" fill="none" stroke="rgba(191,219,254,0.35)" strokeWidth="1.5" />
        <path d="M0,240 Q800,150 1600,240" fill="none" stroke="rgba(191,219,254,0.25)" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

function EngineTag({ tool }: { tool: ToolInfo }) {
  const chatgpt = tool.engine === "chatgpt";
  return (
    <span
      className={cn(
        "font-display inline-flex items-center gap-1 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        chatgpt ? "bg-emerald-500/20 text-emerald-300" : "bg-blue-600 text-white",
      )}
    >
      {chatgpt ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
      {chatgpt ? "ChatGPT" : "Trên máy"}
    </span>
  );
}

/** One tool as a broadcast "match" row: number box, logo, big name, tag and an open button. */
function ToolRow({ tool, index, onOpen }: { tool: ToolInfo; index: number; onOpen: () => void }) {
  const [light, main] = TOOL_ACCENT[tool.id];
  return (
    <button
      onClick={onOpen}
      className="panel-cut group relative flex w-full items-stretch overflow-hidden bg-gradient-to-r from-[#1b2346]/95 via-[#151c3a]/95 to-[#11173a]/95 text-left shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)] transition-all duration-200 hover:from-[#222c58] hover:via-[#1a2247] hover:to-[#141b44]"
    >
      {/* Accent bar */}
      <span className="absolute inset-y-4 left-0 w-1" style={{ background: main, boxShadow: `0 0 14px ${main}` }} />
      {/* Number box */}
      <div className="flex w-24 shrink-0 flex-col items-center justify-center border-r border-white/10 py-4">
        <span className="font-display text-[44px] font-bold leading-none text-white">{pad(index + 1)}</span>
        <span className="mt-2 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">Công cụ</span>
      </div>
      {/* Logo + name */}
      <div className="flex min-w-0 flex-1 items-center gap-4 px-5 py-4">
        <img
          src={toolImage(tool.id)}
          alt=""
          draggable={false}
          className="h-20 w-20 shrink-0 object-contain transition-transform duration-300 group-hover:scale-110"
          style={{ filter: `drop-shadow(0 8px 14px ${main}66)` }}
        />
        <div className="min-w-0">
          {/* Room above the caps so Vietnamese marks (Ấ, Ổ...) are not clipped by truncate */}
          <h3 className="font-display truncate pt-1 text-[30px] font-bold uppercase leading-[1.3] tracking-wide text-white">{tool.title}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] font-light leading-5 text-white/70">{tool.description}</p>
          <div className="mt-2.5">
            <EngineTag tool={tool} />
          </div>
        </div>
      </div>
      {/* Open */}
      <div className="flex shrink-0 items-center pr-6">
        <span
          className="font-display flex items-center gap-2 px-4 py-2 text-sm font-semibold uppercase tracking-wider text-white transition-all group-hover:gap-3"
          style={{ background: `linear-gradient(135deg, ${light}, ${main})`, boxShadow: `0 8px 20px -8px ${main}` }}
        >
          Mở <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </button>
  );
}

function SidePanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel-cut bg-gradient-to-b from-[#1b2346]/95 to-[#11173a]/95 shadow-[0_18px_40px_-20px_rgba(0,0,0,0.8)]">
      <h3 className="font-display flex items-center gap-2 border-b border-white/10 px-5 py-3 text-xl font-bold uppercase tracking-wide text-white">
        <span className="h-5 w-1 bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
        {title}
      </h3>
      <div className="divide-y divide-white/10 px-3 pb-2">{children}</div>
    </section>
  );
}

export default function HomeDashboard() {
  const openTool = useSetAtom(openToolAtom);
  const connection = useAtomValue(chatGptConnectionAtom);
  const { toast } = useToast();
  const local = TOOLS.filter((t) => t.status === "ready" && t.engine === "local");
  const viaChatGpt = TOOLS.filter((t) => t.status === "ready" && t.engine === "chatgpt");
  const now = new Date();
  const today = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}`;
  const open = (tool: ToolInfo) =>
    tool.status === "soon"
      ? toast({ title: `${tool.title} · sắp ra mắt`, description: "Công cụ này sẽ có trong bản cập nhật tiếp theo." })
      : openTool(tool.id);

  const section = (label: string, tools: ToolInfo[], offset: number) => (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <span className="h-6 w-1 bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
        <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">{label}</h2>
        <span className="font-display text-sm font-semibold uppercase tracking-widest text-sky-300">{tools.length} công cụ</span>
      </div>
      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
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
        <div className="mx-auto max-w-[1760px] px-10 pt-8">
          {/* Masthead */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-4">
              <span className="font-display text-4xl font-bold uppercase tracking-tight text-white">Luan_MKT_Studio</span>
              <span className="h-10 w-px bg-white/30" />
              <div className="font-display text-xs font-semibold uppercase leading-5 tracking-[0.25em] text-white/80">
                <p>Bộ công cụ AI xử lý ảnh</p>
                <p className="text-white/55">Sáng tạo không giới hạn</p>
              </div>
            </div>
            <span className="font-display bg-blue-600 px-4 py-1 text-sm font-bold uppercase tracking-widest text-white shadow-[0_0_20px_rgba(37,99,235,0.6)]">
              Hôm nay · {today}
            </span>
          </div>

          <h1 className="font-display mt-4 text-[92px] font-bold uppercase leading-[0.95] tracking-tight text-white">
            Bộ công cụ <span className="text-cyan-300 drop-shadow-[0_0_30px_rgba(103,232,249,0.45)]">AI</span>
          </h1>
          <p className="font-display mt-3 text-base font-semibold uppercase tracking-[0.18em] text-white/85">
            {TOOLS.length} công cụ <span className="mx-2 text-sky-400">/</span> {local.length} chạy trên máy{" "}
            <span className="mx-2 text-sky-400">/</span> {viaChatGpt.length} qua ChatGPT <span className="mx-2 text-sky-400">/</span> mở nhiều
            tab cùng lúc
          </p>

          <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex flex-col gap-8">
              {section("AI qua ChatGPT", viaChatGpt, 0)}
              {section("Chạy trên máy", local, viaChatGpt.length)}
            </div>

            <aside className="flex flex-col gap-5">
              <SidePanel title="Trạng thái">
                {[
                  ["Kết nối ChatGPT", connection === "connected" ? "Đã kết nối" : "Chưa kết nối", connection === "connected"],
                  ["Công cụ sẵn sàng", `${TOOLS.filter((t) => t.status === "ready").length} / ${TOOLS.length}`, true],
                  ["Chạy trên máy", `${local.length} công cụ`, true],
                  ["Qua ChatGPT", `${viaChatGpt.length} công cụ`, connection === "connected"],
                ].map(([label, value, ok]) => (
                  <div key={label as string} className="flex items-center justify-between px-2 py-3">
                    <span className="font-display text-sm font-semibold uppercase tracking-wide text-white/80">{label}</span>
                    <span className={cn("font-display text-base font-bold", ok ? "text-cyan-300" : "text-amber-300")}>{value}</span>
                  </div>
                ))}
              </SidePanel>

              <SidePanel title="Danh sách công cụ">
                {[...viaChatGpt, ...local].map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => open(tool)}
                    className="flex w-full items-center gap-3 px-2 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <img src={toolImage(tool.id)} alt="" className="h-8 w-8 object-contain" draggable={false} />
                    <span className="font-display min-w-0 flex-1 truncate text-[15px] font-semibold uppercase text-white">{tool.title}</span>
                    <span
                      className={cn(
                        "font-display text-[11px] font-semibold uppercase tracking-wider",
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
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-blue-400/40 bg-blue-700/90 py-2">
        <div className="animate-ticker flex w-max gap-16 whitespace-nowrap">
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              className={cn("font-display text-sm font-bold uppercase tracking-[0.2em]", i % 2 ? "text-cyan-200" : "text-white")}
            >
              Luan_MKT_Studio · Sáng tạo không giới hạn
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
