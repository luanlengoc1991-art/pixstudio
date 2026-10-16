import React from "react";
import { useSetAtom } from "jotai";
import { ArrowRight, Cloud, Cpu, Image as ImageIcon, MousePointer2, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOLS } from "@/lib/tools";
import { STAT_IMAGES, TOOL_ACCENT, toolImage } from "@/lib/tool-style";
import { openToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import Icon3D from "@/components/ui/icon-3d";

/** Floating glass cards around a glowing "AI" cube, drawn with CSS only. */
function HeroArt() {
  return (
    <div className="pointer-events-none relative hidden h-56 w-[420px] shrink-0 lg:block" aria-hidden>
      <div className="absolute inset-0 rounded-full bg-primary/25 blur-3xl" />
      {/* Back cards */}
      <div className="animate-float-slow absolute left-4 top-10 h-28 w-40 rounded-2xl border border-white/20 bg-gradient-to-br from-sky-400/30 to-indigo-500/20 shadow-2xl backdrop-blur-md [transform:perspective(600px)_rotateY(28deg)_rotateX(8deg)]">
        <div className="m-3 h-3 w-16 rounded-full bg-white/40" />
        <div className="mx-3 h-2 w-24 rounded-full bg-white/25" />
        <div className="mx-3 mt-2 h-10 rounded-lg bg-white/15" />
      </div>
      <div className="animate-float absolute right-2 top-16 flex h-28 w-36 items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-br from-violet-400/30 to-sky-500/20 shadow-2xl backdrop-blur-md [transform:perspective(600px)_rotateY(-26deg)_rotateX(8deg)]">
        <ImageIcon className="h-12 w-12 text-white/70" />
      </div>
      {/* AI cube */}
      <div className="animate-float absolute left-1/2 top-2 -translate-x-1/2">
        <div className="relative h-40 w-40 [transform:perspective(700px)_rotateX(12deg)_rotateY(-16deg)]">
          <div className="absolute inset-0 translate-y-3 rounded-[2.2rem] bg-blue-900/80" />
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-[2.2rem] border border-white/40 bg-gradient-to-br from-sky-300/90 via-blue-500/80 to-violet-600/90 shadow-[0_20px_60px_-10px_rgba(59,130,246,0.9),inset_0_2px_0_rgba(255,255,255,0.6)]">
            <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/50 to-transparent" />
            <span className="relative bg-gradient-to-b from-white to-sky-100 bg-clip-text text-6xl font-black tracking-tighter text-transparent drop-shadow-[0_4px_8px_rgba(30,64,175,0.8)]">
              AI
            </span>
          </div>
        </div>
      </div>
      <MousePointer2 className="animate-float-slow absolute bottom-6 right-24 h-9 w-9 fill-white/90 text-sky-300 drop-shadow-[0_0_10px_rgba(56,189,248,0.9)]" />
      <Sparkles className="absolute left-36 top-0 h-6 w-6 text-sky-200/80" />
    </div>
  );
}

function StatRow({ icon, image, colors, value, title, text }: { icon: React.ElementType; image: string; colors: [string, string, string]; value: number; title: string; text: string }) {
  return (
    <div className="flex items-center gap-4 py-2.5">
      <Icon3D icon={icon} image={image} colors={colors} size="md" tilt={false} />
      <span className="w-10 text-3xl font-black tabular-nums">{value}</span>
      <div className="min-w-0">
        <p className="text-sm font-bold">{title}</p>
        <p className="text-[11px] font-light text-base-content/60">{text}</p>
      </div>
    </div>
  );
}

export default function HomeDashboard() {
  const openTool = useSetAtom(openToolAtom);
  const { toast } = useToast();
  const local = TOOLS.filter((t) => t.status === "ready" && t.engine === "local").length;
  const viaChatGpt = TOOLS.filter((t) => t.status === "ready" && t.engine === "chatgpt").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-[2300px] px-8 py-6">
        {/* Hero */}
        <section className="mb-6 flex flex-col gap-5 xl:flex-row">
          <div className="glass relative flex min-w-0 flex-1 items-center overflow-hidden rounded-3xl px-8 py-7">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
            <div className="relative min-w-0 flex-1">
              <h1 className="bg-gradient-to-r from-slate-900 via-sky-800 to-violet-700 bg-clip-text text-4xl font-black leading-tight tracking-tight text-transparent dark:from-white dark:via-sky-100 dark:to-violet-300">
                Bộ công cụ AI xử lý ảnh
              </h1>
              <p className="mt-3 max-w-xl text-sm font-light leading-6 text-base-content/75">
                <b className="font-bold text-base-content">{local} công cụ</b> chạy trực tiếp trên máy ·{" "}
                <b className="font-bold text-base-content">{viaChatGpt} công cụ AI</b> chạy qua tài khoản ChatGPT của bạn. Có thể
                mở nhiều công cụ cùng lúc dưới dạng tab.
              </p>
            </div>
            <HeroArt />
          </div>

          <div className="glass flex flex-col justify-center divide-y divide-base-content/10 rounded-3xl px-6 py-3 xl:w-[400px]">
            <StatRow icon={Sparkles} image={STAT_IMAGES.tools} colors={["#c4b5fd", "#8b5cf6", "#5b21b6"]} value={TOOLS.length} title="Công cụ AI xử lý ảnh" text="Đa dạng tác vụ · Hiệu quả vượt trội" />
            <StatRow icon={Zap} image={STAT_IMAGES.local} colors={["#fde68a", "#f59e0b", "#b45309"]} value={local} title="Chạy trực tiếp trên máy" text="Nhanh chóng · Bảo mật · Ổn định" />
            <StatRow icon={Cloud} image={STAT_IMAGES.cloud} colors={["#7dd3fc", "#0ea5e9", "#0369a1"]} value={viaChatGpt} title="Chạy qua ChatGPT" text="Sức mạnh AI · Linh hoạt · Chất lượng cao" />
          </div>
        </section>

        {/* Tools */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {TOOLS.map((tool) => {
            const soon = tool.status === "soon";
            const chatgpt = tool.engine === "chatgpt";
            const [light, main, deep] = TOOL_ACCENT[tool.id];
            return (
              <button
                key={tool.id}
                onClick={() =>
                  soon
                    ? toast({ title: `${tool.title} · sắp ra mắt`, description: "Công cụ này sẽ có trong bản cập nhật tiếp theo." })
                    : openTool(tool.id)
                }
                className={cn(
                  "glass group relative flex min-h-[190px] w-full flex-col overflow-hidden rounded-3xl p-5 text-left transition-all duration-300",
                  soon ? "opacity-60" : "hover:-translate-y-1.5",
                )}
                style={{ ["--accent" as string]: main }}
              >
                {/* Accent glow and border that light up on hover */}
                <span
                  className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-25 blur-3xl transition-opacity duration-300 group-hover:opacity-60"
                  style={{ background: main }}
                />
                <span
                  className="pointer-events-none absolute inset-0 rounded-3xl opacity-40 transition-opacity duration-300 group-hover:opacity-100"
                  style={{ boxShadow: `inset 0 0 0 1px ${main}66, 0 18px 40px -18px ${main}` }}
                />

                {/* Engine badge, top right */}
                {soon ? (
                  <span className="absolute right-4 top-4 rounded-full bg-base-content/10 px-2.5 py-1 text-[11px] font-semibold text-base-content/60">
                    Sắp có
                  </span>
                ) : (
                  <span
                    className={cn(
                      "absolute right-4 top-4 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold",
                      chatgpt
                        ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-500 dark:text-emerald-300"
                        : "border-sky-400/30 bg-sky-500/15 text-sky-600 dark:text-sky-300",
                    )}
                  >
                    {chatgpt ? <Sparkles className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
                    {chatgpt ? "ChatGPT" : "Trên máy"}
                  </span>
                )}

                {/* Big 3D icon on the left, name and text on the right */}
                <div className="relative mt-6 flex flex-1 items-center gap-4">
                  <Icon3D icon={tool.icon} image={toolImage(tool.id)} colors={TOOL_ACCENT[tool.id]} size="xxl" className="-ml-2" />
                  <div className="flex min-w-0 flex-1 flex-col self-stretch">
                    <h2
                      className="text-[20px] font-black leading-tight tracking-tight text-base-content dark:text-white"
                      style={{ textShadow: `0 0 22px ${main}55` }}
                    >
                      {tool.title}
                    </h2>
                    <p className="mt-1.5 line-clamp-3 text-[12.5px] font-light leading-5 text-base-content/70">{tool.description}</p>
                    {!soon && (
                      <span
                        className="mt-auto flex items-center gap-1.5 self-start rounded-full border px-4 py-1.5 text-xs font-bold text-white transition-all duration-300 group-hover:gap-2.5 group-hover:shadow-lg"
                        style={{
                          marginTop: 14,
                          borderColor: `${light}66`,
                          background: `linear-gradient(135deg, ${main}cc, ${deep}cc)`,
                          boxShadow: `0 6px 18px -8px ${main}`,
                        }}
                      >
                        Mở công cụ
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
