"use client";

import { useEffect, useRef, useState } from "react";
import { AspectRatio, Slide } from "../lib/types";
import { RenderOpts, renderPreview } from "../lib/renderer";

interface Props {
  slides: Slide[];
  opts: RenderOpts;
  onClose: () => void;
}

export default function PreviewModal({ slides, opts, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!canvasRef.current || slides.length === 0) return;
    renderPreview(canvasRef.current, slides, setCurrentSlide, opts).then((stop) => {
      stopRef.current = stop;
    });
    return () => { stopRef.current?.(); };
    // opts object is stable from parent (useMemo), so this is fine
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, opts.aspectRatio, opts.reelMode]);

  const ar: AspectRatio = opts.aspectRatio ?? "9:16";
  const arStyle = ar === "9:16" ? "9 / 16" : "16 / 9";

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0a0a0a]/90">
        <button
          onClick={onClose}
          className="text-white bg-[#2a2a2a] px-5 h-11 rounded-xl text-sm active:opacity-70 font-medium"
        >
          ✕ 閉じる
        </button>
        <div className="bg-black/60 px-3 py-1.5 rounded-full flex items-center gap-2">
          <span className="text-[#555] text-xs">{ar}</span>
          <span className="text-[#ff7a1a] font-bold text-sm tabular-nums">
            {currentSlide + 1}
          </span>
          <span className="text-[#666] text-sm">/ {slides.length}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full rounded-xl"
          style={{ aspectRatio: arStyle }}
        />
      </div>
    </div>
  );
}
