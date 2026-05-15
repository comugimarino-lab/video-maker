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
    return () => {
      stopRef.current?.();
    };
  }, [slides]);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#333]">
        <span className="text-[#f97316] font-bold">
          プレビュー #{currentSlide + 1} / {slides.length}
        </span>
        <button
          onClick={onClose}
          className="text-white bg-[#333] px-4 py-2 rounded-xl text-sm active:opacity-70"
        >
          ✕ 閉じる
        </button>
      </div>
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
