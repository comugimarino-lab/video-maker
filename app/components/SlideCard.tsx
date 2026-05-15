"use client";

import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Slide } from "../lib/types";

interface Props {
  slide: Slide;
  index: number;
  onChange: (id: string, patch: Partial<Slide>) => void;
  onDelete: (id: string) => void;
}

export default function SlideCard({ slide, index, onChange, onDelete }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: slide.id });

  const [ringPos, setRingPos] = useState<{ x: number; y: number } | null>(null);
  const [ringKey, setRingKey] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
      className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-[#333] mb-4"
    >
      {/* Header: drag handle + index */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-[#333]"
      >
        <div
          {...attributes}
          {...listeners}
          className="drag-handle text-[#888] text-2xl select-none px-1"
          aria-label="ドラッグして並び替え"
        >
          ⠿
        </div>
        <span className="text-[#f97316] font-bold text-lg">#{index + 1}</span>
        <button
          onClick={() => onDelete(slide.id)}
          className="ml-auto bg-[#2d0000] text-red-400 text-sm px-3 py-1.5 rounded-xl border border-red-900 active:opacity-70"
        >
          この素材を削除
        </button>
      </div>

      {/* Thumbnail with tap overlay */}
      <div
        className="relative cursor-crosshair select-none mx-4 mt-4 rounded-xl overflow-hidden"
        style={{ aspectRatio: "9/16" }}
        onClick={handleThumbnailClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={slide.dataUrl}
          alt={`slide ${index + 1}`}
          className="w-full h-full object-cover"
          draggable={false}
        />

        {/* ring indicator */}
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

        {/* existing tap marker dot */}
        {slide.tapPoint && (
          <div
            className="absolute pointer-events-none w-4 h-4 rounded-full border-2 border-yellow-400 bg-yellow-400/30"
            style={{
              left: `calc(${slide.tapPoint.x * 100}% - 8px)`,
              top: `calc(${slide.tapPoint.y * 100}% - 8px)`,
            }}
          />
        )}

        <div className="absolute inset-0 flex items-end justify-center pb-2">
          <span className="text-white/40 text-xs bg-black/40 px-2 py-0.5 rounded-full">
            タップで位置を設定
          </span>
        </div>
      </div>

      {/* Quick buttons */}
      <div className="flex gap-2 mx-4 mt-3">
        <button
          onClick={setCenter}
          className="flex-1 text-xs bg-[#262626] text-[#f97316] border border-[#f97316]/40 py-2 rounded-xl active:opacity-70"
        >
          中央をタップ位置に
        </button>
        <button
          onClick={setFullAuto}
          className="flex-1 text-xs bg-[#262626] text-[#aaa] border border-[#444] py-2 rounded-xl active:opacity-70"
        >
          全画面自動配置
        </button>
      </div>

      {/* Inputs */}
      <div className="px-4 pb-4 mt-4 space-y-3">
        <div>
          <label className="text-xs text-[#888] mb-1 block">
            テロップ（画面下部に表示）
          </label>
          <input
            type="text"
            value={slide.caption}
            onChange={(e) => onChange(slide.id, { caption: e.target.value })}
            placeholder="字幕テキストを入力…"
            className="w-full bg-[#262626] border border-[#444] text-white rounded-xl px-4 py-3 text-sm placeholder-[#555] focus:outline-none focus:border-[#f97316]"
          />
        </div>
        <div>
          <label className="text-xs text-[#888] mb-1 block">
            ポップアップ文字（タップ位置の近くに表示）
          </label>
          <input
            type="text"
            value={slide.popupText}
            onChange={(e) => onChange(slide.id, { popupText: e.target.value })}
            placeholder="例: ここをタップ！"
            className="w-full bg-[#262626] border border-[#444] text-white rounded-xl px-4 py-3 text-sm placeholder-[#555] focus:outline-none focus:border-[#f97316]"
          />
        </div>
        <div>
          <label className="text-xs text-[#888] mb-1 block">
            表示秒数
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
              className="flex-1 accent-[#f97316]"
            />
            <span className="text-[#f97316] font-bold w-12 text-right">
              {slide.duration}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
