import React, { useMemo, useState } from "react";
import { useAtom } from "jotai";
import { Copy, Download, FileText, PenTool, WandSparkles } from "lucide-react";
import { ELECTRON_COMMANDS } from "@common/electron-commands";
import { VectorizePayload, VectorizeResult, VectorType } from "@common/types/types";
import { toolProgressAtom } from "@/atoms/workspace-atom";
import { useToast } from "@/components/ui/use-toast";
import {
  BusyOverlay,
  EmptyState,
  errorMessage,
  fileName,
  fileUrl,
  ImageInput,
  usePendingToolImage,
  OptionCards,
  PreviewCard,
  saveFileAs,
  Section,
  Segmented,
  ToolLayout,
  ZoomModal,
} from "./common";
import { ChatGptJobBanner, useChatGptStep } from "./common/chatgpt-job";
import { IS_WEB } from "@/lib/platform";

const VECTOR_TYPES: { value: VectorType; label: string; hint: string }[] = [
  { value: "one-color-logo", label: "Logo 1 màu", hint: "Nét logo rõ, đơn sắc" },
  { value: "color-logo", label: "Logo nhiều màu", hint: "Mảng màu phẳng & cạnh sắc" },
  { value: "icon", label: "Icon / Tem nhãn", hint: "Biểu tượng, decal phẳng" },
  { value: "qr-code", label: "QR Code", hint: "Khối vuông, độ nét tối đa" },
  { value: "text", label: "Chữ / Con dấu", hint: "Chữ ký, nét viết, mộc đỏ" },
  { value: "anime", label: "Anime / Hoạt hình", hint: "Minh họa nét & cel shade" },
  { value: "portrait", label: "Chân dung", hint: "Minh họa 24 màu, gọn nhẹ" },
  { value: "artwork", label: "Tranh nghệ thuật", hint: "Minh họa 48 màu, làm mịn" },
];

// ChatGPT redraws the image as clean flat artwork first, so the tracer gets sharp
// edges and solid colors instead of blur, noise and gradients. QR codes are traced
// as they are: a redraw could break them.
const CLEANUP_PROMPTS: Partial<Record<VectorType, string>> = {
  "one-color-logo": "Redraw it as a clean single-color logo: solid pure black shapes on a pure white background, perfectly sharp edges, no gray, gradients, texture or noise.",
  "color-logo": "Redraw it as a clean flat-color vector-style logo: solid color areas with the same colors, perfectly sharp edges, no gradients, shadows, texture or noise.",
  icon: "Redraw it as a clean flat vector-style icon / sticker: solid color areas, perfectly sharp edges, no gradients, shadows, texture or noise.",
  text: "Redraw it as clean solid ink on a pure white background: same lettering, strokes and stamp shapes, perfectly sharp edges, no paper texture, stains or noise.",
  anime: "Redraw it as a clean vector-style cartoon illustration: crisp clean outlines and flat cel-shaded color areas, no texture or noise.",
  portrait: "Redraw it as a clean vector-style portrait illustration with flat color areas and clean shapes, keeping the person's likeness, face and expression exactly.",
  artwork: "Redraw it as a clean vector-style illustration with flat color areas and clean shapes, keeping the composition and colors.",
};

const cleanupPrompt = (type: VectorType, background: "transparent" | "white") =>
  [
    "Prepare the attached image for vector tracing.",
    CLEANUP_PROMPTS[type],
    "Keep exactly the same design, composition, proportions, colors and every letter (including Vietnamese diacritics); do not add, remove or misspell anything.",
    background === "white" || type === "one-color-logo" || type === "text"
      ? "Plain pure white background."
      : "Real transparent alpha background (PNG, not a checkerboard).",
    "Generate the final result as an image. Do not ask follow-up questions.",
  ].join(" ");

const CLEANUP_STEPS = [
  "Đang gửi ảnh sang ChatGPT...",
  "ChatGPT đang vẽ lại nét sạch, màu phẳng...",
  "Đang nhận ảnh để chuyển Vector...",
];

