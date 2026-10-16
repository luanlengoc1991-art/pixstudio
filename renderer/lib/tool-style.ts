import { ToolId } from "@/lib/tools";

/** Accent colours per tool: [light, main, deep] used for 3D icons, borders and buttons. */
export const TOOL_ACCENT: Record<ToolId, [string, string, string]> = {
  upscayl: ["#7dd3fc", "#0ea5e9", "#0369a1"],
  "remove-bg": ["#6ee7b7", "#10b981", "#047857"],
  "layer-separation": ["#c4b5fd", "#8b5cf6", "#5b21b6"],
  "print-restoration": ["#fdba74", "#f97316", "#c2410c"],
  "product-retoucher": ["#5eead4", "#14b8a6", "#0f766e"],
  "render-2d-to-3d": ["#a5b4fc", "#6366f1", "#4338ca"],
  vector: ["#f9a8d4", "#ec4899", "#be185d"],
  "ad-designer": ["#fcd34d", "#f59e0b", "#b45309"],
  "fake-model": ["#fda4af", "#f43f5e", "#be123c"],
  "signboard-mockup": ["#67e8f9", "#06b6d4", "#0e7490"],
  "old-photo-restoration": ["#fde047", "#eab308", "#a16207"],
  "die-cut": ["#fca5a5", "#ef4444", "#b91c1c"],
  "id-photo": ["#93c5fd", "#3b82f6", "#1d4ed8"],
};

/**
 * Rendered 3D icon for each tool: chrome glyph (lucide) extruded on a tinted
 * glass tile, rendered with three.js into public/icons3d.
 * Bump ICON_VERSION when the files are replaced so no cached copy shows.
 */
const ICON_VERSION = 8;

export const toolImage = (id: ToolId) => `public:///icons3d/${id}.png?v=${ICON_VERSION}`;

export const STAT_IMAGES = {
  tools: `public:///icons3d/stat-tools.png?v=${ICON_VERSION}`,
  local: `public:///icons3d/stat-local.png?v=${ICON_VERSION}`,
  cloud: `public:///icons3d/stat-cloud.png?v=${ICON_VERSION}`,
};
