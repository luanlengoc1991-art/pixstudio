import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FolderDown,
  ImagePlus,
  ImageUpscale,
  Layers,
  Loader2,
  Maximize2,
  PenTool,
  ShoppingBag,
  Sparkles,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { cn } from "@/lib/utils";
import { sendImageToToolAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  CompareView,
  EmptyState,
  fileExtension,
  fileName,
  fileUrl,
  IMAGE_SAVE_FILTERS,
  ImageInput,
  OptionCards,
  saveFileAs,
  saveFilesToFolder,
  Section,
  Segmented,
  storeImageFile,
  ToolLayout,
  usePendingToolImage,
  ZoomModal,
} from "../common";
import { ChatGptJobBanner, useChatGptJob } from "../common/chatgpt-job";
import { PromptPreview } from "../chatgpt-tool";
import {
  buildPodMockupPrompt,
  buildPodRestorePrompt,
  MOCKUP_STEPS,
  POD_PLACEMENTS,
  POD_PRODUCT_COLORS,
  POD_PRODUCT_PRESETS,
  POD_SCENE_CHIPS,
  RESTORE_BG_SWATCHES,
  RESTORE_STEPS,
} from "./prompts";

const TOOL_ID = "pod-studio";

type WorkflowStep = "restore" | "mockup";
type RestoreMode = "single" | "batch";

interface BatchItem {
  id: string;
  name: string;
  sourcePath: string;
  status: "pending" | "processing" | "done" | "error";
  resultPath?: string;
  error?: string;
}

