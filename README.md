# 📱 スクショ動画メーカー

スクリーンショットから解説動画（縦型・9:16）をスマホ完結で作れる Web アプリです。

## 特徴

- **クライアント完結** — 画像はサーバーに送信されません。すべてブラウザ内で処理します
- **Chrome / Android Safari** → `canvas.captureStream()` + `MediaRecorder` で WebM を生成
- **iOS Safari** → `ffmpeg.wasm` を使って MP4 (H.264) を生成（初回のみ約 31MB の WASM をロード）
- ドラッグ&ドロップでスライドの並び替えが可能

## 使い方

### 0. アスペクト比を選択

画面上部のトグルで出力サイズを切り替えます。選択は `localStorage` に保存され、次回起動時に復元されます。

| モード | 解像度 | 用途 |
|--------|--------|------|
| 縦 9:16（リール）| 720 × 1280 | Instagram Reels / TikTok / スマホ縦動画 |
| 横 16:9 | 1280 × 720 | YouTube / PC 向け横動画 |

- **9:16 モード**: スクショを中央に収まるよう `contain` フィット（上下・左右に黒余白）
- **16:9 モード**: スクショを最大限にフィット（`cover`、はみ出し部分をクロップ）

サムネイルの縦横比もトグルに連動して切り替わります。

### 1. 画像を追加

「📸 画像を追加」エリアをタップして、スクリーンショットを1枚以上選択します。複数まとめて選択できます。

### 2. 各スライドを編集

追加した画像はカード形式で表示されます。各カードで以下を設定できます。

| 機能 | 説明 |
|------|------|
| サムネイルをタップ | タップした座標をタップ位置として保存。黄色いリングが3回アニメします |
| 中央をタップ位置に | サムネイル中央を自動でタップ位置に設定 |
| 全画面自動配置 | タップ位置をリセット（リング・ポップアップなし） |
| テロップ | 画面下部に白文字で字幕を表示 |
| ポップアップ文字 | タップ位置の近くに黄色バッジでテキストを表示 |
| 表示秒数 | 1〜10秒の範囲で設定（デフォルト 3秒） |
| ⠿ ドラッグ | カードを長押し→ドラッグで順序を変更 |

### 3. プレビュー再生

「▶ プレビュー」ボタンをタップすると、Canvas 上で全スライドをループ再生します。
画面右上に「現在のスライド / 総数」が表示されます。

### 4. 動画を書き出す

「⬇ 動画を書き出す」ボタンをタップします。

- **Chrome / Android Safari**: `output.webm` をダウンロード
- **iOS Safari**: `ffmpeg.wasm` を使って `output.mp4` をダウンロード
  （初回のみ数十秒かかります。プログレスバーで進捗を確認できます）

## 開発環境のセットアップ

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

> **Note:** ffmpeg.wasm は SharedArrayBuffer を使用するため、`Cross-Origin-Opener-Policy: same-origin` および `Cross-Origin-Embedder-Policy: require-corp` ヘッダーが必要です。`next.config.ts` で設定済みです。

## ビルド

```bash
npm run build
npm start
```

## 技術スタック

- [Next.js](https://nextjs.org) 16 (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com) v4
- [@dnd-kit](https://dndkit.com) — ドラッグ&ドロップ
- [ffmpeg.wasm](https://ffmpegwasm.netlify.app) 0.12 — iOS Safari 向け MP4 書き出し

## ブラウザ対応

| ブラウザ | 動作 | 出力形式 |
|---------|------|---------|
| Chrome (PC / Android) | ✅ | WebM |
| Android Chrome / Samsung Internet | ✅ | WebM |
| iOS Safari 15.2+ | ✅ (ffmpeg.wasm) | MP4 |
| iOS Safari 15.1以下 | ⚠️ 未検証 | — |
