import React from "react";
import { useSetAtom } from "jotai";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOOLS } from "@/lib/tools";
import { openToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";

export default function HomeDashboard() {
  const openTool = useSetAtom(openToolAtom);
  const { toast } = useToast();
  const ready = TOOLS.filter((t) => t.status === "ready").length;

  return (
    <div className="h-full overflow-y-auto bg-base-300">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black">Bộ công cụ AI xử lý ảnh</h1>
          <p className="mt-1 text-sm text-base-content/60">
            {ready} công cụ chạy trực tiếp trên máy · {TOOLS.length - ready} công cụ AI sắp ra mắt. Chọn một công cụ để
            bắt đầu, có thể mở nhiều công cụ cùng lúc dưới dạng tab.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const soon = tool.status === "soon";
            return (
              <button
                key={tool.id}
                onClick={() =>
                  soon
                    ? toast({
                        title: `${tool.title} · sắp ra mắt`,
                        description: "Công cụ AI này sẽ có trong bản cập nhật tiếp theo (Đợt 2).",
                      })
                    : openTool(tool.id)
                }
                className={cn(
                  "group relative flex min-h-[170px] flex-col rounded-3xl border bg-base-100 p-5 text-left shadow-sm transition-all",
                  soon
                    ? "border-base-content/10 opacity-70"
                    : "border-base-content/10 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg",
                )}
              >
                <div className="mb-4 flex items-start justify-between">
                  <span className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", tool.tint)}>
                    <Icon className="h-6 w-6" />
                  </span>
                  {soon ? (
                    <span className="badge badge-ghost badge-sm">Sắp có</span>
                  ) : (
                    <ArrowRight className="h-5 w-5 text-base-content/30 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  )}
                </div>
                <h2 className="text-base font-extrabold">{tool.title}</h2>
                <p className="mt-1 text-xs leading-5 text-base-content/60">{tool.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