export default function PodStudioTool() {
  const { toast } = useToast();
  const sendImageToTool = useSetAtom(sendImageToToolAtom);
  const job = useChatGptJob(TOOL_ID);

  const [workflow, setWorkflow] = useState<WorkflowStep>("restore");

  // Step 1: Restore state
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("single");
  const [restoreSource, setRestoreSource] = useState("");
  const [bgType, setBgType] = useState<"transparent" | "solid">("transparent");
  const [solidColor, setSolidColor] = useState("original");
  const [restoreResult, setRestoreResult] = useState("");
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchActiveIndex, setBatchActiveIndex] = useState(-1);
  const batchJobRef = useRef<{ jobId: string; index: number } | null>(null);
  const singleJobIdRef = useRef<{ step: WorkflowStep; jobId: string } | null>(null);

  // Step 2: Mockup state
  const [artworkPath, setArtworkPath] = useState("");
  const [blankItemPath, setBlankItemPath] = useState("");
  const [productPrompt, setProductPrompt] = useState("Áo thun trắng cổ tròn unisex trải phẳng trên nền studio sạch sẽ");
  const [productColorHex, setProductColorHex] = useState("#FFFFFF");
  const [placement, setPlacement] = useState("front_center");
  const [mockupResult, setMockupResult] = useState("");

  // Shared viewer state
  const [view, setView] = useState<"compare" | "single">("compare");
  const [editText, setEditText] = useState("");
  const [zoomed, setZoomed] = useState<string | null>(null);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  usePendingToolImage(TOOL_ID, (path) => {
    setRestoreSource(path);
    setWorkflow("restore");
    setRestoreMode("single");
    toast({ title: "Đã nạp ảnh vào Studio POD", description: "Sẵn sàng phục hồi file in sắc nét chuẩn DTG/DTF." });
  });

  // Track job completion for single restore, mockup, or batch item
  useEffect(() => {
    const state = job.state;
    if (!state) return;

    if (batchRunning && batchJobRef.current && state.jobId === batchJobRef.current.jobId) {
      const idx = batchJobRef.current.index;
      if (state.status === "done" && state.results[0]) {
        const resPath = state.results[0];
        batchJobRef.current = null;
        setBatchItems((prev) =>
          prev.map((item, i) => (i === idx ? { ...item, status: "done", resultPath: resPath, error: undefined } : item)),
        );
        const nextIdx = idx + 1;
        setTimeout(() => {
          setBatchItems((currentList) => {
            if (nextIdx < currentList.length) {
              triggerBatchItem(nextIdx, currentList);
            } else {
              setBatchRunning(false);
              setBatchActiveIndex(-1);
              toast({ title: "Hoàn tất xử lý hàng loạt POD!" });
            }
            return currentList;
          });
        }, 900);
      } else if (state.status === "error" || state.status === "cancelled") {
        batchJobRef.current = null;
        setBatchItems((prev) =>
          prev.map((item, i) => (i === idx ? { ...item, status: "error", error: state.message || "Lỗi xử lý" } : item)),
        );
        if (state.status === "cancelled") {
          setBatchRunning(false);
          setBatchActiveIndex(-1);
        } else {
          const nextIdx = idx + 1;
          setTimeout(() => {
            setBatchItems((currentList) => {
              if (nextIdx < currentList.length) {
                triggerBatchItem(nextIdx, currentList);
              } else {
                setBatchRunning(false);
                setBatchActiveIndex(-1);
              }
              return currentList;
            });
          }, 1200);
        }
      }
      return;
    }

    if (singleJobIdRef.current && state.jobId === singleJobIdRef.current.jobId && state.results[0]) {
      if (singleJobIdRef.current.step === "restore") {
        setRestoreResult(state.results[0]);
      } else {
        setMockupResult(state.results[0]);
      }
    }
  }, [job.state, batchRunning]);

  const restorePromptText = useMemo(() => {
    const swatch = RESTORE_BG_SWATCHES.find((s) => s.color.toLowerCase() === solidColor.toLowerCase());
    return buildPodRestorePrompt(bgType, solidColor, swatch?.name);
  }, [bgType, solidColor]);

  const mockupPromptText = useMemo(() => {
    const swatch = POD_PRODUCT_COLORS.find((c) => c.color.toLowerCase() === productColorHex.toLowerCase());
    return buildPodMockupPrompt({
      productPrompt,
      productColorName: swatch?.name || productColorHex,
      productColorHex,
      placement,
      hasCustomBlank: Boolean(blankItemPath),
    });
  }, [productPrompt, productColorHex, placement, blankItemPath]);

  const triggerBatchItem = (index: number, list: BatchItem[]) => {
    const item = list[index];
    if (!item) {
      setBatchRunning(false);
      setBatchActiveIndex(-1);
      return;
    }
    if (item.status === "done" && item.resultPath) {
      triggerBatchItem(index + 1, list);
      return;
    }
    setBatchActiveIndex(index);
    setBatchItems((prev) => prev.map((it, i) => (i === index ? { ...it, status: "processing", error: undefined } : it)));
    const jobId = job.submit({
      prompt: restorePromptText,
      imagePaths: [item.sourcePath],
      expected: 1,
      newChat: index === 0,
      steps: RESTORE_STEPS,
    });
    batchJobRef.current = { jobId, index };
  };

  const startBatch = () => {
    if (!batchItems.length) {
      toast({ title: "Chưa có danh sách ảnh", description: "Hãy thêm các ảnh mẫu cần phục hồi trước." });
      return;
    }
    setBatchRunning(true);
    triggerBatchItem(0, batchItems);
  };

  const stopBatch = () => {
    setBatchRunning(false);
    setBatchActiveIndex(-1);
    batchJobRef.current = null;
    job.cancel();
  };

  const addBatchFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const added: BatchItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      const stored = await storeImageFile(file, file.name);
      added.push({
        id: `pod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: file.name,
        sourcePath: stored,
        status: "pending",
      });
    }
    if (added.length) setBatchItems((prev) => [...prev, ...added]);
  };

  const runSingleRestore = () => {
    if (!restoreSource) {
      toast({ title: "Chưa có ảnh mẫu", description: "Hãy chọn ảnh áo/cốc/ấn phẩm cần phục hồi file in." });
      return;
    }
    const jobId = job.submit({
      prompt: restorePromptText,
      imagePaths: [restoreSource],
      expected: 1,
      steps: RESTORE_STEPS,
    });
    singleJobIdRef.current = { step: "restore", jobId };
  };

  const runMockup = () => {
    if (!artworkPath) {
      toast({ title: "Chưa có bản thiết kế in", description: "Hãy chuyển file từ Bước 1 sang hoặc tải file thiết kế PNG lên." });
      return;
    }
    const paths = [artworkPath, blankItemPath].filter(Boolean);
    const jobId = job.submit({
      prompt: mockupPromptText,
      imagePaths: paths,
      expected: 1,
      steps: MOCKUP_STEPS,
    });
    singleJobIdRef.current = { step: "mockup", jobId };
  };

  const sendToStep2 = (path: string) => {
    setArtworkPath(path);
    setMockupResult("");
    setWorkflow("mockup");
    toast({ title: "Đã chuyển sang Bước 2: Dựng Mockup POD", description: "Chọn loại sản phẩm (Áo, Cốc, Túi...) rồi bấm tạo Mockup." });
  };

  const toggleSceneChip = (chip: string) => {
    setProductPrompt((prev) => {
      const clean = prev.trim();
      if (!clean) return chip;
      if (clean.includes(chip)) {
        return clean
          .replace(new RegExp(`,?\\s*${chip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), "")
          .replace(/^,\s*/, "")
          .trim();
      }
      return `${clean}, ${chip}`;
    });
  };

  const saveOne = async (path: string, prefix: string) => {
    const ext = fileExtension(path);
    const saved = await saveFileAs({
      defaultName: `${prefix}_${Date.now()}.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }, ...IMAGE_SAVE_FILTERS],
      sourcePath: path,
    });
    if (saved) toast({ title: "Đã lưu ảnh", description: saved });
  };

  const saveBatchResults = async () => {
    const doneItems = batchItems.filter((i) => i.status === "done" && i.resultPath);
    if (!doneItems.length) return;
    const count = await saveFilesToFolder({
      folderName: `POD_Print_Files_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}`,
      files: doneItems.map((item, idx) => ({
        sourcePath: item.resultPath!,
        name: `${String(idx + 1).padStart(2, "0")}_${fileName(item.name)}_POD.${fileExtension(item.resultPath!)}`,
      })),
    });
    if (count) toast({ title: `Đã lưu ${count} file in POD` });
  };

  const refineCurrent = () => {
    if (!editText.trim()) return;
    const jobId = job.submit({
      prompt: `Hãy chỉnh sửa lại ảnh vừa tạo theo yêu cầu sau, giữ nguyên chữ và chi tiết đồ họa gốc: ${editText.trim()}`,
      imagePaths: [],
      newChat: false,
      nativeEdit: true,
      steps: workflow === "restore" ? RESTORE_STEPS : MOCKUP_STEPS,
    });
    singleJobIdRef.current = { step: workflow, jobId };
    setEditText("");
  };

  const activeResult = workflow === "restore" ? restoreResult : mockupResult;
  const activeBefore = workflow === "restore" ? restoreSource : artworkPath;

  const aside = (
    <>
      <Segmented
        value={workflow}
        onChange={setWorkflow}
        options={[
          { value: "restore", label: "1. Phục hồi File In" },
          { value: "mockup", label: "2. Dựng Mockup POD" },
        ]}
      />

      {workflow === "restore" ? (
        <>
          <Section step="01" title="Chế độ xử lý">
            <Segmented
              value={restoreMode}
              onChange={setRestoreMode}
              options={[
                { value: "single", label: "Đơn lẻ (1 ảnh)" },
                { value: "batch", label: `Hàng loạt (${batchItems.length})` },
              ]}
            />
          </Section>

          {restoreMode === "single" ? (
            <Section step="02" title="Ảnh mẫu chụp gốc (Áo / Cốc / Decal cũ)" hint="AI sẽ khử nhăn, nắn phẳng và vẽ lại file in sắc nét.">
              <ImageInput
                toolId={TOOL_ID}
                imagePath={restoreSource}
                onChange={(path) => {
                  setRestoreSource(path);
                  setRestoreResult("");
                }}
              />
            </Section>
          ) : (
            <Section step="02" title="Danh sách ảnh phục hồi hàng loạt">
              <input
                ref={batchFileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  void addBatchFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={batchRunning}
                className="btn btn-outline btn-sm w-full"
                onClick={() => batchFileInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" /> Thêm nhiều ảnh mẫu POD
              </button>
              {batchItems.length > 0 && (
                <div className="flex items-center justify-between text-[11px] text-base-content/70">
                  <span>
                    Đã xong: <b>{batchItems.filter((i) => i.status === "done").length}/{batchItems.length}</b>
                  </span>
                  {!batchRunning && (
                    <button type="button" className="text-error hover:underline" onClick={() => setBatchItems([])}>
                      Xóa danh sách
                    </button>
                  )}
                </div>
              )}
            </Section>
          )}

          <Section step="03" title="Nền File In xuất ra">
            <OptionCards
              value={bgType}
              onChange={setBgType}
              options={[
                { value: "transparent", label: "PNG trong suốt", hint: "Chuẩn in áo DTG / DTF" },
                { value: "solid", label: "Nền màu đặc", hint: "Poster, tranh canvas" },
              ]}
            />
            {bgType === "solid" && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {RESTORE_BG_SWATCHES.map((sw) => (
                  <button
                    key={sw.id}
                    type="button"
                    onClick={() => setSolidColor(sw.color)}
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[10.5px] font-bold transition-all",
                      solidColor.toLowerCase() === sw.color.toLowerCase()
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-base-content/15 bg-base-100",
                    )}
                  >
                    {sw.name}
                  </button>
                ))}
                <input
                  type="color"
                  className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                  value={solidColor.startsWith("#") ? solidColor : "#ffffff"}
                  onChange={(e) => setSolidColor(e.target.value)}
                />
              </div>
            )}
          </Section>

          <PromptPreview prompt={restorePromptText} />
        </>
      ) : (
        <>
          <Section step="01" title="Bản vẽ thiết kế 2D (File In)" hint="Tự nhận từ Bước 1 hoặc tải trực tiếp file PNG/JPG của bạn.">
            <ImageInput
              toolId={TOOL_ID}
              compact
              imagePath={artworkPath}
              onChange={(path) => {
                setArtworkPath(path);
                setMockupResult("");
              }}
              label="Tải file thiết kế in 2D"
            />
          </Section>

          <Section step="02" title="Ảnh phôi sản phẩm riêng (Tùy chọn)" hint="Bỏ trống nếu muốn AI tự tạo sản phẩm & bối cảnh thương mại.">
            <ImageInput
              toolId={TOOL_ID}
              compact
              acceptPaste={false}
              imagePath={blankItemPath}
              onChange={setBlankItemPath}
              label="Tải ảnh áo trơn / cốc trơn riêng"
            />
            {blankItemPath && (
              <button type="button" className="btn btn-ghost btn-xs self-end text-error" onClick={() => setBlankItemPath("")}>
                <X className="h-3.5 w-3.5" /> Bỏ ảnh phôi riêng
              </button>
            )}
          </Section>

          <Section step="03" title="Sản phẩm & Bối cảnh Mockup">
            <div className="flex flex-wrap gap-1">
              {POD_PRODUCT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setProductPrompt(preset)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-colors",
                    productPrompt.startsWith(preset)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-base-content/15 bg-base-100 hover:border-primary/50",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
            <textarea
              className="textarea textarea-bordered textarea-sm min-h-[60px] w-full"
              value={productPrompt}
              onChange={(e) => setProductPrompt(e.target.value)}
              placeholder="Mô tả sản phẩm & bối cảnh mockup..."
            />
            <div className="flex flex-wrap gap-1">
              {POD_SCENE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleSceneChip(chip)}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    productPrompt.includes(chip)
                      ? "border-secondary bg-secondary/15 text-secondary"
                      : "border-base-content/15 bg-base-100 hover:border-secondary/50",
                  )}
                >
                  + {chip}
                </button>
              ))}
            </div>
          </Section>

          <Section step="04" title="Màu nền sản phẩm">
            <div className="flex flex-wrap items-center gap-2">
              {POD_PRODUCT_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setProductColorHex(c.color)}
                  title={c.name}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-transform",
                    productColorHex.toLowerCase() === c.color.toLowerCase() ? "scale-110 border-primary" : "border-base-content/20",
                  )}
                  style={{ background: c.color }}
                />
              ))}
              <input
                type="color"
                className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
                value={productColorHex}
                onChange={(e) => setProductColorHex(e.target.value)}
              />
            </div>
          </Section>

          <Section step="05" title="Vị trí đặt hình in">
            <OptionCards value={placement} onChange={setPlacement} options={POD_PLACEMENTS} />
          </Section>

          <PromptPreview prompt={mockupPromptText} />
        </>
      )}
    </>
  );

  const footer =
    workflow === "restore" && restoreMode === "batch" ? (
      batchRunning ? (
        <button className="btn btn-error w-full" onClick={stopBatch}>
          <Square className="h-4 w-4" /> Dừng hàng loạt ({batchActiveIndex + 1}/{batchItems.length})
        </button>
      ) : (
        <button className="btn btn-primary w-full" disabled={!batchItems.length || job.running} onClick={startBatch}>
          <Sparkles className="h-4 w-4" /> Phục hồi hàng loạt ({batchItems.length} ảnh)
        </button>
      )
    ) : workflow === "restore" ? (
      <button className="btn btn-primary w-full" disabled={job.running} onClick={runSingleRestore}>
        <Sparkles className="h-4 w-4" />
        {job.running ? "Đang phục hồi file in..." : "Phục hồi file in POD ngay"}
      </button>
    ) : (
      <button className="btn btn-primary w-full" disabled={job.running} onClick={runMockup}>
        <ShoppingBag className="h-4 w-4" />
        {job.running ? "Đang dựng Mockup POD..." : "Dựng Mockup bán hàng"}
      </button>
    );

  return (
    <ToolLayout
      toolId={TOOL_ID}
      aside={aside}
      footer={footer}
      actions={
        workflow === "restore" && restoreMode === "batch" && batchItems.some((i) => i.status === "done") ? (
          <button className="btn btn-primary btn-sm" onClick={saveBatchResults}>
            <FolderDown className="h-4 w-4" /> Tải toàn bộ file in ({batchItems.filter((i) => i.status === "done").length})
          </button>
        ) : undefined
      }
    >
      <div className="flex h-full min-h-0 flex-col gap-3 p-4">
        <ChatGptJobBanner
          toolId={TOOL_ID}
          steps={workflow === "restore" ? RESTORE_STEPS : MOCKUP_STEPS}
          onFetch={() => {
            const jobId = job.submit({
              prompt: "",
              imagePaths: [restoreSource, artworkPath, blankItemPath, ...job.history].filter(Boolean),
              expected: 1,
              newChat: false,
              collectOnly: true,
              steps: ["Đang quét các ảnh ChatGPT đã tạo..."],
            });
            singleJobIdRef.current = { step: workflow, jobId };
          }}
        />

        {workflow === "restore" && restoreMode === "batch" ? (
          batchItems.length === 0 ? (
            <div className="min-h-0 flex-1">
              <EmptyState
                icon={ShoppingBag}
                title="Phục Hồi File In POD Hàng Loạt"
                text="Chọn nhiều ảnh chụp áo thun, cốc sứ, decal hoặc tranh cũ cùng lúc. LMS Studio sẽ tự động chạy lần lượt qua ChatGPT và trả về trọn bộ file PNG tách nền sắc nét."
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {batchItems.map((item, idx) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-2xl border border-base-content/10 bg-base-100 p-2.5">
                  <div className="checkerboard relative aspect-square overflow-hidden rounded-xl border border-base-content/10">
                    <img
                      src={fileUrl(item.resultPath || item.sourcePath)}
                      alt={item.name}
                      onClick={() => setZoomed(item.resultPath || item.sourcePath)}
                      className="h-full w-full cursor-zoom-in object-contain p-2"
                    />
                    <span
                      className={cn(
                        "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black",
                        item.status === "done"
                          ? "bg-emerald-600 text-white"
                          : item.status === "processing"
                            ? "bg-primary text-primary-content"
                            : item.status === "error"
                              ? "bg-error text-error-content"
                              : "bg-slate-900/75 text-white",
                      )}
                    >
                      {item.status === "done" ? (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Xong
                        </span>
                      ) : item.status === "processing" ? (
                        <span className="flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Đang chạy
                        </span>
                      ) : item.status === "error" ? (
                        "Lỗi"
                      ) : (
                        `#${idx + 1} Chờ`
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate text-xs font-bold" title={item.name}>
                      {item.name}
                    </span>
                    {item.resultPath ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => sendToStep2(item.resultPath!)}
                          title="Đưa sang Bước 2: Dựng Mockup"
                        >
                          Mockup <ArrowRight className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square"
                          onClick={() => saveOne(item.resultPath!, `pod_print_${idx + 1}`)}
                          title="Tải file in này"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      !batchRunning && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs btn-square text-error"
                          onClick={() => setBatchItems((prev) => prev.filter((x) => x.id !== item.id))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : !activeResult ? (
          <div className="min-h-0 flex-1">
            <EmptyState
              icon={ShoppingBag}
              title={workflow === "restore" ? "Bước 1 · Phục Hồi File In Sắc Nét" : "Bước 2 · Dựng Mockup POD Thương Mại"}
              text={
                workflow === "restore"
                  ? "Tải ảnh chụp áo, cốc, túi hoặc thiết kế mờ/nghiêng. AI tái tạo lại bản vẽ 2D phẳng sắc nét nền trong suốt chuẩn in DTG/DTF."
                  : "Ướm bản vẽ 2D lên Áo thun, Hoodie, Cốc 11oz, Ly Tumbler, Túi Tote hoặc Tranh Canvas chuẩn thương mại Etsy, Shopify, Amazon."
              }
            />
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {activeBefore && (
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
                {workflow === "restore" && (
                  <button className="btn btn-secondary btn-sm" onClick={() => sendToStep2(activeResult)}>
                    Dựng Mockup POD <ArrowRight className="h-4 w-4" />
                  </button>
                )}
                <button className="btn btn-sm" onClick={() => setZoomed(activeResult)}>
                  <Maximize2 className="h-4 w-4" /> Phóng to
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "upscayl", path: activeResult })}>
                  <ImageUpscale className="h-4 w-4" /> Kích nét
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "die-cut", path: activeResult })}>
                  Bế file
                </button>
                <button className="btn btn-sm" onClick={() => sendImageToTool({ toolId: "vector", path: activeResult })}>
                  <PenTool className="h-4 w-4" /> Vector
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => saveOne(activeResult, workflow === "restore" ? "pod_file_in" : "pod_mockup")}
                >
                  <Download className="h-4 w-4" /> Tải về
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-base-content/10 bg-base-100">
              {activeBefore && view === "compare" ? (
                <CompareView
                  before={fileUrl(activeBefore)}
                  after={fileUrl(activeResult)}
                  beforeLabel={workflow === "restore" ? "Ảnh mẫu gốc" : "Bản vẽ 2D"}
                  afterLabel={workflow === "restore" ? "File in 4K" : "Mockup POD"}
                />
              ) : (
                <div className="checkerboard flex h-full items-center justify-center p-3">
                  <img
                    src={fileUrl(activeResult)}
                    alt=""
                    className="max-h-full max-w-full cursor-zoom-in object-contain"
                    onClick={() => setZoomed(activeResult)}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <input
                className="input input-bordered input-sm flex-1"
                placeholder="Chỉnh bằng AI: mô tả thay đổi (VD: làm nét viền chữ hơn, đổi màu cốc sang đen nhám...)"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refineCurrent()}
                disabled={job.running}
              />
              <button className="btn btn-secondary btn-sm" onClick={refineCurrent} disabled={job.running || !editText.trim()}>
                <Wand2 className="h-4 w-4" /> Gửi sửa đổi
              </button>
            </div>
          </>
        )}

        <ZoomModal src={zoomed ? fileUrl(zoomed) : null} title="Studio POD" onClose={() => setZoomed(null)} />
      </div>
    </ToolLayout>
  );
}
