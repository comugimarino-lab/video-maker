"use client";

import { useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AspectRatio, OverlayPosition, OverlaySize, Slide, SlideTransitionOverride } from "../lib/types";

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

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

  // Narration recording state
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMsRef = useRef<number>(0);
  const playbackRef = useRef<HTMLAudioElement | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      playbackRef.current?.pause();
    };
  }, []);

  async function startRecording() {
    setRecordError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const dur = (Date.now() - startMsRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const dataUrl = await blobToDataUrl(blob);
        const patch: Partial<Slide> = { audio: dataUrl, audioDuration: dur };
        if (slide.syncDuration) patch.duration = Math.max(1, dur);
        onChange(slide.id, patch);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mr.start();
      mediaRecorderRef.current = mr;
      startMsRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startMsRef.current) / 1000));
      }, 500);
    } catch {
      setRecordError("マイクへのアクセスが許可されていません");
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
  }

  async function handleAudioFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await blobToDataUrl(file);
    const dur = await new Promise<number>((resolve) => {
      const a = new Audio(dataUrl);
      a.onloadedmetadata = () => resolve(isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => resolve(0);
    });
    const patch: Partial<Slide> = { audio: dataUrl, audioDuration: dur || null };
    if (slide.syncDuration && dur > 0) patch.duration = Math.max(1, dur);
    onChange(slide.id, patch);
    e.target.value = "";
  }

  function discardAudio() {
    stopPlayback();
    onChange(slide.id, { audio: null, audioDuration: null });
  }

  function startPlayback() {
    if (!slide.audio) return;
    const a = new Audio(slide.audio);
    a.onended = () => setPlaying(false);
    a.play().catch(() => {});
    playbackRef.current = a;
    setPlaying(true);
  }

  function stopPlayback() {
    playbackRef.current?.pause();
    playbackRef.current = null;
    setPlaying(false);
  }

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

      {/* Narration */}
      <div className="px-4 mt-4 pb-4 border-b border-[#2a2a2a]">
        <p className="text-xs text-[#ff7a1a] font-semibold uppercase tracking-wide mb-3">
          ナレーション
        </p>

        {slide.audio ? (
          <div className="flex gap-2 items-center bg-[#1e1e1e] rounded-xl px-3 py-2.5">
            <span className="text-white text-xs flex-1 min-w-0 truncate">
              🎙 {slide.audioDuration != null ? `${slide.audioDuration.toFixed(1)}秒` : "録音済み"}
            </span>
            <button
              onClick={playing ? stopPlayback : startPlayback}
              className="h-9 px-3 rounded-xl bg-[#2a2a2a] text-[#ff7a1a] border border-[#ff7a1a]/40 text-xs font-semibold active:opacity-70 whitespace-nowrap"
            >
              {playing ? "■ 停止" : "▶ 試し聞き"}
            </button>
            <button
              onClick={discardAudio}
              className="h-9 px-3 rounded-xl bg-[#2d0000] text-red-400 border border-red-900/60 text-xs font-semibold active:opacity-70"
            >
              破棄
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={recording ? stopRecording : startRecording}
                className={`flex-1 h-11 rounded-xl text-sm font-bold active:opacity-70 flex items-center justify-center gap-2 ${
                  recording
                    ? "bg-[#2a2a2a] text-white border border-[#444]"
                    : "bg-red-700 text-white"
                }`}
              >
                {recording ? (
                  <>
                    <span>■ 停止</span>
                    <span className="text-red-400 font-mono tabular-nums text-xs">{formatTime(elapsed)}</span>
                  </>
                ) : (
                  "🔴 録音開始"
                )}
              </button>
              <button
                onClick={() => audioFileInputRef.current?.click()}
                disabled={recording}
                className="h-11 px-4 rounded-xl bg-[#1e1e1e] text-[#aaa] border border-[#333] text-sm active:opacity-70 disabled:opacity-40 whitespace-nowrap"
              >
                ↑ ファイル
              </button>
            </div>
            {recordError && (
              <p className="text-red-400 text-xs px-1">{recordError}</p>
            )}
            <input
              ref={audioFileInputRef}
              type="file"
              accept="audio/mp3,audio/wav,audio/m4a,audio/webm,audio/mpeg,.mp3,.wav,.m4a,.webm"
              className="hidden"
              onChange={handleAudioFile}
            />
          </div>
        )}

        {/* Sync duration toggle */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-[#888]">音声の長さに合わせる</span>
          <button
            onClick={() => {
              const newSync = !slide.syncDuration;
              const patch: Partial<Slide> = { syncDuration: newSync };
              if (newSync && slide.audioDuration != null) {
                patch.duration = Math.max(1, slide.audioDuration);
              }
              onChange(slide.id, patch);
            }}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
              slide.syncDuration ? "bg-[#ff7a1a]" : "bg-[#333]"
            }`}
          >
            <div
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                slide.syncDuration ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Per-slide transition override */}
      <div className="flex items-center gap-2 mx-4 mt-3">
        <span className="text-xs text-[#888] whitespace-nowrap">このスライドのトランジション</span>
        <select
          value={slide.transition}
          onChange={(e) => onChange(slide.id, { transition: e.target.value as SlideTransitionOverride })}
          className="flex-1 bg-[#1e1e1e] border border-[#333] text-white text-xs rounded-xl h-10 px-2 focus:outline-none focus:border-[#ff7a1a]"
        >
          <option value="global">全体設定に合わせる</option>
          <option value="none">なし（カット）</option>
          <option value="fade">フェード</option>
          <option value="slide-left">←スライド</option>
          <option value="zoom">ズーム</option>
        </select>
      </div>

      {/* Overlay text */}
      <div className="px-4 mt-4 pb-1 space-y-3 border-b border-[#2a2a2a] pb-4">
        <p className="text-xs text-[#ff7a1a] font-semibold uppercase tracking-wide">
          テキストオーバーレイ
        </p>
        <div>
          <label className="text-xs text-[#666] mb-1.5 block">
            オーバーレイテキスト（複数行可）
          </label>
          <textarea
            rows={3}
            value={slide.overlayText}
            onChange={(e) => onChange(slide.id, { overlayText: e.target.value })}
            placeholder={"例: ここに説明文\n2行目も書けます"}
            className="w-full bg-[#1e1e1e] border border-[#333] text-white rounded-xl px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#ff7a1a] resize-none"
          />
        </div>

        {/* Position */}
        <div>
          <label className="text-xs text-[#666] mb-1.5 block">表示位置</label>
          <div className="flex gap-2">
            {(["top", "center", "bottom"] as OverlayPosition[]).map((pos) => {
              const label = pos === "top" ? "上" : pos === "center" ? "中央" : "下";
              const active = slide.overlayPosition === pos;
              return (
                <button
                  key={pos}
                  onClick={() => onChange(slide.id, { overlayPosition: pos })}
                  className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[#ff7a1a] text-black"
                      : "bg-[#1e1e1e] text-[#888] border border-[#333] active:opacity-70"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Size */}
        <div>
          <label className="text-xs text-[#666] mb-1.5 block">文字サイズ</label>
          <div className="flex gap-2">
            {(["small", "medium", "large"] as OverlaySize[]).map((sz) => {
              const label = sz === "small" ? "小" : sz === "medium" ? "中" : "大";
              const active = slide.overlaySize === sz;
              return (
                <button
                  key={sz}
                  onClick={() => onChange(slide.id, { overlaySize: sz })}
                  className={`flex-1 h-10 rounded-xl text-sm font-semibold transition-colors ${
                    active
                      ? "bg-[#ff7a1a] text-black"
                      : "bg-[#1e1e1e] text-[#888] border border-[#333] active:opacity-70"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
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
              max={Math.max(10, slide.duration)}
              step={0.5}
              value={slide.duration}
              disabled={slide.syncDuration && slide.audioDuration != null}
              onChange={(e) =>
                onChange(slide.id, { duration: Number(e.target.value) })
              }
              className="flex-1 accent-[#ff7a1a] h-2 disabled:opacity-40"
            />
            <span className={`font-bold w-14 text-right tabular-nums ${
              slide.syncDuration && slide.audioDuration != null ? "text-[#666]" : "text-[#ff7a1a]"
            }`}>
              {slide.duration.toFixed(1)}秒
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
