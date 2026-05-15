import {
  AspectRatio,
  DEFAULT_GLOBAL_SETTINGS,
  GlobalSettings,
  OverlayPosition,
  OverlaySize,
  Slide,
  TransitionType,
} from "./types";

const FPS = 30;

// ─── dimension helpers ────────────────────────────────────────────────────

export function getDims(ar: AspectRatio): { W: number; H: number } {
  return ar === "9:16" ? { W: 720, H: 1280 } : { W: 1280, H: 720 };
}

function unit(W: number, H: number) {
  return Math.min(W, H);
}

export interface RenderOpts {
  aspectRatio?: AspectRatio;
  reelMode?: boolean;
  globalSettings?: GlobalSettings;
}

// ─── public helpers ───────────────────────────────────────────────────────

export function supportsMediaRecorder(): boolean {
  if (typeof MediaRecorder === "undefined") return false;
  return (
    MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ||
    MediaRecorder.isTypeSupported("video/webm") ||
    MediaRecorder.isTypeSupported("video/mp4")
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function resolveTransition(slide: Slide, gs: GlobalSettings): TransitionType {
  return slide.transition === "global" ? gs.transition : slide.transition;
}

// ─── drawing primitives ───────────────────────────────────────────────────

function drawBg(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  W: number,
  H: number,
  contain: boolean
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  const scale = contain
    ? Math.min(W / img.naturalWidth, H / img.naturalHeight)
    : Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

// Draws only the background transition effect (no overlays)
function drawTransitionBg(
  ctx: CanvasRenderingContext2D,
  curImg: HTMLImageElement,
  nextImg: HTMLImageElement,
  tp: number, // 0→1 progress
  W: number,
  H: number,
  contain: boolean,
  transType: TransitionType
) {
  switch (transType) {
    case "fade": {
      // Next slide fully underneath, current fades out on top
      drawBg(ctx, nextImg, W, H, contain);
      ctx.globalAlpha = 1 - tp;
      drawBg(ctx, curImg, W, H, contain);
      ctx.globalAlpha = 1;
      break;
    }
    case "slide-left": {
      // Current slides out left, next enters from right
      ctx.save();
      ctx.translate(-W * tp, 0);
      drawBg(ctx, curImg, W, H, contain);
      ctx.restore();
      ctx.save();
      ctx.translate(W * (1 - tp), 0);
      drawBg(ctx, nextImg, W, H, contain);
      ctx.restore();
      break;
    }
    case "zoom": {
      // Current stays, next zooms in from 90%→100% while fading in
      drawBg(ctx, curImg, W, H, contain);
      ctx.save();
      ctx.globalAlpha = tp;
      const zoom = 0.9 + 0.1 * tp;
      ctx.transform(zoom, 0, 0, zoom, (W * (1 - zoom)) / 2, (H * (1 - zoom)) / 2);
      drawBg(ctx, nextImg, W, H, contain);
      ctx.restore();
      break;
    }
    default: // "none"
      drawBg(ctx, curImg, W, H, contain);
      break;
  }
}

function drawTapRing(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  elapsed: number,
  W: number,
  H: number
) {
  if (!slide.tapPoint) return;
  const px = slide.tapPoint.x * W;
  const py = slide.tapPoint.y * H;
  const t = elapsed - 0.1;
  if (t < 0 || t > 1.0) return;
  const s = t < 0.6 ? 0.5 + (t / 0.6) * 1.3 : 1.8 - ((t - 0.6) / 0.4) * 1.3;
  const a = t < 0.6 ? 1 : 1 - ((t - 0.6) / 0.4) * 0.4;
  const r = unit(W, H) * 0.056;
  ctx.beginPath();
  ctx.arc(px, py, r * s, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,220,0,${a})`;
  ctx.lineWidth = unit(W, H) * 0.008;
  ctx.stroke();
}

function drawPopup(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  elapsed: number,
  W: number,
  H: number
) {
  if (!slide.tapPoint || !slide.popupText || elapsed <= 0.15) return;
  const px = slide.tapPoint.x * W;
  const py = slide.tapPoint.y * H;
  const u = unit(W, H);
  const fs = Math.round(u * 0.058);
  const pad = Math.round(u * 0.022);
  ctx.font = `bold ${fs}px sans-serif`;
  const tw = ctx.measureText(slide.popupText).width;
  const th = fs + pad;
  const m = Math.round(u * 0.028);
  let bx = px - tw / 2 - pad;
  let by = py - u * 0.11 - th;
  if (bx < m) bx = m;
  if (bx + tw + pad * 2 > W - m) bx = W - tw - pad * 2 - m;
  if (by < m) by = py + u * 0.083;
  ctx.fillStyle = "rgba(255,220,0,0.92)";
  roundRect(ctx, bx, by, tw + pad * 2, th, Math.round(u * 0.019));
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.fillText(slide.popupText, bx + pad, by + fs + 2);
}

const OVERLAY_FS: Record<OverlaySize, number> = {
  small: 0.05,
  medium: 0.08,
  large: 0.12,
};

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string[] {
  const result: string[] = [];
  for (const para of text.split("\n")) {
    if (!para) continue;
    if (ctx.measureText(para).width <= maxW) {
      result.push(para);
      continue;
    }
    let line = "";
    for (const ch of para) {
      const test = line + ch;
      if (ctx.measureText(test).width <= maxW) {
        line = test;
      } else {
        if (line) result.push(line);
        line = ch;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

function drawOverlay(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  elapsed: number,
  W: number,
  H: number
) {
  if (!slide.overlayText) return;

  const progress = Math.min(elapsed / 0.3, 1);
  const u = unit(W, H);
  const fs = Math.round(u * OVERLAY_FS[slide.overlaySize]);
  const lineH = Math.round(fs * 1.35);
  const padX = Math.round(u * 0.04);
  const padY = Math.round(u * 0.025);
  const hMx = Math.round(W * 0.06);
  const maxTW = W - hMx * 2 - padX * 2;

  ctx.font = `bold ${fs}px sans-serif`;
  const lines = wrapText(ctx, slide.overlayText, maxTW);
  if (lines.length === 0) return;

  const boxW = Math.min(
    lines.reduce((m, l) => Math.max(m, ctx.measureText(l).width), 0) + padX * 2,
    W - hMx * 2
  );
  const boxH = lines.length * lineH + padY * 2;

  const pos: OverlayPosition = slide.overlayPosition;
  let boxY: number;
  const slideOff = Math.round(H * 0.016);
  if (pos === "top") {
    boxY = Math.round(H * 0.06);
  } else if (pos === "bottom") {
    boxY = Math.round(H * 0.78) - boxH;
  } else {
    boxY = Math.round(H / 2 - boxH / 2);
  }
  const boxX = Math.round((W - boxW) / 2);
  const dy =
    pos === "bottom" ? slideOff * (1 - progress) :
    pos === "top"    ? -slideOff * (1 - progress) : 0;

  ctx.save();
  ctx.globalAlpha = progress;
  ctx.translate(0, dy);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(ctx, boxX, boxY, boxW, boxH, Math.round(u * 0.012));
  ctx.fill();
  ctx.strokeStyle = "#ff7a1a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = "center";
  lines.forEach((line, i) => {
    ctx.fillText(line, boxX + boxW / 2, boxY + padY + fs + i * lineH);
  });
  ctx.textAlign = "left";
  ctx.restore();
}

function drawNormalCaption(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  W: number,
  H: number
) {
  if (!slide.caption) return;
  const u = unit(W, H);
  const fs = Math.round(u * (H > W ? 0.062 : 0.048));
  const capH = Math.round(fs * 2.4);
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(0, H - capH, W, capH);
  ctx.fillStyle = "#fff";
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText(slide.caption, W / 2, H - capH + fs + Math.round(capH * 0.18));
  ctx.textAlign = "left";
}

function drawReelCaption(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  W: number,
  H: number
) {
  if (!slide.caption) return;
  const fs = Math.round(unit(W, H) * 0.086);
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#fff";
  ctx.fillText(slide.caption, W / 2, H - Math.round(H * 0.083));
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.textAlign = "left";
}

function drawStoryBar(
  ctx: CanvasRenderingContext2D,
  slides: Slide[],
  globalTime: number,
  W: number,
  H: number
) {
  const BAR_H = 4;
  const TOP = Math.round(H * 0.018);
  const MX = Math.round(W * 0.022);
  const GAP = Math.round(W * 0.006);
  const n = slides.length;
  const barW = (W - MX * 2 - GAP * (n - 1)) / n;

  let acc = 0;
  for (let i = 0; i < n; i++) {
    const x = MX + i * (barW + GAP);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(x, TOP, barW, BAR_H, BAR_H / 2);
    ctx.fill();
    if (globalTime >= acc + slides[i].duration) {
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(x, TOP, barW, BAR_H, BAR_H / 2);
      ctx.fill();
    } else if (globalTime >= acc) {
      const pct = (globalTime - acc) / slides[i].duration;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.roundRect(x, TOP, barW * pct, BAR_H, BAR_H / 2);
      ctx.fill();
    }
    acc += slides[i].duration;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ─── time helper ──────────────────────────────────────────────────────────

function resolveSlide(
  slides: Slide[],
  gt: number
): { idx: number; elapsed: number } {
  let acc = 0;
  for (let i = 0; i < slides.length; i++) {
    if (gt < acc + slides[i].duration) {
      return { idx: i, elapsed: gt - acc };
    }
    acc += slides[i].duration;
  }
  return { idx: slides.length - 1, elapsed: slides[slides.length - 1].duration };
}

// ─── unified frame renderer ───────────────────────────────────────────────

function drawFrame(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  slides: Slide[],
  gt: number,       // global time (already looped / clamped by caller)
  W: number,
  H: number,
  contain: boolean,
  gs: GlobalSettings,
  reelMode: boolean
): number {
  const { idx, elapsed } = resolveSlide(slides, gt);
  const slide = slides[idx];
  const hasNext = idx + 1 < slides.length;
  const TRANS_DUR = gs.transitionDuration;
  const transType = resolveTransition(slide, gs);
  const isTransitioning =
    hasNext && transType !== "none" && elapsed >= slide.duration - TRANS_DUR;

  if (!isTransitioning) {
    drawBg(ctx, images[idx], W, H, contain);
  } else {
    const tp = Math.min((elapsed - (slide.duration - TRANS_DUR)) / TRANS_DUR, 1);
    drawTransitionBg(ctx, images[idx], images[idx + 1], tp, W, H, contain, transType);
  }

  // Overlays always drawn at full opacity on top of the background transition.
  // Tap ring: elapsed starts from 0 on slide N+1 only after transition ends,
  // so it naturally begins after the transition completes.
  drawTapRing(ctx, slide, elapsed, W, H);
  drawPopup(ctx, slide, elapsed, W, H);
  drawOverlay(ctx, slide, elapsed, W, H);

  if (reelMode) {
    drawReelCaption(ctx, slide, W, H);
    drawStoryBar(ctx, slides, gt, W, H);
  } else {
    drawNormalCaption(ctx, slide, W, H);
  }

  return idx;
}

// ─── public preview API ───────────────────────────────────────────────────

export async function renderPreview(
  canvas: HTMLCanvasElement,
  slides: Slide[],
  onSlideChange?: (idx: number) => void,
  opts: RenderOpts = {}
): Promise<() => void> {
  const ar = opts.aspectRatio ?? "9:16";
  const { W, H } = getDims(ar);
  const contain = ar === "9:16";
  const reelMode = opts.reelMode ?? false;
  const gs = opts.globalSettings ?? DEFAULT_GLOBAL_SETTINGS;

  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const images = await Promise.all(slides.map((s) => loadImage(s.dataUrl)));

  let stopped = false;
  let startTime: number | null = null;
  let frameId = 0;
  const totalDuration = slides.reduce((acc, s) => acc + s.duration, 0);

  function tick(now: number) {
    if (stopped) return;
    if (startTime === null) startTime = now;
    const gt = ((now - startTime) / 1000) % totalDuration;
    const idx = drawFrame(ctx, images, slides, gt, W, H, contain, gs, reelMode);
    onSlideChange?.(idx);
    frameId = requestAnimationFrame(tick);
  }

  frameId = requestAnimationFrame(tick);
  return () => { stopped = true; cancelAnimationFrame(frameId); };
}

// ─── public export API ────────────────────────────────────────────────────

export async function exportVideo(
  slides: Slide[],
  onProgress?: (pct: number) => void,
  opts: RenderOpts = {}
): Promise<Blob> {
  const ar = opts.aspectRatio ?? "9:16";
  const { W, H } = getDims(ar);
  const contain = ar === "9:16";
  const reelMode = opts.reelMode ?? false;
  const gs = opts.globalSettings ?? DEFAULT_GLOBAL_SETTINGS;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const images = await Promise.all(slides.map((s) => loadImage(s.dataUrl)));

  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: 8_000_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
    recorder.onerror = reject;
    recorder.start(100);

    const totalFrames = slides.reduce((acc, s) => acc + Math.round(s.duration * FPS), 0);
    const totalDuration = slides.reduce((acc, s) => acc + s.duration, 0);
    let frame = 0;

    function nextFrame() {
      const gt = Math.min(frame / FPS, totalDuration - 1 / FPS);
      drawFrame(ctx, images, slides, gt, W, H, contain, gs, reelMode);
      onProgress?.((frame / totalFrames) * 100);
      frame++;
      if (frame >= totalFrames) {
        setTimeout(() => recorder.stop(), 200);
      } else {
        requestAnimationFrame(nextFrame);
      }
    }

    requestAnimationFrame(nextFrame);
  });
}
