"use client";

import { useCallback, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Slide } from "./lib/types";
import { exportVideo, supportsMediaRecorder } from "./lib/renderer";
import SlideCard from "./components/SlideCard";
import PreviewModal from "./components/PreviewModal";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [previewing, setPreviewing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLabel, setExportLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const accepted = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const newSlides: Slide[] = await Promise.all(
      accepted.map(async (f) => ({
        id: genId(),
        dataUrl: await fileToDataUrl(f),
        tapPoint: null,
        caption: "",
        popupText: "",
        duration: 3,
      }))
    );
    setSlides((prev) => [...prev, ...newSlides]);
  }, []);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSlides((prev) => {
      const oldIdx = prev.findIndex((s) => s.id === active.id);
      const newIdx = prev.findIndex((s) => s.id === over.id);
      return arrayMove(prev, oldIdx, newIdx);
    });
  }

  function updateSlide(id: string, patch: Partial<Slide>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function deleteSlide(id: string) {
    setSlides((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleExport() {
    if (slides.length === 0) return;
    setExporting(true);
    setExportProgress(0);
    setExportLabel("");

    try {
      let blob: Blob;
      let filename: string;

      if (supportsMediaRecorder()) {
        // Chrome / Android Safari – WebM via MediaRecorder
        setExportLabel("WebM を書き出し中…");
        blob = await exportVideo(slides, (pct) => setExportProgress(pct));
        filename = "output.webm";
      } else {
        // iOS Safari fallback – MP4 via ffmpeg.wasm
        const { exportVideoFfmpeg } = await import("./lib/ffmpeg-export");
        blob = await exportVideoFfmpeg(slides, (pct, label) => {
          setExportProgress(pct);
          setExportLabel(label);
        });
        filename = "output.mp4";
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setExportProgress(0);
      setExportLabel("");
    }
  }

  const totalDuration = slides.reduce((acc, s) => acc + s.duration, 0);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0a] max-w-lg mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#222] px-4 py-4">
        <h1 className="text-[#ff7a1a] font-bold text-xl leading-tight">
          📱 スクショ動画メーカー
        </h1>
        <p className="text-[#666] text-xs mt-0.5">
          スクリーンショットから解説動画を作成
        </p>
      </header>

      <main className="flex-1 px-4 pb-40 pt-4">
        {/* Upload zone */}
        <div
          className="border-2 border-dashed border-[#ff7a1a]/50 rounded-2xl p-8 text-center mb-6 active:bg-[#ff7a1a]/5 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-5xl mb-3">📸</div>
          <p className="text-white font-semibold text-lg mb-1">
            画像を追加
          </p>
          <p className="text-[#666] text-sm">
            タップして選択、または複数まとめて追加
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {/* Slide count */}
        {slides.length > 0 && (
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-[#888] text-sm">
              {slides.length}枚 · 合計 {totalDuration.toFixed(1)}秒
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-[#ff7a1a] text-sm font-semibold min-h-[44px] px-2"
            >
              + さらに追加
            </button>
          </div>
        )}

        {/* Slide list */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {slides.map((slide, i) => (
              <SlideCard
                key={slide.id}
                slide={slide}
                index={i}
                onChange={updateSlide}
                onDelete={deleteSlide}
              />
            ))}
          </SortableContext>
        </DndContext>

        {slides.length === 0 && (
          <div className="text-center text-[#444] py-16">
            <div className="text-6xl mb-4">🎬</div>
            <p className="text-lg">画像を追加してはじめましょう</p>
          </div>
        )}
      </main>

      {/* Bottom action bar */}
      {slides.length > 0 && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-[#0a0a0a]/95 backdrop-blur border-t border-[#222] px-4 py-4 z-40">
          {/* Progress bar */}
          {exporting && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-[#888] mb-1.5">
                <span>{exportLabel || "書き出し中…"}</span>
                <span className="text-[#ff7a1a] font-bold">{Math.round(exportProgress)}%</span>
              </div>
              <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#ff7a1a] rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setPreviewing(true)}
              disabled={exporting}
              className="flex-1 bg-[#1a1a1a] border border-[#ff7a1a]/60 text-[#ff7a1a] font-bold h-14 rounded-2xl text-base active:opacity-70 transition-opacity disabled:opacity-40"
            >
              ▶ プレビュー
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-1 bg-[#ff7a1a] text-black font-bold h-14 rounded-2xl text-base disabled:opacity-50 active:opacity-80 transition-opacity"
            >
              {exporting ? "書き出し中…" : "⬇ 動画を書き出す"}
            </button>
          </div>
        </div>
      )}

      {/* Preview modal */}
      {previewing && (
        <PreviewModal slides={slides} onClose={() => setPreviewing(false)} />
      )}
    </div>
  );
}
