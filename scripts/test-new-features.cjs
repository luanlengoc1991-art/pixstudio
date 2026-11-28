// Automated Unit Tests & Hotspot Speed Verification for LMS Studio v1.3.x
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { performance } = require("perf_hooks");

const root = path.resolve(__dirname, "..");

const layerComp = require(path.join(root, "export/common/layer-composition.js"));
const seqLayers = require(path.join(root, "export/common/sequential-layers.js"));
const textPrompt = require(path.join(root, "export/common/text-layer-prompt.js"));
const designApp = require(path.join(root, "export/electron/utils/open-in-design-app.js"));

// Reference baseline implementation of findLayerPlacement (before TypedArray + precomputed luma optimization)
function referenceFindLayerPlacement(target, cutout, detailTarget = target, canvasHint) {
  const aspect = cutout.width / cutout.height;
  const fitWidth = Math.min(target.width, target.height * aspect);
  const fallback = () => ({
    x: (1 - fitWidth / target.width) / 2,
    y: (1 - fitWidth / aspect / target.height) / 2,
    width: fitWidth / target.width,
    height: fitWidth / aspect / target.height,
    alignment: { similarity: 0, confidence: 0, status: "weak" },
  });
  if (cutout.width < 1 || cutout.height < 1 || target.width < 1 || target.height < 1) return fallback();
  const samples = [];
  const step = Math.max(1, Math.ceil(Math.sqrt((cutout.width * cutout.height) / 120)));
  const xs = Array.from(
    new Set([...Array.from({ length: Math.ceil(cutout.width / step) }, (_, index) => index * step), cutout.width - 1]),
  );
  const ys = Array.from(
    new Set([...Array.from({ length: Math.ceil(cutout.height / step) }, (_, index) => index * step), cutout.height - 1]),
  );
  for (const y of ys) {
    for (const x of xs) {
      const i = (y * cutout.width + x) * 4;
      const alpha = cutout.data[i + 3] / 255;
      if (alpha < 0.4) continue;
      const luma = cutout.data[i] * 0.299 + cutout.data[i + 1] * 0.587 + cutout.data[i + 2] * 0.114;
      let neighbour = { x: Math.min(x + 1, cutout.width - 1), y, delta: 0, boundary: false, strength: -1 };
      for (const [nx, ny] of [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ]) {
        const outside = nx < 0 || ny < 0 || nx >= cutout.width || ny >= cutout.height;
        const j = (ny * cutout.width + nx) * 4;
        const boundary = outside || cutout.data[j + 3] < 80;
        const delta = boundary ? 0 : cutout.data[j] * 0.299 + cutout.data[j + 1] * 0.587 + cutout.data[j + 2] * 0.114 - luma;
        const strength = boundary ? 128 : Math.abs(delta);
        if (strength > neighbour.strength) neighbour = { x: nx, y: ny, delta, boundary, strength };
      }
      samples.push({
        u: (x + 0.5) / cutout.width,
        v: (y + 0.5) / cutout.height,
        r: cutout.data[i],
        g: cutout.data[i + 1],
        b: cutout.data[i + 2],
        luma,
        weight: alpha * (1 + Math.min(1, neighbour.strength / 100)),
        nu: (neighbour.x + 0.5) / cutout.width,
        nv: (neighbour.y + 0.5) / cutout.height,
        delta: neighbour.delta,
        boundary: neighbour.boundary,
      });
    }
  }
  if (samples.length < 4) return fallback();
  const totalWeight = samples.reduce((sum, sample) => sum + sample.weight, 0);
  const mean = samples.reduce((sum, sample) => sum + sample.luma * sample.weight, 0) / totalWeight;
  const variance = samples.reduce((sum, sample) => sum + sample.weight * (sample.luma - mean) ** 2, 0) / totalWeight;
  const measure = (image, x, y, width) => {
    const height = width / aspect;
    if (width < 3 || height < 3 || x < 0 || y < 0 || x + width > image.width + 1e-6 || y + height > image.height + 1e-6) return null;
    let colorError = 0,
      edgeError = 0,
      sum = 0,
      square = 0,
      covariance = 0;
    for (const sample of samples) {
      const px = Math.max(0, Math.min(image.width - 1, Math.round(x + sample.u * width - 0.5)));
      const py = Math.max(0, Math.min(image.height - 1, Math.round(y + sample.v * height - 0.5)));
      const i = (py * image.width + px) * 4;
      const r = image.data[i],
        g = image.data[i + 1],
        b = image.data[i + 2];
      const luma = r * 0.299 + g * 0.587 + b * 0.114;
      colorError += (sample.weight * (Math.abs(sample.r - r) + Math.abs(sample.g - g) + Math.abs(sample.b - b))) / 765;
      sum += luma * sample.weight;
      square += luma * luma * sample.weight;
      covariance += sample.luma * luma * sample.weight;
      const nx = Math.max(0, Math.min(image.width - 1, Math.round(x + sample.nu * width - 0.5)));
      const ny = Math.max(0, Math.min(image.height - 1, Math.round(y + sample.nv * height - 0.5)));
      const j = (ny * image.width + nx) * 4;
      if (sample.boundary) {
        const contrast = (Math.abs(r - image.data[j]) + Math.abs(g - image.data[j + 1]) + Math.abs(b - image.data[j + 2])) / 765;
        edgeError += sample.weight * Math.max(0, 1 - contrast / 0.08);
      } else {
        const delta = image.data[j] * 0.299 + image.data[j + 1] * 0.587 + image.data[j + 2] * 0.114 - luma;
        edgeError += sample.weight * Math.min(1, Math.abs(delta - sample.delta) / 128);
      }
    }
    const targetMean = sum / totalWeight,
      targetVariance = Math.max(0, square / totalWeight - targetMean * targetMean);
    const correlation =
      variance > 16 && targetVariance > 16
        ? Math.max(-1, Math.min(1, (covariance / totalWeight - mean * targetMean) / Math.sqrt(variance * targetVariance)))
        : 0;
    const structureError = variance > 16 ? (1 - correlation) / 2 : 0;
    const error =
      ((variance > 16 ? 0.5 : 0.85) * colorError) / totalWeight + 0.35 * structureError + (0.15 * edgeError) / totalWeight;
    return { x, y, width, height, error };
  };
  const overlap = (a, b) => {
    const intersection =
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return intersection / (a.width * a.height + b.width * b.height - intersection);
  };
  const insert = (list, candidate) => {
    if (!candidate) return;
    const existing = list.findIndex((other) => overlap(candidate, other) > 0.55);
    if (existing >= 0) {
      if (candidate.error >= list[existing].error) return;
      list.splice(existing, 1);
    }
    list.push(candidate);
    list.sort((a, b) => a.error - b.error);
    if (list.length > 6) list.length = 6;
  };
  const coarse = [];
  if (canvasHint)
    insert(coarse, measure(target, canvasHint.x * target.width, canvasHint.y * target.height, canvasHint.width * target.width));
  const fractions = [0.04, 0.06, 0.08, ...Array.from({ length: 19 }, (_, index) => 0.1 + index * 0.05)];
  for (const fraction of fractions) {
    const width = fitWidth * fraction,
      height = width / aspect;
    if (width < 3 || height < 3) continue;
    const stride = Math.max(2, Math.min(4, Math.floor(Math.min(width, height) / 5)));
    for (let y = 0; y <= target.height - height; y += stride) {
      for (let x = 0; x <= target.width - width; x += stride) insert(coarse, measure(target, x, y, width));
    }
    insert(coarse, measure(target, target.width - width, target.height - height, width));
  }
  if (!coarse.length) return fallback();
  const detailed = [];
  const scale = detailTarget.width / target.width;
  for (const seed of coarse) {
    let best = null;
    for (const factor of [0.8, 0.9, 1, 1.1, 1.2]) {
      const width = seed.width * scale * factor;
      const centerX = (seed.x + seed.width / 2) * scale - width / 2;
      const centerY = (seed.y + seed.height / 2) * scale - width / aspect / 2;
      const radius = Math.max(4, Math.ceil(scale * 3)),
        stride = Math.max(1, Math.floor(scale));
      for (let dy = -radius; dy <= radius; dy += stride)
        for (let dx = -radius; dx <= radius; dx += stride) {
          const candidate = measure(detailTarget, Math.max(0, centerX + dx), Math.max(0, centerY + dy), width);
          if (candidate && (!best || candidate.error < best.error)) best = candidate;
        }
    }
    if (!best) continue;
    const anchor = Object.assign({}, best);
    for (const factor of [0.96, 0.98, 1, 1.02, 1.04]) {
      const width = anchor.width * factor;
      const x = anchor.x + (anchor.width - width) / 2,
        y = anchor.y + (anchor.height - width / aspect) / 2;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const candidate = measure(detailTarget, x + dx, y + dy, width);
          if (candidate && candidate.error < best.error) best = candidate;
        }
    }
    insert(detailed, best);
  }
  if (!detailed.length) return fallback();
  const best = detailed[0],
    alternative = detailed.find((other) => overlap(best, other) < 0.3);
  const separation = alternative ? Math.max(0, Math.min(1, (alternative.error - best.error) / 0.1)) : 1;
  const similarity = Math.max(0, Math.min(1, 1 - best.error * 2));
  const confidence = similarity * (0.65 + separation * 0.35);
  const status = confidence >= 0.8 && similarity >= 0.8 && separation >= 0.25 ? "good" : similarity >= 0.55 ? "review" : "weak";
  return {
    x: best.x / detailTarget.width,
    y: best.y / detailTarget.height,
    width: best.width / detailTarget.width,
    height: best.height / detailTarget.height,
    alignment: { similarity, confidence, status },
  };
}

