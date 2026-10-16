// Renders the 3D tool icons to PNG in a hidden Electron window.
// Usage: electron main.js <outDir> <style> [id ...]
const { app, BrowserWindow } = require("electron");
const path = require("path");
const fs = require("fs");

const COLORS = {
  upscayl: ["7dd3fc", "0ea5e9", "0369a1"],
  "remove-bg": ["6ee7b7", "10b981", "047857"],
  "layer-separation": ["c4b5fd", "8b5cf6", "5b21b6"],
  "print-restoration": ["fdba74", "f97316", "c2410c"],
  "product-retoucher": ["5eead4", "14b8a6", "0f766e"],
  "render-2d-to-3d": ["a5b4fc", "6366f1", "4338ca"],
  vector: ["f9a8d4", "ec4899", "be185d"],
  "ad-designer": ["fcd34d", "f59e0b", "b45309"],
  "fake-model": ["fda4af", "f43f5e", "be123c"],
  "signboard-mockup": ["67e8f9", "06b6d4", "0e7490"],
  "old-photo-restoration": ["fde047", "eab308", "a16207"],
  "die-cut": ["fca5a5", "ef4444", "b91c1c"],
  "id-photo": ["93c5fd", "3b82f6", "1d4ed8"],
  "stat-tools": ["c4b5fd", "8b5cf6", "5b21b6"],
  "stat-local": ["fde68a", "f59e0b", "b45309"],
  "stat-cloud": ["7dd3fc", "0ea5e9", "0369a1"],
};

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const outDir = path.resolve(args[0]);
const style = args[1] || "glass";
const ids = args.length > 2 ? args.slice(2) : Object.keys(COLORS);
fs.mkdirSync(outDir, { recursive: true });

app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false,
    width: 512,
    height: 512,
    transparent: true,
    webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false },
  });
  win.webContents.on("console-message", (_e, _l, msg) => console.log("[page]", msg));
  for (const id of ids) {
    const url = `file://${path.join(__dirname, "render.html")}?id=${id}&colors=${COLORS[id].join(",")}&style=${style}&out=${encodeURIComponent(outDir)}`;
    const done = new Promise((resolve) => {
      const onTitle = (_e, title) => {
        if (title === "done") {
          win.webContents.off("page-title-updated", onTitle);
          resolve();
        }
      };
      win.webContents.on("page-title-updated", onTitle);
      setTimeout(resolve, 20000);
    });
    await win.loadURL(url);
    await done;
    console.log("rendered", id, fs.existsSync(path.join(outDir, id + ".png")));
  }
  app.quit();
});
