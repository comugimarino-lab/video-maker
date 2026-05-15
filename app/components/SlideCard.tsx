"use client";

import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AspectRatio, Slide } from "../lib/types";

interface Props {
  slide: Slide;
  index: number;
  aspectRatio: AspectRatio;
  onChange: (id: string, patch: Partial<Slide>) => void;
  onDelete: (id: string) => void;
}

export default function SlideCard({ slide, index, aspectRatio, onChange, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const [ringPos, setRingPos] = useState<{ x: number; y: number } | null>(null);
  const [ringKey, setRingKey] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  function handleThumbnailClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    setRingPos({ x: relX, y: relY });
    setRingKey((k) => k + 1);
    onChange(slide.id, { tapPoint: { x: relX, y: relY } });
  }

  function setCenter() {
    onChange(slide.id, { tapPoint: { x: 0.5, y: 0.5 } });
    setRingPos({ x: 0.5, y: 0.5 });
    setRingKey((k) => k + 1);
  }

  function setFullAuto() {
    onChange(slide.id, { tapPoint: null });
    setRingPos(null);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-[#141414] rounded-2xl overflow-hidden border border-[#2a2a2a] mb-4"
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2a2a2a]">
        <div
          {...attributes}
          {...listeners}
          className="drag-handle text-[#555] text-2xl select-none px-1 touch-none"
          aria-label="ドラッグして並び替え"
        >
          ⠿
        </div>
        <span className="text-[#ff7a1a] font-bold text-lg">#{index + 1}</span>
        <button
          onClick={() => onDelete(slide.id)}
          className="ml-auto bg-[#2d0000] text-red-400 text-sm px-4 h-10 rounded-xl border border-red-900/60 active:opacity-70 min-w-[80px]"
        >
          削除
        </button>
      </div>

      {/* Thumbnail */}
      <div
        className="relative cursor-crosshair select-none mx-4 mt-4 rounded-xl overflow-hidden"
        style={{ aspectRatio: aspectRatio === "9:16" ? "9/16" : "16/9" }}
        onClick={handleThumbnailClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={slide.dataUrl}
          alt={`slide ${index + 1}`}
          className={`w-full h-full ${aspectRatio === "9:16" ? "object-contain" : "object-cover"} bg-black`}
          draggable={false}
        />

        {/* Ring animation on click */}
        {ringPos && (
          <div
            key={ringKey}
            className="ring-anim absolute pointer-events-none border-4 border-yellow-400 rounded-full"
            style={{
              width: 56,
              height: 56,
              left: `calc(${ringPos.x * 100}% - 28px)`,
              top: `calc(${ringPos.y * 100}% - 28px)`,
            }}
          />
        )}

        {/* Tap position dot */}
        {slide.tapPoint && (
          <div
            className="absolute pointer-events-none w-4 h-4 rounded-full border-2 border-yellow-400 bg-yellow-400/30"
            style={{
              left: `calc(${slide.tapPoint.x * 100}% - 8px)`,
              top: `calc(${slide.tapPoint.y * 100}% - 8px)`,
            }}
          />
        )}

        <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
          <span className="text-white/40 text-xs bg-black/40 px-2 py-0.5 rounded-full">
            タップで位置を設定
          </span>
        </div>
      </div>

      {/* Quick position buttons */}
      <div className="flex gap-2 mx-4 mt-3">
        <button
          onClick={setCenter}
          className="flex-1 text-sm bg-[#1e1e1e] text-[#ff7a1a] border border-[#ff7a1a]/40 h-12 rounded-xl active:opacity-70"
        >
          中央をタップ位置に
        </button>
        <button
          onClick={setFullAuto}
          className="flex-1 text-sm bg-[#1e1e1e] text-[#aaa] border border-[#333] h-12 rounded-xl active:opacity-70"
        >
          全画面自動配置
        </button>
      </div>

      {/* Input fields */}
      <div className="px-4 pb-4 mt-4 space-y-4">
        <div>
          <label className="text-xs text-[#666] mb-1.5 block">
            テロップ（画面下部に表示）
          </label>
          <input
            type="text"
            value={slide.caption}
            onChange={(e) => onChange(slide.id, { caption: e.target.value })}
            placeholder="字幕テキストを入力…"
            className="w-full bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-4 h-12 text-sm placeholder-[#444] focus:outline-none focus:border-[#ff7a1a]"
          />
        </div>
        <div>
          <label className="text-xs text-[#666] mb-1.5 block">
            ポップアップ文字（タップ位置の近くに表示）
          </label>
          <input
            type="text"
            value={slide.popupText}
            onChange={(e) => onChange(slide.id, { popupText: e.target.value })}
            placeholder="例: ここをタップ！"
            className="w-full bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-4 h-12 text-sm placeholder-[#444] focus:outline-none focus:border-[#ff7a1a]"
          />
        </div>
        <div>
          <label className="text-xs text-[#666] mb-1.5 block">
            表示秒数（1〜10秒）
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={slide.duration}
              onChange={(e) =>
                onChange(slide.id, { duration: Number(e.target.value) })
              }
              className="flex-1 accent-[#ff7a1a] h-2"
            />
            <span className="text-[#ff7a1a] font-bold w-14 text-right tabular-nums">
              {slide.duration}秒
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
