import { AspectRatio, OverlayPosition, OverlaySize, Slide } from "./types";

const FPS = 30;
const TRANS_DUR = 0.4;

// ─── dimension helpers ────────────────────────────────────────────────────

export function getDims(ar: AspectRatio): { W: number; H: number } {
  return ar === "9:16" ? { W: 720, H: 1280 } : { W: 1280, H: 720 };
}

// Proportional sizing unit: shorter edge (720 for both ratios)
function unit(W: number, H: number) {
  return Math.min(W, H);
}

export interface RenderOpts {
  aspectRatio?: AspectRatio;
  reelMode?: boolean;
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
  // contain = fit fully visible (may have black bars)
  // cover  = fill frame (may crop)
  const scale = contain
    ? Math.min(W / img.naturalWidth, H / img.naturalHeight)
    : Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
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
  const p = t;
  const s = p < 0.6 ? 0.5 + (p / 0.6) * 1.3 : 1.8 - ((p - 0.6) / 0.4) * 1.3;
  const a = p < 0.6 ? 1 : 1 - ((p - 0.6) / 0.4) * 0.4;
  const r = unit(W, H) * 0.056; // ~40px on 720-unit canvas
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
  const fs = Math.round(u * 0.058); // ~42px
  const pad = Math.round(u * 0.022); // ~16px
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

// ─── overlay text ─────────────────────────────────────────────────────────

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
    // character-by-character wrap (works for CJK and Latin)
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

  const ANIM = 0.3;
  const progress = Math.min(elapsed / ANIM, 1); // 0→1 over 0.3 s

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

  // vertical anchor
  const pos: OverlayPosition = slide.overlayPosition;
  let boxY: number;
  const slideOffset = Math.round(H * 0.016); // ~20px on 1280H
  if (pos === "top") {
    boxY = Math.round(H * 0.06);
  } else if (pos === "bottom") {
    // stay above caption bar (estimate ~10% of H)
    boxY = Math.round(H * 0.78) - boxH;
  } else {
    boxY = Math.round(H / 2 - boxH / 2);
  }

  const boxX = Math.round((W - boxW) / 2);

  // animation: fade + slide
  const dy =
    pos === "bottom" ? slideOffset * (1 - progress) :
    pos === "top"    ? -slideOffset * (1 - progress) : 0;

  ctx.save();
  ctx.globalAlpha = progress;
  ctx.translate(0, dy);

  // semi-transparent background
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  roundRect(ctx, boxX, boxY, boxW, boxH, Math.round(u * 0.012));
  ctx.fill();

  // orange border
  ctx.strokeStyle = "#ff7a1a";
  ctx.lineWidth = 2;
  ctx.stroke();

  // white text
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
  // 9:16: slightly larger captions as specced
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
  const fs = Math.round(unit(W, H) * 0.086); // ~62px
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

// ─── composite draw ───────────────────────────────────────────────────────

function drawNormalSlide(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slide: Slide,
  elapsed: number,
  W: number,
  H: number,
  contain: boolean
) {
  drawBg(ctx, img, W, H, contain);
  drawTapRing(ctx, slide, elapsed, W, H);
  drawPopup(ctx, slide, elapsed, W, H);
  drawOverlay(ctx, slide, elapsed, W, H);
  drawNormalCaption(ctx, slide, W, H);
}

function drawReelFrame(
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  slides: Slide[],
  globalTime: number,
  W: number,
  H: number,
  contain: boolean
) {
  let acc = 0;
  let idx = slides.length - 1;
  let elapsed = globalTime;
  for (let i = 0; i < slides.length; i++) {
    if (globalTime < acc + slides[i].duration) {
      idx = i;
      elapsed = globalTime - acc;
      break;
    }
    acc += slides[i].duration;
  }

  const slide = slides[idx];
  const nextSlide = slides[idx + 1];
  const nextImg = images[idx + 1];
  const transStart = slide.duration - TRANS_DUR;
  const isTransitioning =
    nextSlide && slide.transition !== "none" && elapsed >= transStart;

  if (!isTransitioning) {
    drawBg(ctx, images[idx], W, H, contain);
    drawTapRing(ctx, slide, elapsed, W, H);
    drawPopup(ctx, slide, elapsed, W, H);
    drawOverlay(ctx, slide, elapsed, W, H);
    drawReelCaption(ctx, slide, W, H);
  } else {
    const tp = (elapsed - transStart) / TRANS_DUR;
    if (slide.transition === "fade") {
      drawBg(ctx, nextImg, W, H, contain);
      ctx.globalAlpha = 1 - tp;
      drawBg(ctx, images[idx], W, H, contain);
      ctx.globalAlpha = 1;
      ctx.globalAlpha = 1 - tp;
      drawTapRing(ctx, slide, elapsed, W, H);
      drawPopup(ctx, slide, elapsed, W, H);
      drawOverlay(ctx, slide, elapsed, W, H);
      drawReelCaption(ctx, slide, W, H);
      ctx.globalAlpha = tp;
      drawReelCaption(ctx, nextSlide, W, H);
      ctx.globalAlpha = 1;
    } else if (slide.transition === "slide-up") {
      drawBg(ctx, images[idx], W, H, contain);
      drawTapRing(ctx, slide, elapsed, W, H);
      drawPopup(ctx, slide, elapsed, W, H);
      drawOverlay(ctx, slide, elapsed, W, H);
      drawReelCaption(ctx, slide, W, H);
      ctx.save();
      ctx.translate(0, H * (1 - tp));
      drawBg(ctx, nextImg, W, H, contain);
      drawReelCaption(ctx, nextSlide, W, H);
      ctx.restore();
    }
  }

  drawStoryBar(ctx, slides, globalTime, W, H);
}

// ─── time helpers ─────────────────────────────────────────────────────────

function resolveSlide(
  slides: Slide[],
  globalTime: number
): { idx: number; elapsed: number } {
  let acc = 0;
  for (let i = 0; i < slides.length; i++) {
    if (globalTime < acc + slides[i].duration) {
      return { idx: i, elapsed: globalTime - acc };
    }
    acc += slides[i].duration;
  }
  return { idx: slides.length - 1, elapsed: slides[slides.length - 1].duration };
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
    const { idx, elapsed } = resolveSlide(slides, gt);
    onSlideChange?.(idx);
    if (reelMode) {
      drawReelFrame(ctx, images, slides, gt, W, H, contain);
    } else {
      drawNormalSlide(ctx, images[idx], slides[idx], elapsed, W, H, contain);
    }
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
      const { idx, elapsed } = resolveSlide(slides, gt);
      if (reelMode) {
        drawReelFrame(ctx, images, slides, gt, W, H, contain);
      } else {
        drawNormalSlide(ctx, images[idx], slides[idx], elapsed, W, H, contain);
      }
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
