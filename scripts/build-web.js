// Builds the renderer as the LMS website into web/dist (Cloudflare Pages).
// The Electron build's export in renderer/out is set aside and restored, so
// building the website does not disturb the desktop app.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const out = path.join(root, "renderer", "out");
const backup = path.join(root, "renderer", "out.electron");
const dist = path.join(root, "web", "dist");

if (fs.existsSync(out)) fs.renameSync(out, backup);
try {
  execSync("npx next build renderer", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, NEXT_PUBLIC_LMS_WEB: "1", NODE_ENV: "production" },
  });
  fs.rmSync(dist, { recursive: true, force: true });
  fs.cpSync(out, dist, { recursive: true });
  // onnxruntime-web is told to load its .wasm from the CDN (lib/web/onnx.ts); the
  // bundled copies are unused and larger than the 25 MB Pages file limit
  const media = path.join(dist, "_next", "static", "media");
  for (const file of fs.existsSync(media) ? fs.readdirSync(media) : []) {
    if (/^ort-.*\.wasm$/.test(file)) fs.rmSync(path.join(media, file));
  }
  // Loaded at runtime by renderer/lib/web/vectorize.ts (not bundled, see there)
  fs.mkdirSync(path.join(dist, "wasm"), { recursive: true });
  for (const file of ["vtracer.js", "vtracer.wasm"]) {
    fs.copyFileSync(path.join(root, "node_modules", "vtracer-wasm", file), path.join(dist, "wasm", file));
  }
  // Pages serves _headers from the output root
  fs.writeFileSync(
    path.join(dist, "_headers"),
    [
      "/_next/static/*",
      "  Cache-Control: public, max-age=31536000, immutable",
      "/icons3d/*",
      "  Cache-Control: public, max-age=604800",
      "",
    ].join("\n"),
  );
  console.log(`Website built into ${path.relative(root, dist)}`);
} finally {
  fs.rmSync(out, { recursive: true, force: true });
  if (fs.existsSync(backup)) fs.renameSync(backup, out);
}
