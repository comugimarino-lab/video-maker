"use client";

import { useState } from "react";
import { Slide } from "../lib/types";
import { loadApiKey, loadModel } from "./SettingsModal";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function makePlaceholder(text: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d")!;

  const grad = ctx.createLinearGradient(0, 0, 0, 1280);
  grad.addColorStop(0, "#1a1a2e");
  grad.addColorStop(1, "#16213e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 720, 1280);

  ctx.fillStyle = "rgba(255,122,26,0.15)";
  ctx.fillRect(0, 0, 720, 1280);

  const maxWidth = 600;
  const fontSize = 32;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.textAlign = "center";

  const words = text.split("");
  const lines: string[] = [];
  let line = "";
  for (const ch of words) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const lineH = fontSize * 1.5;
  const startY = 640 - (lines.length * lineH) / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, 360, startY + i * lineH);
  });

  ctx.fillStyle = "rgba(255,255,255,0.15)";
  ctx.font = "20px sans-serif";
  ctx.fillText("📸 画像をここにドロップ", 360, 900);

  return canvas.toDataURL("image/jpeg", 0.8);
}

function extractJson(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  const arrMatch = text.match(/\[[\s\S]*\]/);
  if (arrMatch) return arrMatch[0];
  return text.trim();
}

type Tone = "カジュアル" | "丁寧" | "熱量" | "シンプル";

const TONES: Tone[] = ["カジュアル", "丁寧", "熱量", "シンプル"];

interface AiSlide {
  caption?: string;
  overlayText?: string;
  overlayPosition?: string;
  overlaySize?: string;
  popupText?: string;
  duration?: number;
}

interface Props {
  onClose: () => void;
  onOpenSettings: () => void;
  onAddSlides: (slides: Slide[]) => void;
  grokContext?: string;
}

export default function AiGenerateModal({ onClose, onOpenSettings, onAddSlides, grokContext }: Props) {
  const [theme, setTheme] = useState("");
  const [count, setCount] = useState(5);
  const [tone, setTone] = useState<Tone>("カジュアル");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    const apiKey = loadApiKey();
    if (!apiKey) {
      onClose();
      onOpenSettings();
      return;
    }
    if (!theme.trim()) {
      setError("テーマを入力してください");
      return;
    }

    setLoading(true);
    setError("");

    const toneDesc: Record<Tone, string> = {
      カジュアル: "フレンドリーでくだけた口調",
      丁寧: "丁寧で礼儀正しい口調",
      熱量: "情熱的でエネルギッシュな口調",
      シンプル: "シンプルで簡潔な口調",
    };

    const systemPrompt = `あなたはスライド動画の台本を生成するアシスタントです。
ユーザーのテーマ・台本をもとに、指定された枚数のスライドデータを JSON 配列で出力してください。
出力は必ず以下のスキーマに従った JSON 配列のみにしてください（説明文不要）:

[
  {
    "caption": "画面下部のテロップ文字列（省略可）",
    "overlayText": "画面中央のオーバーレイテキスト（省略可、複数行は\\nで区切る）",
    "overlayPosition": "top | center | bottom（省略時は center）",
    "overlaySize": "small | medium | large（省略時は medium）",
    "popupText": "タップ位置ポップアップ文字列（省略可）",
    "duration": 数値（秒、3〜8の範囲）
  }
]

口調: ${toneDesc[tone]}
スライド枚数: ${count}枚`;

    const userMessage = grokContext
      ? `以下のGrokリサーチ結果とテーマをもとに${count}枚のスライドを生成してください:\n\n${grokContext}\n\n---\n\nテーマ・台本:\n${theme}`
      : `以下のテーマ・台本をもとに${count}枚のスライドを生成してください:\n\n${theme}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: loadModel(),
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data = await res.json() as {
        content: Array<{ type: string; text?: string }>;
      };
      const rawText = data.content.find((c) => c.type === "text")?.text ?? "";
      const jsonStr = extractJson(rawText);
      const aiSlides: AiSlide[] = JSON.parse(jsonStr);

      const newSlides: Slide[] = aiSlides.map((s) => {
        let overlayPosition: "top" | "center" | "bottom" = "center";
        if (s.overlayPosition === "top") overlayPosition = "top";
        else if (s.overlayPosition === "bottom") overlayPosition = "bottom";
        else if (s.overlayPosition === "middle") overlayPosition = "center";

        let overlaySize: "small" | "medium" | "large" = "medium";
        if (s.overlaySize === "small") overlaySize = "small";
        else if (s.overlaySize === "large") overlaySize = "large";

        const overlayText = s.overlayText ?? "";
        const caption = s.caption ?? "";
        const placeholder = makePlaceholder(overlayText || caption || "スライド");

        return {
          id: genId(),
          dataUrl: placeholder,
          tapPoint: null,
          caption,
          popupText: s.popupText ?? "",
          duration: Math.min(8, Math.max(3, s.duration ?? 3)),
          transition: "global" as const,
          overlayText,
          overlayPosition,
          overlaySize,
          audio: null,
          audioDuration: null,
          syncDuration: true,
        };
      });

      onAddSlides(newSlides);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#141414] rounded-t-2xl border-t border-[#2a2a2a] p-5 pb-10 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">✨ AIでスライドを生成</h2>
          <button
            onClick={onClose}
            className="text-[#666] text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Grok context badge */}
        {grokContext && (
          <div className="flex items-center gap-2 bg-[#ff7a1a]/10 border border-[#ff7a1a]/30 rounded-xl px-3 py-2">
            <span className="text-[#ff7a1a] text-sm">🔍</span>
            <p className="text-[#ff7a1a] text-xs font-semibold flex-1">Grokリサーチ結果を反映中</p>
          </div>
        )}

        {/* Theme */}
        <div className="space-y-2">
          <label className="text-[#aaa] text-sm font-semibold block">
            テーマ・台本
          </label>
          <textarea
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="例: スマホ写真をきれいに撮る5つのコツを紹介する動画"
            rows={4}
            className="w-full bg-[#1a1a1a] border border-[#333] text-white text-sm rounded-xl p-3 focus:outline-none focus:border-[#ff7a1a] resize-none"
          />
        </div>

        {/* Slide count */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[#aaa] text-sm font-semibold">スライド枚数</label>
            <span className="text-[#ff7a1a] font-bold text-sm tabular-nums">{count}枚</span>
          </div>
          <input
            type="range"
            min={3}
            max={10}
            step={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-[#ff7a1a] h-2"
          />
          <div className="flex justify-between text-[#555] text-xs">
            <span>3</span>
            <span>10</span>
          </div>
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <label className="text-[#aaa] text-sm font-semibold block">口調</label>
          <div className="grid grid-cols-2 gap-2">
            {TONES.map((t) => (
              <button
                key={t}
                onClick={() => setTone(t)}
                className={`h-11 rounded-xl text-sm font-semibold transition-colors ${
                  tone === t
                    ? "bg-[#ff7a1a] text-black"
                    : "bg-[#1a1a1a] border border-[#2a2a2a] text-[#888]"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-xl p-3">
            {error}
          </p>
        )}

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full bg-[#ff7a1a] text-black font-bold h-12 rounded-2xl text-base disabled:opacity-50"
        >
          {loading ? "生成中…" : "✨ 生成する"}
        </button>

        {loading && (
          <p className="text-[#666] text-xs text-center">
            Claude が台本を生成しています。しばらくお待ちください…
          </p>
        )}
      </div>
    </div>
  );
}