const formatBytes =(bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(2)} MB`;

export default function VectorTool() {
  const { toast } = useToast();
  const [progress, setProgress] = useAtom(toolProgressAtom);
  const [imagePath, setImagePath] = useState("");
  const [type, setType] = useState<VectorType>("one-color-logo");
  const [background, setBackground] = useState<"transparent" | "white">("transparent");
  const [result, setResult] = useState<VectorizeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<"source" | "svg" | null>(null);
  const [aiCleanup, setAiCleanup] = useState(!IS_WEB);
  const cleanup = useChatGptStep("vector");
  const useCleanup = aiCleanup && !!CLEANUP_PROMPTS[type];

  usePendingToolImage("vector", (path) => {
    setImagePath(path);
    setResult(null);
  });

  const svgUrl = useMemo(
    () => (result ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}` : ""),
    [result],
  );

  const run = async () => {
    if (!imagePath) {
      toast({ title: "Chưa có ảnh", description: "Hãy chọn hoặc dán một ảnh trước." });
      return;
    }
    let source = imagePath;
    if (useCleanup) {
      try {
        source = await cleanup.run(cleanupPrompt(type, background), imagePath, CLEANUP_STEPS);
      } catch (error) {
        toast({ title: "ChatGPT chưa làm sạch được ảnh", description: errorMessage(error) });
        return;
      }
    }
    setBusy(true);
    setProgress("Đang bóc tách đường vector...");
    try {
      const payload: VectorizePayload = { imagePath: source, type, background };
      const output: VectorizeResult = await window.electron.invoke(
        ELECTRON_COMMANDS.VECTORIZE_IMAGE,
        payload,
      );
      setResult(output);
      toast({ title: "Tạo Vector thành công!" });
    } catch (error) {
      toast({ title: "Không thể tạo file Vector", description: errorMessage(error) });
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  const saveSvg = async () => {
    if (!result) return;
    const saved = await saveFileAs({
      defaultName: `${fileName(imagePath)}.svg`,
      filters: [{ name: "SVG", extensions: ["svg"] }],
      text: result.svg,
    });
    if (saved) toast({ title: "Đã tải xuống file SVG", description: saved });
  };

  const savePdf = async () => {
    if (!result) return;
    try {
      const bytes: Uint8Array = await window.electron.invoke(ELECTRON_COMMANDS.EXPORT_VECTOR_PDF, {
        svg: result.svg,
      });
      const saved = await saveFileAs({
        defaultName: `${fileName(imagePath)}.pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        bytes,
      });
      if (saved) toast({ title: "Đã xuất file PDF Vector", description: saved });
    } catch (error) {
      toast({ title: "Xuất PDF thất bại", description: errorMessage(error) });
    }
  };

  const copySvg = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.svg);
      toast({
        title: "Đã sao chép mã SVG!",
        description: "Bạn có thể dán (Ctrl+V) trực tiếp vào Illustrator, Corel, Figma hoặc trang web.",
      });
    } catch {
      toast({ title: "Sao chép thất bại", description: "Không thể ghi vào bộ nhớ tạm." });
    }
  };

  const aside = (
    <>
      <Section step="01" title="Kiểu Vector">
        <OptionCards options={VECTOR_TYPES} value={type} onChange={setType} />
      </Section>
      <Section title="Tùy chọn nền SVG">
        <Segmented
          value={background}
          onChange={setBackground}
          options={[
            { value: "transparent", label: "Nền trong suốt" },
            { value: "white", label: "Nền trắng" },
          ]}
        />
      </Section>
      {!IS_WEB && (
        <Section title="Làm sạch ảnh trước khi trace">
          <Segmented
            value={aiCleanup ? "chatgpt" : "local"}
            onChange={(value: string) => setAiCleanup(value === "chatgpt")}
            options={[
              { value: "chatgpt", label: "ChatGPT vẽ lại nét sạch" },
              { value: "local", label: "Trace ảnh gốc" },
            ]}
          />
          <p className="text-[11px] font-light text-base-content/60">
            {type === "qr-code"
              ? "QR Code luôn trace trực tiếp để không sai mã."
              : aiCleanup
                ? "ChatGPT khử mờ, nhiễu, vẽ lại nét và màu phẳng, rồi app trace SVG trên máy: đường gọn, ít path hơn."
                : "Trace thẳng ảnh gốc trên máy. Ảnh mờ hoặc chụp sẽ ra nhiều path rác."}
          </p>
        </Section>
      )}
      <Section step="02" title="Ảnh đầu vào">
        <ImageInput
          toolId="vector"
          imagePath={imagePath}
          onChange={(path) => {
            setImagePath(path);
            setResult(null);
          }}
        />
      </Section>
    </>
  );

  const footer = (
    <button className="btn btn-primary w-full" disabled={busy || cleanup.running} onClick={run}>
      <WandSparkles className="h-4 w-4" />
      {busy || cleanup.running ? "Đang xử lý..." : "Tạo Vector"}
    </button>
  );

  return (
    <ToolLayout toolId="vector" aside={aside} footer={footer}>
      {busy && <BusyOverlay text={progress || "Đang bóc tách đường vector..."} />}
      {!imagePath ? (
        <EmptyState
          icon={PenTool}
          title="Chưa có ảnh nào được chọn"
          text="Chọn ảnh, kéo thả file hoặc dán phím tắt Ctrl+V vào ứng dụng để bóc tách nét vector."
        />
      ) : (
        <div className="flex h-full flex-col gap-3 p-4">
          {(cleanup.running || cleanup.state?.status === "error") && <ChatGptJobBanner toolId="vector" steps={CLEANUP_STEPS} />}
          <div className="flex min-h-0 flex-1 gap-3">
            <PreviewCard label="Ảnh gốc (Bitmap)" src={fileUrl(imagePath)} onZoom={() => setZoom("source")} />
            <PreviewCard label="Vector SVG" src={svgUrl || undefined} onZoom={result ? () => setZoom("svg") : undefined}>
              <p className="text-sm text-base-content/50">Bấm "Tạo Vector" để xem kết quả</p>
            </PreviewCard>
          </div>
          {result && (
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-base-content/10 bg-base-100 p-3">
              <span className="badge badge-primary badge-outline">SVG 1.1</span>
              <span className="text-xs">
                Dung lượng SVG: <b>{formatBytes(result.bytes)}</b>
              </span>
              <span className="text-xs">
                Đường Path: <b>{result.pathCount.toLocaleString("vi-VN")}</b>
              </span>
              <span className="text-xs">
                Kích thước: <b>{result.width}×{result.height}px</b>
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                <button className="btn btn-sm" onClick={copySvg}>
                  <Copy className="h-4 w-4" /> Sao chép mã SVG
                </button>
                <button className="btn btn-sm" onClick={savePdf}>
                  <FileText className="h-4 w-4" /> Xuất PDF
                </button>
                <button className="btn btn-primary btn-sm" onClick={saveSvg}>
                  <Download className="h-4 w-4" /> Tải file SVG
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <ZoomModal
        src={zoom === "source" ? fileUrl(imagePath) : zoom === "svg" ? svgUrl : null}
        title={zoom === "svg" ? "Xem chi tiết nét Vector SVG" : "Ảnh gốc"}
        onClose={() => setZoom(null)}
      />
    </ToolLayout>
  );
}
