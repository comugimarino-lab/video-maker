import { Slide } from "./types";

const VIDEO_W = 1080;
const VIDEO_H = 1920;
const FPS = 30;

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

function drawSlideFrame(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  slide: Slide,
  elapsed: number // seconds into this slide
) {
  const W = VIDEO_W;
  const H = VIDEO_H;

  // Black bg
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  // Fit image (cover) centered
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  // Tap ring animation (plays from t=0.1 to t=0.1+1s)
  if (slide.tapPoint) {
    const px = slide.tapPoint.x * W;
    const py = slide.tapPoint.y * H;
    const animStart = 0.1;
    const animDur = 1.0;
    const t = elapsed - animStart;
    if (t >= 0 && t <= animDur) {
      const progress = t / animDur;
      // ring expands then contracts
      const scale2 = progress < 0.6
        ? 0.5 + (progress / 0.6) * 1.3
        : 1.8 - ((progress - 0.6) / 0.4) * 1.3;
      const alpha = progress < 0.6 ? 1 : 1 - ((progress - 0.6) / 0.4) * 0.4;
      const radius = 40 * scale2;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 220, 0, ${alpha})`;
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  }

  // Popup text near tap point
  if (slide.tapPoint && slide.popupText && elapsed > 0.15) {
    const px = slide.tapPoint.x * W;
    const py = slide.tapPoint.y * H;
    const fontSize = 42;
    ctx.font = `bold ${fontSize}px -apple-system, sans-serif`;
    const metrics = ctx.measureText(slide.popupText);
    const tw = metrics.width;
    const th = fontSize + 16;
    const margin = 20;

    let bx = px - tw / 2 - 16;
    let by = py - 80 - th;
    if (bx < margin) bx = margin;
    if (bx + tw + 32 > W - margin) bx = W - tw - 32 - margin;
    if (by < margin) by = py + 60;

    ctx.fillStyle = "rgba(255,220,0,0.92)";
    roundRect(ctx, bx, by, tw + 32, th, 14);
    ctx.fill();

    ctx.fillStyle = "#000";
    ctx.fillText(slide.popupText, bx + 16, by + fontSize + 4);
  }

  // Caption bar
  if (slide.caption) {
    const capH = 110;
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, H - capH, W, capH);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 44px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(slide.caption, W / 2, H - capH + 68);
    ctx.textAlign = "left";
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
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

export async function renderPreview(
  canvas: HTMLCanvasElement,
  slides: Slide[],
  onSlideChange?: (idx: number) => void
): Promise<() => void> {
  const ctx = canvas.getContext("2d")!;
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;

  const images = await Promise.all(slides.map((s) => loadImage(s.dataUrl)));

  let stopped = false;
  let startTime: number | null = null;
  let frameId = 0;

  const totalDuration = slides.reduce((acc, s) => acc + s.duration, 0);

  function tick(now: number) {
    if (stopped) return;
    if (startTime === null) startTime = now;
    const elapsed = (now - startTime) / 1000;
    const looped = elapsed % totalDuration;

    // find current slide
    let acc = 0;
    let slideIdx = 0;
    let slideElapsed = 0;
    for (let i = 0; i < slides.length; i++) {
      if (looped < acc + slides[i].duration) {
        slideIdx = i;
        slideElapsed = looped - acc;
        break;
      }
      acc += slides[i].duration;
    }

    onSlideChange?.(slideIdx);
    drawSlideFrame(ctx, images[slideIdx], slides[slideIdx], slideElapsed);
    frameId = requestAnimationFrame(tick);
  }

  frameId = requestAnimationFrame(tick);
  return () => {
    stopped = true;
    cancelAnimationFrame(frameId);
  };
}

export async function exportVideo(
  slides: Slide[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext("2d")!;

  const images = await Promise.all(slides.map((s) => loadImage(s.dataUrl)));

  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(FPS);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: 8_000_000,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      resolve(new Blob(chunks, { type: "video/webm" }));
    };
    recorder.onerror = reject;

    recorder.start(100);

    const totalFrames = slides.reduce((acc, s) => acc + Math.round(s.duration * FPS), 0);
    let frame = 0;

    function nextFrame() {
      let acc = 0;
      let slideIdx = 0;
      let slideElapsed = 0;
      const t = frame / FPS;
      for (let i = 0; i < slides.length; i++) {
        if (t < acc + slides[i].duration) {
          slideIdx = i;
          slideElapsed = t - acc;
          break;
        }
        acc += slides[i].duration;
      }

      drawSlideFrame(ctx, images[slideIdx], slides[slideIdx], slideElapsed);
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
