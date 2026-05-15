"use client";

import { useEffect, useRef, useState } from "react";
import { Slide } from "../lib/types";
import { renderPreview } from "../lib/renderer";

interface Props {
  slides: Slide[];
  onClose: () => void;
}

export default function PreviewModal({ slides, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!canvasRef.current || slides.length === 0) return;
    renderPreview(canvasRef.current, slides, setCurrentSlide).then((stop) => {
      stopRef.current = stop;
    });
    return () => { stopRef.current?.(); };
  }, [slides]);

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
        {/* Slide counter – top right */}
        <div className="bg-black/60 px-3 py-1.5 rounded-full">
          <span className="text-[#ff7a1a] font-bold text-sm tabular-nums">
            {currentSlide + 1}
          </span>
          <span className="text-[#666] text-sm"> / {slides.length}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-2">
        <canvas
          ref={canvasRef}
          className="max-h-full max-w-full rounded-xl"
          style={{ aspectRatio: "9/16" }}
        />
      </div>
    </div>
  );
}
