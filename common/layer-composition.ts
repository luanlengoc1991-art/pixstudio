export interface LayerPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelSize {
  width: number;
  height: number;
}

export interface PixelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RasterPixels {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
}

export type AlignmentStatus = "good" | "review" | "weak" | "manual";

export interface LayerAlignment {
  similarity: number;
  confidence: number;
  status: AlignmentStatus;
}

export interface AlignedPlacement extends LayerPlacement {
  alignment: LayerAlignment;
}

export interface CompositionLayerItem extends LayerPlacement {
  id: string;
  title: string;
  isBackground: boolean;
  locked: boolean;
  visible: boolean;
  dataUrl: string;
  alignment?: LayerAlignment;
}

export interface BackgroundCandidate {
  id: string;
  pixels: RasterPixels;
  hint?: boolean;
}

export interface BackgroundDetection {
  backgroundId: string | null;
  status: "detected" | "manual" | "uncertain" | "missing";
}

export type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

export function placementToOriginalPixels(placement: LayerPlacement, image: PixelSize): PixelBounds {
  if (![image.width, image.height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Kích thước ảnh gốc không hợp lệ.");
  }
  return {
    x: placement.x * image.width,
    y: placement.y * image.height,
    width: placement.width * image.width,
    height: placement.height * image.height,
  };
}

export function originalPixelsToPlacement(bounds: PixelBounds, image: PixelSize): LayerPlacement {
  if (
    ![image.width, image.height].every((value) => Number.isFinite(value) && value > 0) ||
    ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  ) {
    throw new Error("Tọa độ hoặc kích thước không hợp lệ.");
  }
  return {
    x: bounds.x / image.width,
    y: bounds.y / image.height,
    width: bounds.width / image.width,
    height: bounds.height / image.height,
  };
}

/** Resize a crop rectangle inside its layer without scaling or moving the artwork. */
export function resizeLayerCrop(
  start: LayerPlacement,
  handle: ResizeHandle | string,
  dx: number,
  dy: number,
  outer: LayerPlacement,
): LayerPlacement {
  const minWidth = Math.min(0.001, outer.width);
  const minHeight = Math.min(0.001, outer.height);
  if (handle.includes("w")) {
    dx = Math.max(outer.x - start.x, Math.min(start.width - minWidth, dx));
  } else if (handle.includes("e")) {
    dx = Math.max(minWidth - start.width, Math.min(outer.x + outer.width - start.x - start.width, dx));
  }
  if (handle.includes("n")) {
    dy = Math.max(outer.y - start.y, Math.min(start.height - minHeight, dy));
  } else if (handle.includes("s")) {
    dy = Math.max(minHeight - start.height, Math.min(outer.y + outer.height - start.y - start.height, dy));
  }
  const x = handle.includes("w") ? start.x + dx : start.x;
  const y = handle.includes("n") ? start.y + dy : start.y;
  return {
    x,
    y,
    width: start.width + (handle.includes("w") ? -dx : handle.includes("e") ? dx : 0),
    height: start.height + (handle.includes("n") ? -dy : handle.includes("s") ? dy : 0),
  };
}

export function layerCropPixels(
  layer: LayerPlacement,
  crop: LayerPlacement,
  image: PixelSize,
): { source: PixelBounds; placement: LayerPlacement } {
  if (
    ![layer.x, layer.y, layer.width, layer.height, crop.x, crop.y, crop.width, crop.height, image.width, image.height].every(
      Number.isFinite,
    ) ||
    layer.width <= 0 ||
    layer.height <= 0 ||
    crop.width <= 0 ||
    crop.height <= 0 ||
    image.width < 1 ||
    image.height < 1
  ) {
    throw new Error("Khung cắt không hợp lệ.");
  }
  const x = Math.max(0, Math.min(image.width - 1, Math.floor(((crop.x - layer.x) / layer.width) * image.width + 1e-7)));
  const y = Math.max(0, Math.min(image.height - 1, Math.floor(((crop.y - layer.y) / layer.height) * image.height + 1e-7)));
  const right = Math.max(
    x + 1,
    Math.min(image.width, Math.ceil(((crop.x + crop.width - layer.x) / layer.width) * image.width - 1e-7)),
  );
  const bottom = Math.max(
    y + 1,
    Math.min(image.height, Math.ceil(((crop.y + crop.height - layer.y) / layer.height) * image.height - 1e-7)),
  );
  const width = right - x;
  const height = bottom - y;
  return {
    source: { x, y, width, height },
    placement: {
      x: layer.x + (x / image.width) * layer.width,
      y: layer.y + (y / image.height) * layer.height,
      width: (width / image.width) * layer.width,
      height: (height / image.height) * layer.height,
    },
  };
}

export function resizeLayerPlacement(
  start: LayerPlacement,
  corner: ResizeHandle | string,
  dx: number,
  dy: number,
  keepAspect: boolean,
): LayerPlacement {
  if (![dx, dy, start.width, start.height].every(Number.isFinite) || start.width <= 0 || start.height <= 0) {
    return { ...start };
  }
  const west = corner.endsWith("w");
  const north = corner.startsWith("n");
  const horizontal = corner.includes("w") || corner.includes("e");
  const vertical = corner.includes("n") || corner.includes("s");
  let width = start.width + (horizontal ? (west ? -dx : dx) : 0);
  let height = start.height + (vertical ? (north ? -dy : dy) : 0);
  const maxWidth = Math.max(0.005, west ? start.x + start.width : 1 - start.x);
  const maxHeight = Math.max(0.005, north ? start.y + start.height : 1 - start.y);
  if (keepAspect && horizontal && vertical) {
    const changeX = width / start.width - 1;
    const changeY = height / start.height - 1;
    const factor = Math.max(
      Math.max(0.005 / start.width, 0.005 / start.height),
      Math.min(
        Math.min(maxWidth / start.width, maxHeight / start.height),
        1 + (Math.abs(changeX) >= Math.abs(changeY) ? changeX : changeY),
      ),
    );
    width = start.width * factor;
    height = start.height * factor;
  } else {
    if (horizontal) width = Math.max(0.005, Math.min(maxWidth, width));
    if (vertical) height = Math.max(0.005, Math.min(maxHeight, height));
  }
  return {
    x: west ? start.x + start.width - width : start.x,
    y: north ? start.y + start.height - height : start.y,
    width,
    height,
  };
}

export function preserveLockedLayers<T extends { id: string; locked?: boolean }>(previous: T[], arranged: T[]): T[] {
  if (!previous.some((layer) => layer.locked)) return arranged;
  const next = new Map(arranged.map((layer) => [layer.id, layer]));
  const oldIds = new Set(previous.map((layer) => layer.id));
  return [
    ...previous.filter((layer) => next.has(layer.id)).map((layer) => (layer.locked ? layer : next.get(layer.id)!)),
    ...arranged.filter((layer) => !oldIds.has(layer.id)),
  ];
}

/** The array is back-to-front; the sidebar displays it in reverse. Locked indices stay fixed. */
export function reorderCompositionLayers<T extends { id: string; locked?: boolean }>(
  layers: T[],
  sourceId: string,
  targetId: string,
  placement: "above" | "below",
): T[] {
  const sourceIndex = layers.findIndex((layer) => layer.id === sourceId);
  if (sourceIndex < 0 || sourceId === targetId || layers[sourceIndex].locked) return layers;
  const remaining = layers.filter((layer) => layer.id !== sourceId);
  const targetIndex = remaining.findIndex((layer) => layer.id === targetId);
  if (targetIndex < 0) return layers;
  const newIndex = targetIndex + (placement === "above" ? 1 : 0);
  if (sourceIndex === newIndex) return layers;
  const start = Math.min(sourceIndex, newIndex);
  const end = Math.max(sourceIndex, newIndex);
  if (layers.slice(start, end + 1).some((layer) => layer.locked)) return layers;
  const next = [...remaining];
  next.splice(newIndex, 0, layers[sourceIndex]);
  return next;
}

/** Judge actual image coverage and its border against the source, independently of list order. */
export function detectCompositionBackground(
  original: RasterPixels,
  candidates: BackgroundCandidate[],
): BackgroundDetection {
  const ranked: { id: string; score: number; borderError: number }[] = [];
  for (const candidate of candidates) {
    const image = candidate.pixels;
    let opaque = 0;
    for (let index = 3; index < image.data.length; index += 4) {
      if (image.data[index] >= 245) opaque++;
    }
    const coverage = opaque / (image.width * image.height);
    if (coverage < 0.92) continue;
    const errors: number[] = [];
    let opaqueBorder = 0;
    for (let index = 0; index < 32; index++) {
      const fraction = index / 31;
      for (const [u, v] of [
        [fraction, 0.01],
        [fraction, 0.99],
        [0.01, fraction],
        [0.99, fraction],
      ] as const) {
        const i =
          (Math.min(image.height - 1, Math.floor(v * image.height)) * image.width +
            Math.min(image.width - 1, Math.floor(u * image.width))) *
          4;
        const j =
          (Math.min(original.height - 1, Math.floor(v * original.height)) * original.width +
            Math.min(original.width - 1, Math.floor(u * original.width))) *
          4;
        if (image.data[i + 3] >= 245) opaqueBorder++;
        errors.push(
          (Math.abs(image.data[i] - original.data[j]) +
            Math.abs(image.data[i + 1] - original.data[j + 1]) +
            Math.abs(image.data[i + 2] - original.data[j + 2])) /
            765,
        );
      }
    }
    const borderCoverage = opaqueBorder / errors.length;
    if (borderCoverage < 0.95) continue;
    errors.sort((a, b) => a - b);
    const kept = errors.slice(0, Math.ceil(errors.length * 0.7));
    const borderError = kept.reduce((sum, error) => sum + error, 0) / kept.length;
    const aspect = Math.exp(-2 * Math.abs(Math.log(image.width / image.height / (original.width / original.height))));
    const score =
      coverage * 0.28 +
      borderCoverage * 0.18 +
      aspect * 0.2 +
      (1 - borderError) * 0.34 +
      (candidate.hint ? 0.01 : 0);
    ranked.push({ id: candidate.id, score, borderError });
  }
  ranked.sort((a, b) => b.score - a.score);
  if (!ranked.length) return { backgroundId: null, status: "missing" };
  const best = ranked[0];
  if (best.score < 0.85 || best.borderError > 0.22 || (ranked[1] && best.score - ranked[1].score < 0.035)) {
    return { backgroundId: null, status: "uncertain" };
  }
  return { backgroundId: best.id, status: "detected" };
}

interface CandidateScore {
  x: number;
  y: number;
  width: number;
  height: number;
  error: number;
}

const buildLumaPlane = (image: RasterPixels): Float64Array => {
  const area = image.width * image.height;
  const plane = new Float64Array(area);
  const d = image.data;
  for (let p = 0, i = 0; p < area; p++, i += 4) {
    plane[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  }
  return plane;
};

/**
 * Optimized TypedArray multi-scale template matcher (ldc-hotspot-speed).
 * Matches color, contrast and contours on a coarse raster, then refines top-6
 * distinct hypotheses on a high-resolution detail raster.
 * Produces 100% bit-equivalent results (<= 1e-9) to the reference implementation
 * while avoiding millions of heap object property lookups and redundant luma math.
 */
export function findLayerPlacement(
  target: RasterPixels,
  cutout: RasterPixels,
  detailTarget: RasterPixels = target,
  canvasHint?: LayerPlacement,
): AlignedPlacement {
  const aspect = cutout.width / cutout.height;
  const fitWidth = Math.min(target.width, target.height * aspect);
  const fallback = (): AlignedPlacement => ({
    x: (1 - fitWidth / target.width) / 2,
    y: (1 - fitWidth / aspect / target.height) / 2,
    width: fitWidth / target.width,
    height: fitWidth / aspect / target.height,
    alignment: { similarity: 0, confidence: 0, status: "weak" },
  });
  if (cutout.width < 1 || cutout.height < 1 || target.width < 1 || target.height < 1) return fallback();

  const step = Math.max(1, Math.ceil(Math.sqrt((cutout.width * cutout.height) / 120)));
  const xs = Array.from(
    new Set([...Array.from({ length: Math.ceil(cutout.width / step) }, (_, index) => index * step), cutout.width - 1]),
  );
  const ys = Array.from(
    new Set([...Array.from({ length: Math.ceil(cutout.height / step) }, (_, index) => index * step), cutout.height - 1]),
  );

  const maxSamples = xs.length * ys.length;
  const sU = new Float64Array(maxSamples);
  const sV = new Float64Array(maxSamples);
  const sR = new Uint8Array(maxSamples);
  const sG = new Uint8Array(maxSamples);
  const sB = new Uint8Array(maxSamples);
  const sLuma = new Float64Array(maxSamples);
  const sWeight = new Float64Array(maxSamples);
  const sNu = new Float64Array(maxSamples);
  const sNv = new Float64Array(maxSamples);
  const sDelta = new Float64Array(maxSamples);
  const sBoundary = new Uint8Array(maxSamples);
  let sampleCount = 0;

  const cData = cutout.data;
  const cw = cutout.width;
  const ch = cutout.height;
  for (let yi = 0; yi < ys.length; yi++) {
    const y = ys[yi];
    for (let xi = 0; xi < xs.length; xi++) {
      const x = xs[xi];
      const i = (y * cw + x) * 4;
      const alpha = cData[i + 3] / 255;
      if (alpha < 0.4) continue;
      const luma = cData[i] * 0.299 + cData[i + 1] * 0.587 + cData[i + 2] * 0.114;
      let bestNx = Math.min(x + 1, cw - 1);
      let bestNy = y;
      let bestDelta = 0;
      let bestBoundary = 0;
      let bestStrength = -1;
      const dirs: [number, number][] = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (let dIdx = 0; dIdx < 4; dIdx++) {
        const nx = dirs[dIdx][0];
        const ny = dirs[dIdx][1];
        const outside = nx < 0 || ny < 0 || nx >= cw || ny >= ch;
        const j = (ny * cw + nx) * 4;
        const boundary = outside || cData[j + 3] < 80;
        const delta = boundary ? 0 : cData[j] * 0.299 + cData[j + 1] * 0.587 + cData[j + 2] * 0.114 - luma;
        const strength = boundary ? 128 : Math.abs(delta);
        if (strength > bestStrength) {
          bestNx = nx;
          bestNy = ny;
          bestDelta = delta;
          bestBoundary = boundary ? 1 : 0;
          bestStrength = strength;
        }
      }
      sU[sampleCount] = (x + 0.5) / cw;
      sV[sampleCount] = (y + 0.5) / ch;
      sR[sampleCount] = cData[i];
      sG[sampleCount] = cData[i + 1];
      sB[sampleCount] = cData[i + 2];
      sLuma[sampleCount] = luma;
      sWeight[sampleCount] = alpha * (1 + Math.min(1, bestStrength / 100));
      sNu[sampleCount] = (bestNx + 0.5) / cw;
      sNv[sampleCount] = (bestNy + 0.5) / ch;
      sDelta[sampleCount] = bestDelta;
      sBoundary[sampleCount] = bestBoundary;
      sampleCount++;
    }
  }
  if (sampleCount < 4) return fallback();

  let totalWeight = 0;
  let weightedLuma = 0;
  for (let k = 0; k < sampleCount; k++) {
    totalWeight += sWeight[k];
    weightedLuma += sLuma[k] * sWeight[k];
  }
  const mean = weightedLuma / totalWeight;
  let weightedVar = 0;
  for (let k = 0; k < sampleCount; k++) {
    const diff = sLuma[k] - mean;
    weightedVar += sWeight[k] * diff * diff;
  }
  const variance = weightedVar / totalWeight;
  const colorWeightFactor = variance > 16 ? 0.5 : 0.85;
  const inv765 = 1 / 765;
  const inv128 = 1 / 128;

  const targetLuma = buildLumaPlane(target);
  const detailLuma = detailTarget === target ? targetLuma : buildLumaPlane(detailTarget);

  const rowV = new Int32Array(sampleCount);
  const rowNv = new Int32Array(sampleCount);
  const colU = new Int32Array(sampleCount);
  const colNu = new Int32Array(sampleCount);

  const fillRowOffsets = (iw: number, maxPy: number, y: number, height: number) => {
    for (let k = 0; k < sampleCount; k++) {
      let py = Math.round(y + sV[k] * height - 0.5);
      if (py < 0) py = 0;
      else if (py > maxPy) py = maxPy;
      rowV[k] = py * iw;

      let ny = Math.round(y + sNv[k] * height - 0.5);
      if (ny < 0) ny = 0;
      else if (ny > maxPy) ny = maxPy;
      rowNv[k] = ny * iw;
    }
  };

  const fillColOffsets = (maxPx: number, x: number, width: number) => {
    for (let k = 0; k < sampleCount; k++) {
      let px = Math.round(x + sU[k] * width - 0.5);
      if (px < 0) px = 0;
      else if (px > maxPx) px = maxPx;
      colU[k] = px;

      let nx = Math.round(x + sNu[k] * width - 0.5);
      if (nx < 0) nx = 0;
      else if (nx > maxPx) nx = maxPx;
      colNu[k] = nx;
    }
  };

  const scorePrecomputed = (
    imgData: Uint8ClampedArray | Uint8Array,
    lumaPlane: Float64Array,
    x: number,
    y: number,
    width: number,
    height: number,
  ): CandidateScore => {
    let colorError = 0;
    let edgeError = 0;
    let sum = 0;
    let square = 0;
    let covariance = 0;

    for (let k = 0; k < sampleCount; k++) {
      const pIdx = rowV[k] + colU[k];
      const i = pIdx << 2;
      const r = imgData[i];
      const g = imgData[i + 1];
      const b = imgData[i + 2];
      const luma = lumaPlane[pIdx];
      const w = sWeight[k];

      const dr = sR[k] - r;
      const dg = sG[k] - g;
      const db = sB[k] - b;
      colorError += w * ((dr < 0 ? -dr : dr) + (dg < 0 ? -dg : dg) + (db < 0 ? -db : db)) * inv765;
      sum += luma * w;
      square += luma * luma * w;
      covariance += sLuma[k] * luma * w;

      const nIdx = rowNv[k] + colNu[k];
      if (sBoundary[k]) {
        const j = nIdx << 2;
        const cr = r - imgData[j];
        const cg = g - imgData[j + 1];
        const cb = b - imgData[j + 2];
        const contrast = ((cr < 0 ? -cr : cr) + (cg < 0 ? -cg : cg) + (cb < 0 ? -cb : cb)) * inv765;
        const pen = 1 - contrast * 12.5;
        if (pen > 0) edgeError += w * pen;
      } else {
        const diff = lumaPlane[nIdx] - luma - sDelta[k];
        const pen = (diff < 0 ? -diff : diff) * inv128;
        edgeError += w * (pen < 1 ? pen : 1);
      }
    }

    const targetMean = sum / totalWeight;
    const targetVariance = Math.max(0, square / totalWeight - targetMean * targetMean);
    const correlation =
      variance > 16 && targetVariance > 16
        ? Math.max(-1, Math.min(1, (covariance / totalWeight - mean * targetMean) / Math.sqrt(variance * targetVariance)))
        : 0;
    const structureError = variance > 16 ? (1 - correlation) / 2 : 0;
    const error = (colorWeightFactor * colorError) / totalWeight + 0.35 * structureError + (0.15 * edgeError) / totalWeight;
    return { x, y, width, height, error };
  };

  const measure = (image: RasterPixels, lumaPlane: Float64Array, x: number, y: number, width: number): CandidateScore | null => {
    const height = width / aspect;
    const iw = image.width;
    const ih = image.height;
    if (width < 3 || height < 3 || x < 0 || y < 0 || x + width > iw + 1e-6 || y + height > ih + 1e-6) {
      return null;
    }
    fillRowOffsets(iw, ih - 1, y, height);
    fillColOffsets(iw - 1, x, width);
    return scorePrecomputed(image.data, lumaPlane, x, y, width, height);
  };

  const measureGrid = (
    image: RasterPixels,
    lumaPlane: Float64Array,
    xsList: number[],
    ysList: number[],
    width: number,
    onScore: (cand: CandidateScore) => void,
  ) => {
    const height = width / aspect;
    const iw = image.width;
    const ih = image.height;
    if (width < 3 || height < 3) return;
    const maxPx = iw - 1;
    const maxPy = ih - 1;
    const validXs: number[] = [];
    for (let xi = 0; xi < xsList.length; xi++) {
      const x = xsList[xi];
      if (x >= 0 && x + width <= iw + 1e-6) validXs.push(x);
    }
    if (!validXs.length) return;

    const allColU = new Int32Array(validXs.length * sampleCount);
    const allColNu = new Int32Array(validXs.length * sampleCount);
    for (let xi = 0; xi < validXs.length; xi++) {
      const x = validXs[xi];
      const base = xi * sampleCount;
      for (let k = 0; k < sampleCount; k++) {
        let px = Math.round(x + sU[k] * width - 0.5);
        if (px < 0) px = 0;
        else if (px > maxPx) px = maxPx;
        allColU[base + k] = px;

        let nx = Math.round(x + sNu[k] * width - 0.5);
        if (nx < 0) nx = 0;
        else if (nx > maxPx) nx = maxPx;
        allColNu[base + k] = nx;
      }
    }

    const imgData = image.data;
    for (let yi = 0; yi < ysList.length; yi++) {
      const y = ysList[yi];
      if (y < 0 || y + height > ih + 1e-6) continue;
      fillRowOffsets(iw, maxPy, y, height);
      for (let xi = 0; xi < validXs.length; xi++) {
        const base = xi * sampleCount;
        for (let k = 0; k < sampleCount; k++) {
          colU[k] = allColU[base + k];
          colNu[k] = allColNu[base + k];
        }
        onScore(scorePrecomputed(imgData, lumaPlane, validXs[xi], y, width, height));
      }
    }
  };

  const overlap = (a: CandidateScore, b: CandidateScore) => {
    const intersection =
      Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
      Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
    return intersection / (a.width * a.height + b.width * b.height - intersection);
  };

  const insert = (list: CandidateScore[], candidate: CandidateScore | null) => {
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

  const coarse: CandidateScore[] = [];
  if (canvasHint) {
    insert(
      coarse,
      measure(target, targetLuma, canvasHint.x * target.width, canvasHint.y * target.height, canvasHint.width * target.width),
    );
  }
  const fractions = [0.04, 0.06, 0.08, ...Array.from({ length: 19 }, (_, index) => 0.1 + index * 0.05)];
  for (const fraction of fractions) {
    const width = fitWidth * fraction;
    const height = width / aspect;
    if (width < 3 || height < 3) continue;
    const stride = Math.max(2, Math.min(4, Math.floor(Math.min(width, height) / 5)));
    const xsGrid: number[] = [];
    const ysGrid: number[] = [];
    for (let x = 0; x <= target.width - width; x += stride) xsGrid.push(x);
    for (let y = 0; y <= target.height - height; y += stride) ysGrid.push(y);
    measureGrid(target, targetLuma, xsGrid, ysGrid, width, (cand) => insert(coarse, cand));
    insert(coarse, measure(target, targetLuma, target.width - width, target.height - height, width));
  }
  if (!coarse.length) return fallback();

  const detailed: CandidateScore[] = [];
  const scale = detailTarget.width / target.width;
  for (const seed of coarse) {
    let best: CandidateScore | null = null;
    for (const factor of [0.8, 0.9, 1, 1.1, 1.2]) {
      const width = seed.width * scale * factor;
      const centerX = (seed.x + seed.width / 2) * scale - width / 2;
      const centerY = (seed.y + seed.height / 2) * scale - width / aspect / 2;
      const radius = Math.max(4, Math.ceil(scale * 3));
      const stride = Math.max(1, Math.floor(scale));
      const xsRef: number[] = [];
      const ysRef: number[] = [];
      for (let dx = -radius; dx <= radius; dx += stride) xsRef.push(Math.max(0, centerX + dx));
      for (let dy = -radius; dy <= radius; dy += stride) ysRef.push(Math.max(0, centerY + dy));
      measureGrid(detailTarget, detailLuma, xsRef, ysRef, width, (candidate) => {
        if (!best || candidate.error < best.error) best = candidate;
      });
    }
    if (!best) continue;
    const anchor = { ...(best as CandidateScore) };
    for (const factor of [0.96, 0.98, 1, 1.02, 1.04]) {
      const width = anchor.width * factor;
      const x = anchor.x + (anchor.width - width) / 2;
      const y = anchor.y + (anchor.height - width / aspect) / 2;
      const xsFine = [x - 2, x - 1, x, x + 1, x + 2];
      const ysFine = [y - 2, y - 1, y, y + 1, y + 2];
      measureGrid(detailTarget, detailLuma, xsFine, ysFine, width, (candidate) => {
        if (candidate.error < best!.error) best = candidate;
      });
    }
    insert(detailed, best);
  }
  if (!detailed.length) return fallback();

  const best = detailed[0];
  const alternative = detailed.find((other) => overlap(best, other) < 0.3);
  const separation = alternative ? Math.max(0, Math.min(1, (alternative.error - best.error) / 0.1)) : 1;
  const similarity = Math.max(0, Math.min(1, 1 - best.error * 2));
  const confidence = similarity * (0.65 + separation * 0.35);
  const status: AlignmentStatus =
    confidence >= 0.8 && similarity >= 0.8 && separation >= 0.25 ? "good" : similarity >= 0.55 ? "review" : "weak";

  return {
    x: best.x / detailTarget.width,
    y: best.y / detailTarget.height,
    width: best.width / detailTarget.width,
    height: best.height / detailTarget.height,
    alignment: { similarity, confidence, status },
  };
}

export function getAlphaBounds(image: RasterPixels, alphaThreshold = 12): PixelBounds {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] <= alphaThreshold) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) {
    throw new Error("Layer hoàn toàn trong suốt, không có đối tượng để ghép.");
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Keep one SVG image per layer; do not flatten the composition into a canvas bitmap. */
export function buildCompositionSvg(
  width: number,
  height: number,
  layers: CompositionLayerItem[],
  widthMm: number,
): string {
  if (![width, height, widthMm].every((value) => Number.isFinite(value) && value > 0) || widthMm > 2000) {
    throw new Error("Kích thước trang không hợp lệ (chiều rộng PDF tối đa 2000 mm).");
  }
  const visible = layers.filter((layer) => layer.visible);
  if (!visible.length) {
    throw new Error("Cần ít nhất một layer đang hiển thị để xuất PDF.");
  }
  const images = visible
    .map((layer, index) => {
      if (
        !/^data:image\/png;base64,[a-z0-9+/]+=*$/i.test(layer.dataUrl) ||
        ![layer.x, layer.y, layer.width, layer.height].every(Number.isFinite) ||
        layer.width <= 0 ||
        layer.height <= 0
      ) {
        throw new Error(`Layer ${index + 1} có ảnh hoặc vị trí không hợp lệ.`);
      }
      return `<image id="layer-${index + 1}" x="${layer.x * width}" y="${layer.y * height}" width="${layer.width * width}" height="${layer.height * height}" preserveAspectRatio="none" href="${layer.dataUrl}"><title>${escapeXml(layer.title)}</title></image>`;
    })
    .join("");
  const pageWidth = (widthMm * 96) / 25.4;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pageWidth}px" height="${(pageWidth * height) / width}px" viewBox="0 0 ${width} ${height}">${images}</svg>`;
}
