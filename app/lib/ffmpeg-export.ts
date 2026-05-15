import { Slide } from "./types";
import { mixSlidesAudio } from "./audio-utils";

const EXPORT_FPS = 15; // lower FPS for memory efficiency on iOS
const EXPORT_W = 720;
const EXPORT_H = 1280;

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
  elapsed: number,
  W: number,
  H: number
) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (W - dw) / 2;
  const dy = (H - dh) / 2;
  ctx.drawImage(img, dx, dy, dw, dh);

  if (slide.tapPoint) {
    const px = slide.tapPoint.x * W;
    const py = slide.tapPoint.y * H;
    const animStart = 0.1;
    const animDur = 1.0;
    const t = elapsed - animStart;
    if (t >= 0 && t <= animDur) {
      const progress = t / animDur;
      const ringScale =
        progress < 0.6
          ? 0.5 + (progress / 0.6) * 1.3
          : 1.8 - ((progress - 0.6) / 0.4) * 1.3;
      const alpha =
        progress < 0.6 ? 1 : 1 - ((progress - 0.6) / 0.4) * 0.4;
      const radius = 36 * ringScale;
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,220,0,${alpha})`;
      ctx.lineWidth = 5;
      ctx.stroke();
    }
  }

  if (slide.tapPoint && slide.popupText && elapsed > 0.15) {
    const px = slide.tapPoint.x * W;
    const py = slide.tapPoint.y * H;
    const fontSize = Math.round(W * 0.038);
    ctx.font = `bold ${fontSize}px sans-serif`;
    const tw = ctx.measureText(slide.popupText).width;
    const th = fontSize + 14;
    const margin = 16;
    let bx = px - tw / 2 - 12;
    let by = py - 70 - th;
    if (bx < margin) bx = margin;
    if (bx + tw + 24 > W - margin) bx = W - tw - 24 - margin;
    if (by < margin) by = py + 50;
    ctx.fillStyle = "rgba(255,220,0,0.92)";
    roundRect(ctx, bx, by, tw + 24, th, 12);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.fillText(slide.popupText, bx + 12, by + fontSize + 2);
  }

  if (slide.caption) {
    const capH = Math.round(H * 0.057);
    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(0, H - capH, W, capH);
    ctx.fillStyle = "#fff";
    const fontSize = Math.round(H * 0.023);
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(slide.caption, W / 2, H - capH + fontSize + 8);
    ctx.textAlign = "left";
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

function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.85): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error("toBlob failed")); return; }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf)), reject);
      },
      "image/jpeg",
      quality
    );
  });
}

export async function exportVideoFfmpeg(
  slides: Slide[],
  onProgress?: (pct: number, label: string) => void
): Promise<Blob> {
  onProgress?.(0, "ffmpeg.wasm をロード中…");

  // Dynamic import – only loaded when needed
  const { FFmpeg } = await import("@ffmpeg/ffmpeg");
  const { toBlobURL } = await import("@ffmpeg/util");

  const ffmpeg = new FFmpeg();

  const BASE = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${BASE}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${BASE}/ffmpeg-core.wasm`, "application/wasm"),
  });

  onProgress?.(5, "音声を処理中…");
  const audioWav = await mixSlidesAudio(slides);
  if (audioWav) {
    await ffmpeg.writeFile("audio.wav", audioWav);
  }

  onProgress?.(10, "フレームを描画中…");

  const canvas = document.createElement("canvas");
  canvas.width = EXPORT_W;
  canvas.height = EXPORT_H;
  const ctx = canvas.getContext("2d")!;

  const images = await Promise.all(slides.map((s) => loadImage(s.dataUrl)));

  const totalFrames = slides.reduce(
    (acc, s) => acc + Math.round(s.duration * EXPORT_FPS),
    0
  );

  // Render frames
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / EXPORT_FPS;
    let acc = 0;
    let slideIdx = slides.length - 1;
    let slideElapsed = t;
    for (let i = 0; i < slides.length; i++) {
      if (t < acc + slides[i].duration) {
        slideIdx = i;
        slideElapsed = t - acc;
        break;
      }
      acc += slides[i].duration;
    }

    drawSlideFrame(ctx, images[slideIdx], slides[slideIdx], slideElapsed, EXPORT_W, EXPORT_H);

    const jpeg = await canvasToJpeg(canvas);
    const name = `f${String(frame).padStart(6, "0")}.jpg`;
    await ffmpeg.writeFile(name, jpeg);

    // 10–55% for frame rendering
    onProgress?.(10 + Math.round((frame / totalFrames) * 45), "フレームを描画中…");
  }

  onProgress?.(55, "動画をエンコード中…");

  ffmpeg.on("progress", ({ progress }) => {
    onProgress?.(55 + Math.round(progress * 43), "動画をエンコード中…");
  });

  await ffmpeg.exec([
    "-framerate", String(EXPORT_FPS),
    "-i", "f%06d.jpg",
    ...(audioWav ? ["-i", "audio.wav"] : []),
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-preset", "ultrafast",
    "-movflags", "+faststart",
    ...(audioWav ? ["-c:a", "aac", "-shortest"] : []),
    "output.mp4",
  ]);

  onProgress?.(99, "ファイルを生成中…");

  const data = await ffmpeg.readFile("output.mp4");
  const uint8 = typeof data === "string"
    ? new TextEncoder().encode(data)
    : (data as Uint8Array);
  // .slice() returns Uint8Array<ArrayBuffer> (not ArrayBufferLike) – required by Blob constructor
  return new Blob([uint8.slice()], { type: "video/mp4" });
}
