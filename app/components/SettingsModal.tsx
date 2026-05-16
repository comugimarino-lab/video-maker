"use client";

import { useEffect, useRef, useState } from "react";

const LS_API_KEY = "svm-api-key";
const LS_MODEL = "svm-model";

export const AI_MODELS = [
  { id: "claude-haiku-4-5", label: "Haiku 4.5（高速・低コスト）" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6（高品質）" },
] as const;

export type AiModelId = (typeof AI_MODELS)[number]["id"];

export function loadApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_API_KEY) ?? "";
}

export function loadModel(): AiModelId {
  if (typeof window === "undefined") return "claude-haiku-4-5";
  const saved = localStorage.getItem(LS_MODEL);
  return (AI_MODELS.find((m) => m.id === saved)?.id ?? "claude-haiku-4-5") as AiModelId;
}

interface Props {
  onClose: () => void;
}

export default function SettingsModal({ onClose }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<AiModelId>("claude-haiku-4-5");
  const [showKey, setShowKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(loadApiKey());
    setModel(loadModel());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  function handleSave() {
    localStorage.setItem(LS_API_KEY, apiKey.trim());
    localStorage.setItem(LS_MODEL, model);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg bg-[#141414] rounded-t-2xl border-t border-[#2a2a2a] p-5 pb-10 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">⚙️ 設定</h2>
          <button
            onClick={onClose}
            className="text-[#666] text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-[#aaa] text-sm font-semibold block">
            Anthropic API キー
          </label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="flex-1 bg-[#1a1a1a] border border-[#333] text-white text-sm rounded-xl h-11 px-3 focus:outline-none focus:border-[#ff7a1a] font-mono"
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              className="bg-[#1a1a1a] border border-[#333] text-[#888] text-sm rounded-xl h-11 px-3 min-w-[44px]"
            >
              {showKey ? "隠す" : "表示"}
            </button>
          </div>
          <p className="text-[#555] text-xs leading-snug">
            APIキーはこのブラウザの localStorage にのみ保存され、サーバーには送信されません。
          </p>
        </div>

        {/* Model */}
        <div className="space-y-2">
          <label className="text-[#aaa] text-sm font-semibold block">モデル</label>
          <div className="flex flex-col gap-2">
            {AI_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => setModel(m.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                  model === m.id
                    ? "border-[#ff7a1a] bg-[#ff7a1a]/10 text-white"
                    : "border-[#2a2a2a] text-[#888]"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    model === m.id ? "border-[#ff7a1a]" : "border-[#444]"
                  }`}
                >
                  {model === m.id && (
                    <div className="w-2 h-2 rounded-full bg-[#ff7a1a]" />
                  )}
                </div>
                <span className="text-sm">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          className="w-full bg-[#ff7a1a] text-black font-bold h-12 rounded-2xl text-base"
        >
          保存
        </button>
      </div>
    </div>
  );
}
