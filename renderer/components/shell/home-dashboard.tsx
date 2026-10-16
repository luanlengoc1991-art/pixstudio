import React from "react";
import { useSetAtom } from "jotai";
import { ArrowRight, Cpu, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOLS } from "@/lib/tools";
import { openToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";

export default function HomeDashboard() {
  const openTool = useSetAtom(openToolAtom);
  const { toast } = useToast();
  const local = TOOLS.filter((t) => t.status === "ready" && t.engine === "local").length;
  const viaChatGpt = TOOLS.filter((t) => t.status === "ready" && t.engine === "chatgpt").length;

  return (
    <div className="h-full overflow-y-auto bg-base-300">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-7">
          <h1 className="text-[28px] font-black tracking-tight">Bộ công cụ AI xử lý ảnh</h1>
          <p className="mt-1.5 text-sm font-light text-base-content/70">
            <span className="font-semibold text-base-content">{local} công cụ</span> chạy trực tiếp trên máy ·{" "}
            <span className="font-semibold text-base-content">{viaChatGpt} công cụ AI</span> chạy qua tài khoản
            ChatGPT của bạn. Có thể mở nhiều công cụ cùng lúc dưới dạng tab.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const soon = tool.status === "soon";
            const chatgpt = tool.engine === "chatgpt";
            return (
              <button
                key={tool.id}
                onClick={() =>
                  soon
                    ? toast({
                        title: `${tool.title} · sắp ra mắt`,
                        description: "Công cụ này sẽ có trong bản cập nhật tiếp theo.",
                      })
                    : openTool(tool.id)
                }
                className={cn(
                  "group relative flex min-h-[200px] w-full flex-col overflow-hidden rounded-3xl border bg-base-100 p-5 text-left shadow-md transition-all duration-200",
                  soon
                    ? "border-base-content/10 opacity-60"
                    : "border-base-content/15 hover:-translate-y-1 hover:border-primary hover:shadow-xl hover:shadow-primary/20",
                )}
              >
                {/* Soft glow that appears on hover */}
                <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/0 blur-2xl transition-colors duration-300 group-hover:bg-primary/25" />

                <div className="relative mb-4 flex w-full items-start justify-between gap-2">
                  <span
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-110",
                      tool.tint,
                    )}
                  >
                    <Icon className="h-7 w-7" strokeWidth={2.2} />
                  </span>
                  {soon ? (
                    <span className="rounded-full bg-base-content/10 px-2.5 py-1 text-[11px] font-semibold text-base-content/60">
                      Sắp có
                    </span>
                  ) : chatgpt ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                      <Sparkles className="h-3 w-3" /> ChatGPT
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-600 dark:text-sky-300">
                      <Cpu className="h-3 w-3" /> Trên máy
                    </span>
                  )}
                </div>

                <h2 className="relative text-[17px] font-extrabold leading-snug tracking-tight">{tool.title}</h2>
                <p className="relative mt-1.5 text-[13px] font-light leading-5 text-base-content/70">
                  {tool.description}
                </p>

                {!soon && (
                  <span className="relative mt-auto flex items-center gap-1.5 self-start pt-4">
                    <span className="flex items-center gap-1.5 rounded-xl bg-primary/15 px-3.5 py-2 text-xs font-bold text-primary transition-all duration-200 group-hover:bg-primary group-hover:text-primary-content group-hover:shadow-lg group-hover:shadow-primary/30">
                      Mở công cụ
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
