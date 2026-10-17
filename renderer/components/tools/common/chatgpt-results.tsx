import React, { useEffect, useState } from "react";
import { useSetAtom } from "jotai";
import { Download, FolderDown, ImageUpscale, Layers, Maximize2, PenTool, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTool, ToolId } from "@/lib/tools";
import { sendImageToToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  CompareView,
  EmptyState,
  fileExtension,
  fileUrl,
  IMAGE_SAVE_FILTERS,
  saveFileAs,
  saveFilesToFolder,
  Segmented,
  ZoomModal,
} from "./index";
import { ChatGptJobBanner, useChatGptJob } from "./chatgpt-job";

/**
 * Result side of a ChatGPT tool: progress banner, before/after or single view,
 * hand-off buttons, "Chỉnh bằng AI" follow-up edits and the result history.
 */
export function ChatGptResults({
  toolId,
  steps,
  before,
  resultLabel,
  emptyText,
  inputPaths,
  expected = 1,
  refinePrompt = (text) => `Hãy chỉnh sửa lại ảnh vừa tạo theo yêu cầu sau, giữ nguyên mọi thứ khác: ${text}`,
  sendToLayers,
}: {
  toolId: ToolId;
  steps: string[];
  /** Input shown on the left of the comparison; no comparison without it */
  before?: string;
  resultLabel: string;
  emptyText: string;
  /** Images sent with the job, so "Lấy kết quả" does not collect them again */
  inputPaths: string[];
  expected?: number;
  refinePrompt?: (text: string) => string;
  /** Offer "Bóc tách layer" for the result (event setups are made for it) */
  sendToLayers?: boolean;
}) {
  const tool = getTool(toolId);
  const { toast } = useToast();
  const sendImageToTool = useSetAtom(sendImageToToolAtom);
  const job = useChatGptJob(toolId);

  const [editText, setEditText] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"compare" | "single">("compare");
  const [zoomed, setZoomed] = useState<string | null>(null);

  // Show the newest result as soon as it arrives
  const newest = job.history[0];
  useEffect(() => {
    if (newest) setSelected(newest);
  }, [newest]);
  const current = selected && job.history.includes(selected) ? selected : newest;

  const refine = () => {
    if (!editText.trim()) return;
    job.submit({ prompt: refinePrompt(editText.trim()), imagePaths: [], newChat: false, nativeEdit: true, steps });
    setEditText("");
  };

  const save = async (path: string) => {
    const ext = fileExtension(path);
    const saved = await saveFileAs({
      defaultName: `${toolId}_${Date.now()}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, ...IMAGE_SAVE_FILTERS],
      sourcePath: path,
    });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  const saveAll = async () => {
    const count = await saveFilesToFolder({
      folderName: `${tool.title} ${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}`,
      files: [...job.history].reverse().map((path, index) => ({
        sourcePath: path,
        name: `${toolId}_${index + 1}.${fileExtension(path)}`,
      })),
    });
    if (count) toast({ title: `Đã lưu ${count} ảnh` });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <ChatGptJobBanner
        toolId={toolId}
        steps={steps}
        onFetch={() =>
          job.submit({
            prompt: "",
            // Inputs and earlier results are listed so they are not taken again
            imagePaths: [...inputPaths, ...job.history],
            expected,
            newChat: false,
            collectOnly: true,
            steps: ["Đang quét các ảnh ChatGPT đã tạo..."],
          })
        }
      />

      {!current ? (
        <div className="min-h-0 flex-1">
          <EmptyState icon={tool.icon} title="Kết quả sẽ hiển thị tại đây" text={emptyText} />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {before && (
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: "compare", label: "So sánh Trước / Sau" },
                  { value: "single", label: "Kết quả đơn" },
                ]}
              />
            )}
            <div className="ml-auto flex flex-wrap gap-1.5">
              <button className="btn btn-sm" onClick={() => setZoomed(current)}>
                <Maximize2 className="h-4 w-4" /> Phóng to
              </button>
              <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "upscayl", path: current })}>
                <ImageUpscale className="h-4 w-4" /> Kích nét 4K
              </button>
              {sendToLayers && (
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "layer-separation", path: current })}>
                  <Layers className="h-4 w-4" /> Bóc tách layer
                </button>
              )}
              <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "vector", path: current })}>
                <PenTool className="h-4 w-4" /> Chuyển Vector
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => save(current)}>
                <Download className="h-4 w-4" /> Tải về
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-content/10 bg-base-100">
            {before && view === "compare" ? (
              <CompareView before={fileUrl(before)} after={fileUrl(current)} beforeLabel="Ảnh gốc" afterLabel={resultLabel} />
            ) : (
              <div className="checkerboard flex h-full items-center justify-center p-3">
                <img src={fileUrl(current)} alt="" className="max-h-full max-w-full cursor-zoom-in object-contain" onClick={() => setZoomed(current)} />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              className="input input-bordered input-sm flex-1"
              placeholder="Chỉnh bằng AI: mô tả thay đổi (VD: đổi nền sang màu hồng pastel, làm chữ to hơn...)"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && refine()}
              disabled={job.running}
            />
            <button className="btn btn-secondary btn-sm" onClick={refine} disabled={job.running || !editText.trim()}>
              <Wand2 className="h-4 w-4" /> Gửi sửa đổi
            </button>
          </div>

          {job.history.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                {job.history.map((path, index) => (
                  <button
                    key={path}
                    onClick={() => setSelected(path)}
                    className={cn(
                      "checkerboard h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all",
                      path === current ? "border-primary shadow-md" : "border-transparent opacity-70 hover:opacity-100",
                    )}
                    title={`Kết quả ${job.history.length - index}`}
                  >
                    <img src={fileUrl(path)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
              <button className="btn btn-sm shrink-0" onClick={saveAll}>
                <FolderDown className="h-4 w-4" /> Lưu tất cả ({job.history.length})
              </button>
            </div>
          )}
        </>
      )}

      <ZoomModal src={zoomed ? fileUrl(zoomed) : null} title={tool.title} onClose={() => setZoomed(null)} />
    </div>
  );
}