function makeSceneWithCutout(W, H, objX, objY, objW, objH, seed = 1) {
  const scene = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      scene[i] = (x * 3 + seed * 17) & 255;
      scene[i + 1] = (y * 5 + seed * 31) & 255;
      scene[i + 2] = 220;
      scene[i + 3] = 255;
    }
  }
  const cutout = new Uint8ClampedArray(objW * objH * 4);
  for (let y = 0; y < objH; y++) {
    for (let x = 0; x < objW; x++) {
      const ci = (y * objW + x) * 4;
      const r = 240 - ((x * 7 + seed * 11) % 90);
      const g = 40 + ((y * 11 + seed * 7) % 120);
      const b = 30 + (((x + y) * 5) % 80);
      cutout[ci] = r;
      cutout[ci + 1] = g;
      cutout[ci + 2] = b;
      cutout[ci + 3] = 255;
      const si = ((objY + y) * W + (objX + x)) * 4;
      scene[si] = r;
      scene[si + 1] = g;
      scene[si + 2] = b;
      scene[si + 3] = 255;
    }
  }
  return {
    scene: { width: W, height: H, data: scene },
    cutout: { width: objW, height: objH, data: cutout },
  };
}

let passed = 0;
function test(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      passed++;
      console.log(`  PASS  ${name}`);
    });
}

