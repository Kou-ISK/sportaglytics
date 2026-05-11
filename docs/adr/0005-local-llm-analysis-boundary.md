# 0005 Local LLM Analysis Boundary

## Status

Accepted

## Date

2026-05-05

## Context

AI 分析機能はタイムライン、ラベル、メモ、統計情報を根拠に回答と推奨クリップを生成します。スポーツ映像や分析メモはローカルプロジェクトデータであり、外部送信を前提にするとプライバシー、再現性、配布、利用者説明の責務が大きく変わります。

現行実装は local llama.cpp を Electron main process 側で実行し、renderer は `window.electronAPI.llama` 経由の明示 API を使います。GGUF モデルはユーザーが配置する大型 asset であり、git 管理対象ではありません。

## Decision

AI 分析の標準境界はローカル LLM / llama.cpp とします。

- LLM 実行は Electron main process 側に閉じ込め、renderer UI から直接 native process を起動しない。
- Renderer からは typed preload API / gateway を通して model discovery、generation、cancel、progress を扱う。
- プロンプト、schema、process execution、timeout、cancel、cleanup は main-side helper に集約する。
- GGUF モデルファイルは `public/llama/models/*.gguf` または packaged resources に配置し、git 管理しない。
- llama.cpp binary は環境変数、packaged resources、開発用 `public/llama/<platform>/` の順で解決する。
- Cloud LLM、外部 API provider、データ送信を伴う分析を追加する場合は、別 ADR で privacy、provider boundary、設定 UI、失敗時 fallback を定義してから実装する。

## Consequences

- ユーザーデータをローカル処理に閉じ込める説明を維持できる。
- AI 分析の失敗原因は model / binary / process / timeout に集中し、main process 側で診断しやすい。
- 配布物に大型モデルを含めず、ユーザー環境ごとのモデル選択を許容できる。
- Cloud provider を後から追加する場合は UX と privacy contract が変わるため、追加設計と docs 更新が必須になる。
