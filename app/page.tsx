"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { AspectRatio, GlobalSettings, DEFAULT_GLOBAL_SETTINGS, Slide } from "./lib/types";
import { exportVideo, RenderOpts, supportsMediaRecorder } from "./lib/renderer";
import SlideCard from "./components/SlideCard";
import PreviewModal from "./components/PreviewModal";
import SettingsModal from "./components/SettingsModal";
import AiGenerateModal from "./components/AiGenerateModal";

const LS_KEY = "svm-aspect-ratio";
const LS_GS_KEY = "svm-global-settings";

function loadGlobalSettings(): GlobalSettings {
  if (typeof window === "undefined") return DEFAULT_GLOBAL_SETTINGS;
  try {
    const raw = localStorage.getItem(LS_GS_KEY);
    if (raw) return { ...DEFAULT_GLOBAL_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_GLOBAL_SETTINGS;
}

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

function loadAspectRatio(): AspectRatio {
  if (typeof window === "undefined") return "9:16";
  const saved = localStorage.getItem(LS_KEY);
  return saved === "16:9" ? "16:9" : "9:16";
}

export default function Home() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [aspectRatio, setAspectRatioState] = useState<AspectRatio>("9:16");
  const [globalSettings, setGlobalSettingsState] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [previewing, setPreviewing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAiGenerate, setShowAiGenerate] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportLabel, setExportLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore from localStorage after hydration
  useEffect(() => {
    setAspectRatioState(loadAspectRatio());
    setGlobalSettingsState(loadGlobalSettings());
  }, []);

  function setAspectRatio(ar: AspectRatio) {
    setAspectRatioState(ar);
    localStorage.setItem(LS_KEY, ar);
  }

  function setGlobalSettings(patch: Partial<GlobalSettings>) {
    setGlobalSettingsState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(LS_GS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const renderOpts = useMemo<RenderOpts>(
    () => ({ aspectRatio, reelMode: false, globalSettings }),
    [aspectRatio, globalSettings]
  );

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
        transition: "global" as const,
        overlayText: "",
        overlayPosition: "center" as const,
        overlaySize: "medium" as const,
        audio: null,
        audioDuration: null,
        syncDuration: true,
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

  function handleAddSlides(newSlides: Slide[]) {
    setSlides((prev) => [...prev, ...newSlides]);
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
        setExportLabel("WebM を書き出し中…");
        blob = await exportVideo(slides, (pct) => setExportProgress(pct), renderOpts);
        filename = "output.webm";
      } else {
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
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur border-b border-[#222] px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[#ff7a1a] font-bold text-xl leading-tight">
            📱 スクショ動画メーカー
          </h1>
          <button
            onClick={() => setShowSettings(true)}
            className="text-[#666] text-xl min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="設定"
          >
            ⚙️
          </button>
        </div>

        {/* Aspect ratio toggle */}
        <div className="flex gap-1.5 bg-[#141414] p-1 rounded-xl border border-[#2a2a2a]">
          {(["9:16", "16:9"] as AspectRatio[]).map((ar) => (
            <button
              key={ar}
              onClick={() => setAspectRatio(ar)}
              className={`flex-1 h-9 rounded-lg text-sm font-semibold transition-colors ${
                aspectRatio === ar
                  ? "bg-[#ff7a1a] text-black"
                  : "text-[#666] active:text-white"
              }`}
            >
              {ar === "9:16" ? "縦 9:16（リール）" : "横 16:9"}
            </button>
          ))}
        </div>

        {/* Global transition settings */}
        <div className="mt-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#888] whitespace-nowrap">トランジション</span>
            <select
              value={globalSettings.transition}
              onChange={(e) => setGlobalSettings({ transition: e.target.value as GlobalSettings["transition"] })}
              className="flex-1 bg-[#1a1a1a] border border-[#333] text-white text-xs rounded-lg h-9 px-2 focus:outline-none focus:border-[#ff7a1a]"
            >
              <option value="none">なし（カット）</option>
              <option value="fade">フェード</option>
              <option value="slide-left">←スライド</option>
              <option value="zoom">ズーム</option>
            </select>
          </div>
          {globalSettings.transition !== "none" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#888] whitespace-nowrap">時間</span>
              <input
                type="range"
                min={0.2}
                max={1.0}
                step={0.1}
                value={globalSettings.transitionDuration}
                onChange={(e) => setGlobalSettings({ transitionDuration: Number(e.target.value) })}
                className="flex-1 accent-[#ff7a1a] h-2"
              />
              <span className="text-[#ff7a1a] text-xs font-bold w-12 text-right tabular-nums">
                {globalSettings.transitionDuration.toFixed(1)}秒
              </span>
            </div>
          )}
        </div>

        {/* AI Generate button */}
        <button
          onClick={() => setShowAiGenerate(true)}
          className="mt-2 w-full bg-[#1a1a1a] border border-[#ff7a1a]/40 text-[#ff7a1a] font-semibold h-10 rounded-xl text-sm active:opacity-70 transition-opacity"
        >
          ✨ AIでスライドを生成
        </button>
      </header>

      <main className="flex-1 px-4 pb-40 pt-4">
        {/* Upload zone */}
        <div
          className="border-2 border-dashed border-[#ff7a1a]/50 rounded-2xl p-8 text-center mb-6 active:bg-[#ff7a1a]/5 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-5xl mb-3">📸</div>
          <p className="text-white font-semibold text-lg mb-1">画像を追加</p>
          <p className="text-[#666] text-sm">タップして選択、または複数まとめて追加</p>
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
                aspectRatio={aspectRatio}
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

      {previewing && (
        <PreviewModal
          slides={slides}
          opts={renderOpts}
          onClose={() => setPreviewing(false)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showAiGenerate && (
        <AiGenerateModal
          onClose={() => setShowAiGenerate(false)}
          onOpenSettings={() => setShowSettings(true)}
          onAddSlides={handleAddSlides}
        />
      )}
    </div>
  );
}