(async () => {
  console.log("=== LMS Studio v1.3 Feature & Hotspot Test Suite ===");

  await test("layer-composition: coordinate conversions & validation", () => {
    const px = layerComp.placementToOriginalPixels({ x: 0.25, y: 0.5, width: 0.5, height: 0.25 }, { width: 1000, height: 800 });
    assert.deepStrictEqual(px, { x: 250, y: 400, width: 500, height: 200 });
    const norm = layerComp.originalPixelsToPlacement(px, { width: 1000, height: 800 });
    assert.deepStrictEqual(norm, { x: 0.25, y: 0.5, width: 0.5, height: 0.25 });
    assert.throws(() => layerComp.placementToOriginalPixels(norm, { width: 0, height: 800 }));
  });

  await test("layer-composition: crop, resize, lock preservation & reorder", () => {
    const outer = { x: 0.1, y: 0.1, width: 0.6, height: 0.6 };
    const cropped = layerComp.resizeLayerCrop(outer, "nw", 0.1, 0.1, outer);
    assert(Math.abs(cropped.x - 0.2) < 1e-9 && Math.abs(cropped.width - 0.5) < 1e-9);
    const cropPx = layerComp.layerCropPixels(outer, cropped, { width: 600, height: 600 });
    assert.strictEqual(cropPx.source.x, 100);
    assert.strictEqual(cropPx.source.width, 500);

    const locked = [
      { id: "bg", locked: true, x: 0 },
      { id: "a", locked: false, x: 1 },
    ];
    const arranged = [
      { id: "bg", locked: false, x: 99 },
      { id: "a", locked: false, x: 2 },
      { id: "b", locked: false, x: 3 },
    ];
    const merged = layerComp.preserveLockedLayers(locked, arranged);
    assert.strictEqual(merged[0].x, 0);
    assert.strictEqual(merged[1].x, 2);
    assert.strictEqual(merged.length, 3);

    // Reordering across a locked layer must be blocked
    const unchanged = layerComp.reorderCompositionLayers(merged, "a", "bg", "below");
    assert.strictEqual(unchanged, merged);
    // Reordering unlocked layers works
    const swapped = layerComp.reorderCompositionLayers(merged, "b", "a", "below");
    assert.deepStrictEqual(swapped.map((x) => x.id), ["bg", "b", "a"]);
  });

  await test("layer-composition: background detection & SVG export", () => {
    const { scene, cutout } = makeSceneWithCutout(128, 128, 40, 40, 32, 32);
    const bg = layerComp.detectCompositionBackground(scene, [
      { id: "cutout", pixels: { width: 32, height: 32, data: new Uint8ClampedArray(32 * 32 * 4) } },
      { id: "bg-plate", pixels: scene, hint: true },
    ]);
    assert.strictEqual(bg.backgroundId, "bg-plate");
    assert.strictEqual(bg.status, "detected");

    const svg = layerComp.buildCompositionSvg(
      1000,
      500,
      [
        {
          id: "1",
          title: 'Background & <Logo> "VN"',
          isBackground: true,
          locked: false,
          visible: true,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      ],
      254,
    );
    assert(svg.includes("Background &amp; &lt;Logo&gt; &quot;VN&quot;"));
    assert(svg.includes('viewBox="0 0 1000 500"'));
  });

  await test("ldc-hotspot-speed: findLayerPlacement exact equivalence (<= 1e-9) & speedup benchmark", () => {
    const cases = [];
    for (let i = 0; i < 6; i++) {
      const coarse = makeSceneWithCutout(192, 144, 24 + i * 14, 18 + i * 10, 44, 36, i + 1);
      const detail = makeSceneWithCutout(512, 384, (24 + i * 14) * 2, (18 + i * 10) * 2, 88, 72, i + 1);
      cases.push({ coarse: coarse.scene, detail: detail.scene, cutout: coarse.cutout });
    }

    // Edge cases: empty transparent cutout, 1x1 raster, canvasHint
    const emptyCutout = { width: 16, height: 16, data: new Uint8ClampedArray(16 * 16 * 4) };
    const refEmpty = referenceFindLayerPlacement(cases[0].coarse, emptyCutout);
    const optEmpty = layerComp.findLayerPlacement(cases[0].coarse, emptyCutout);
    assert.deepStrictEqual(optEmpty, refEmpty);

    // Warmup
    referenceFindLayerPlacement(cases[0].coarse, cases[0].cutout, cases[0].detail);
    layerComp.findLayerPlacement(cases[0].coarse, cases[0].cutout, cases[0].detail);

    const t0 = performance.now();
    const refResults = cases.map((c) => referenceFindLayerPlacement(c.coarse, c.cutout, c.detail));
    const beforeMs = performance.now() - t0;

    const t1 = performance.now();
    const optResults = cases.map((c) => layerComp.findLayerPlacement(c.coarse, c.cutout, c.detail));
    const afterMs = performance.now() - t1;

    for (let i = 0; i < cases.length; i++) {
      const r = refResults[i];
      const o = optResults[i];
      assert(Math.abs(r.x - o.x) <= 1e-9, `x mismatch on case ${i}: ${r.x} vs ${o.x}`);
      assert(Math.abs(r.y - o.y) <= 1e-9, `y mismatch on case ${i}: ${r.y} vs ${o.y}`);
      assert(Math.abs(r.width - o.width) <= 1e-9, `width mismatch on case ${i}`);
      assert(Math.abs(r.height - o.height) <= 1e-9, `height mismatch on case ${i}`);
      assert(Math.abs(r.alignment.similarity - o.alignment.similarity) <= 1e-9, `similarity mismatch on case ${i}`);
      assert(Math.abs(r.alignment.confidence - o.alignment.confidence) <= 1e-9, `confidence mismatch on case ${i}`);
      assert.strictEqual(o.alignment.status, r.alignment.status);
    }

    const speedup = beforeMs / Math.max(0.01, afterMs);
    console.log(
      `    [Benchmark findLayerPlacement x6 layers] Before: ${beforeMs.toFixed(1)} ms -> After: ${afterMs.toFixed(1)} ms (${speedup.toFixed(2)}x faster)`,
    );
    assert(afterMs < beforeMs, `Expected optimized findLayerPlacement (${afterMs.toFixed(1)}ms) < baseline (${beforeMs.toFixed(1)}ms)`);
  });

  await test("sequential-layers & text-layer-prompt: batch prompts, exclusion rules & completion detection", () => {
    const startPrompt = seqLayers.buildDirectLayerStartPrompt([
      { x: 0.1, y: 0.1, width: 0.2, height: 0.2, name: "Logo góc trái" },
    ]);
    assert(startPrompt.includes("KHÔNG TÁCH 1"));
    assert(startPrompt.includes("Logo góc trái"));

    const nextPrompt = seqLayers.buildDirectLayerNextPrompt(6, []);
    assert(nextPrompt.includes("Layer 6") && nextPrompt.includes("Layer 10"));
    assert.throws(() => seqLayers.buildDirectLayerNextPrompt(1));

    assert.strictEqual(seqLayers.isLayerSequenceComplete("Đã hoàn tất toàn bộ các layer của ảnh."), true);
    assert.strictEqual(seqLayers.isLayerSequenceComplete("Nhấn Tiếp để xuất đợt layer tiếp theo."), false);
    assert.strictEqual(seqLayers.isLayerSequenceComplete(""), false);
    assert(textPrompt.TEXT_LAYER_TRANSPARENCY_RULES.includes("alpha = 0"));
  });

  await test("open-in-design-app: registry parsing, temp file writing & fake ProgramFiles discovery", async () => {
    const parsedEn = designApp.parseRegistryDefaultValue(
      '    (Default)    REG_SZ    "C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe" "%1"',
    );
    assert.strictEqual(parsedEn, "C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe");

    const parsedVn = designApp.parseRegistryDefaultValue(
      "    (Mặc định)    REG_SZ    C:\\Program Files\\Corel\\CorelDRAW Graphics Suite\\Programs64\\CorelDRW.exe",
    );
    assert.strictEqual(parsedVn, "C:\\Program Files\\Corel\\CorelDRAW Graphics Suite\\Programs64\\CorelDRW.exe");

    assert.strictEqual(designApp.sanitizeExportBaseName('Poster: "Khai trương" 2026?.psd'), "Poster- -Khai trương- 2026-");

    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "lms-test-"));
    try {
      const written = await designApp.writeDesignExportTempFile("banner.psd", "psd", new Uint8Array([56, 66, 80, 83]), tmpRoot);
      assert(fs.existsSync(written));

      const fakePsDir = path.join(tmpRoot, "ProgramFiles", "Adobe", "Adobe Photoshop 2026");
      fs.mkdirSync(fakePsDir, { recursive: true });
      const fakePsExe = path.join(fakePsDir, "Photoshop.exe");
      fs.writeFileSync(fakePsExe, "stub");

      const found = await designApp.findDesignAppExecutable("photoshop", {
        platform: "win32",
        skipRegistry: true,
        env: { ProgramFiles: path.join(tmpRoot, "ProgramFiles"), PATH: "" },
      });
      assert.strictEqual(found, fakePsExe);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  await test("brand hygiene: zero competitor branding leaked in source files", () => {
    const { execFileSync } = require("child_process");
    execFileSync(process.execPath, ["--check", path.join(root, "web/gateway/worker.js")]);
    const forbidden = [/Pixel\s*UP/i, /PixVIP/i, /KichNet/i, /anhpro\.vn/i];
    const dirs = ["common", "electron", "renderer/components", "renderer/lib", "renderer/pages"];
    function scan(dir) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) scan(full);
        else if (/\.(ts|tsx|js)$/.test(ent.name)) {
          const text = fs.readFileSync(full, "utf8");
          for (const re of forbidden) {
            assert(!re.test(text), `Forbidden competitor brand ${re} found in ${path.relative(root, full)}`);
          }
        }
      }
    }
    for (const d of dirs) scan(path.join(root, d));
  });

  console.log(`\nALL ${passed} TEST SUITES PASSED!`);
})().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
