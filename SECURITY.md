# Security Policy

SporTagLytics は Electron デスクトップアプリケーションです。脆弱性の報告では、ユーザーデータ、ローカルファイルアクセス、IPC、preload、署名済み配布物への影響を重視します。

通常のデータ保存場所と外部送信の有無は [Privacy and Data Handling](docs/privacy-and-data-handling.md) を参照してください。

## Supported Versions

| Version        | Supported   |
| -------------- | ----------- |
| Latest release | Yes         |
| Older releases | Best effort |

## Reporting a Vulnerability

セキュリティ問題を見つけた場合は public issue を作成しないでください。

1. GitHub の Security Advisory 機能が利用できる場合は、リポジトリの **Report a vulnerability** から報告してください。
2. Security Advisory が利用できない場合は、GitHub 上のメンテナへ非公開で連絡してください。
3. 報告には、影響範囲、再現手順、確認した OS / app version、関連ログを含めてください。

## Scope

対象:

- Electron main / preload / renderer 境界
- IPC payload / sender validation
- ローカルファイル読み書き、パッケージ読み込み、エクスポート
- 配布物、署名、公証、アップデート手順

対象外:

- サポート終了済み OS 固有の問題
- 物理アクセスを前提とする端末侵害
- ユーザーが明示的に読み込んだ信頼できない動画ファイル自体の codec 実装問題

## Security Baseline

実装時は `AGENTS.md` の Electron セキュリティ基準を維持してください。

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- 汎用 IPC event bus を追加しない
- renderer からの Electron 呼び出しは `window.electronAPI` の明示 API のみ
