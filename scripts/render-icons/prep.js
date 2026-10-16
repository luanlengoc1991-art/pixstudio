// Turns lucide stroke icons into filled outline SVGs (for 3D extrusion):
// rasterise at 1024 px with sharp, then trace with potrace.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const sharp = require(process.argv[2] + "/node_modules/sharp");
const potrace = process.argv[2] + "/resources/win/bin/potrace.exe";

const ICONS = {
  upscayl: "image-upscale",
  "remove-bg": "eraser",
  "layer-separation": "layers",
  "print-restoration": "file-image",
  "product-retoucher": "package-check",
  "render-2d-to-3d": "box",
  vector: "pen-tool",
  "ad-designer": "megaphone",
  "fake-model": "shirt",
  "signboard-mockup": "store",
  "old-photo-restoration": "history",
  "die-cut": "scissors",
  "id-photo": "id-card",
  "stat-tools": "sparkles",
  "stat-local": "zap",
  "stat-cloud": "cloud",
};

const out = path.join(__dirname, "filled");
fs.mkdirSync(out, { recursive: true });

(async () => {
  for (const [id, name] of Object.entries(ICONS)) {
    let svg = fs.readFileSync(path.join(__dirname, "node_modules/lucide-static/icons", name + ".svg"), "utf8");
    // Black strokes on white, slightly bolder so the extrusion reads well
    svg = svg.replace(/stroke="currentColor"/, 'stroke="#000"').replace(/stroke-width="2"/, 'stroke-width="2.4"');
    svg = svg.replace("<svg", '<svg style="background:#fff"');
    const size = 1024;
    const pad = 64;
    const raster = await sharp(Buffer.from(svg), { density: 3000 })
      .resize(size - pad * 2, size - pad * 2)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: "#ffffff" })
      .flatten({ background: "#ffffff" })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pgm = Buffer.concat([Buffer.from(`P5\n${raster.info.width} ${raster.info.height}\n255\n`), raster.data]);
    const pgmPath = path.join(out, id + ".pgm");
    fs.writeFileSync(pgmPath, pgm);
    execFileSync(potrace, ["--svg", "--turdsize", "20", "--alphamax", "1.0", "--opttolerance", "0.2", "-o", path.join(out, id + ".svg"), pgmPath]);
    fs.unlinkSync(pgmPath);
    console.log("traced", id);
  }
})();
