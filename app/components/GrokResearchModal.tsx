"use client";

import { useState } from "react";
import { loadGrokKey } from "./SettingsModal";

type ResearchMode = "trend" | "viral" | "pain";

const MODES: { id: ResearchMode; label: string; emoji: string; desc: string }[] = [
  { id: "trend", label: "トレンドリサーチ", emoji: "📈", desc: "今バズってる話題を調査" },
  { id: "viral", label: "バズポスト分析", emoji: "🔥", desc: "競合の伸びてる投稿を分析" },
  { id: "pain", label: "悩みリサーチ", emoji: "💬", desc: "ターゲットの悩みを丸裸に" },
];

function buildPrompt(mode: ResearchMode, keyword: string): string {
  switch (mode) {
    case "trend":
      return `X（Twitter）で「${keyword}」に関する最新トレンドを調査してください。
・今バズっている話題・キーワード
・よく使われるハッシュタグ
・どんなコンテンツが伸びているか
・コンテンツ制作に活かせるインサイト
日本語で具体的にまとめてください。`;
    case "viral":
      return `X（Twitter）で「${keyword}」ジャンルの伸びているポスト・アカウントを調査してください。
・エンゲージメントが高い投稿の特徴
・よく使われる切り口・フォーマット
・バズっている理由の分析
・マネできる要素
日本語で具体的にまとめてください。`;
    case "pain":
      return `X（Twitter）で「${keyword}」に関してターゲット層が抱えている悩み・不満・困りごとを調査してください。
・よく見られるペインポイント
・解決されていない課題
・感情的な言葉・表現
・コンテンツに使えるキーワード
日本語で具体的にまとめてください。`;
  }
}

interface Props {
  onClose: () => void;
  onOpenSettings: () => void;
  onUseResearch: (context: string) => void;
}

export default function GrokResearchModal({ onClose, onOpenSettings, onUseResearch }: Props) {
  const [mode, setMode] = useState<ResearchMode>("trend");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [citations, setCitations] = useState<string[]>([]);

  async function handleSearch() {
    const grokKey = loadGrokKey();
    if (!grokKey) {
      onClose();
      onOpenSettings();
      return;
    }
    if (!keyword.trim()) {
      setError("キーワードを入力してください");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setCitations([]);

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${grokKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-3",
          messages: [
            {
              role: "user",
              content: buildPrompt(mode, keyword.trim()),
            },
          ],
          search_parameters: {
            mode: "on",
            sources: [{ type: "x" }, { type: "web" }],
          },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = (body as { error?: { message?: string } }).error?.message ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data = await res.json() as {
        choices: Array<{ message: { content: string } }>;
        citations?: string[];
      };
      const text = data.choices[0]?.message?.content ?? "";
      setResult(text);
      if (data.citations) setCitations(data.citations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "検索に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  function handleUse() {
    if (!result) return;
    const selectedMode = MODES.find((m) => m.id === mode)!;
    const context = `【Grokリサーチ結果: ${selectedMode.label}「${keyword}」】\n\n${result}`;
    onUseResearch(context);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#141414] rounded-t-2xl border-t border-[#2a2a2a] p-5 pb-10 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">🔍 Grokリサーチ</h2>
          <button
            onClick={onClose}
            className="text-[#666] text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Mode selector */}
        <div className="space-y-2">
          <label className="text-[#aaa] text-sm font-semibold block">リサーチタイプ</label>
          <div className="flex flex-col gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  mode === m.id
                    ? "border-[#ff7a1a] bg-[#ff7a1a]/10"
                    : "border-[#2a2a2a]"
                }`}
              >
                <span className="text-xl">{m.emoji}</span>
                <div>
                  <p className={`text-sm font-semibold ${mode === m.id ? "text-white" : "text-[#888]"}`}>
                    {m.label}
                  </p>
                  <p className="text-xs text-[#555]">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Keyword */}
        <div className="space-y-2">
          <label className="text-[#aaa] text-sm font-semibold block">キーワード</label>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
            placeholder="例: ダイエット、副業、英語学習"
            className="w-full bg-[#1a1a1a] border border-[#333] text-white text-sm rounded-xl h-11 px-3 focus:outline-none focus:border-[#ff7a1a]"
          />
        </div>

        {error && (
          <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/30 rounded-xl p-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSearch}
          disabled={loading}
          className="w-full bg-[#ff7a1a] text-black font-bold h-12 rounded-2xl text-base disabled:opacity-50"
        >
          {loading ? "リサーチ中…" : "🔍 リサーチする"}
        </button>

        {loading && (
          <p className="text-[#666] text-xs text-center">
            Grokが X をリサーチしています。しばらくお待ちください…
          </p>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4 text-[#ddd] text-sm leading-relaxed whitespace-pre-wrap">
              {result}
            </div>

            {citations.length > 0 && (
              <div className="space-y-1">
                <p className="text-[#555] text-xs font-semibold">参照元</p>
                {citations.slice(0, 5).map((url, i) => (
                  <p key={i} className="text-[#444] text-xs truncate">{url}</p>
                ))}
              </div>
            )}

            <button
              onClick={handleUse}
              className="w-full bg-[#1a1a1a] border border-[#ff7a1a]/60 text-[#ff7a1a] font-bold h-12 rounded-2xl text-sm"
            >
              ✨ このリサーチをAI生成に使う
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
