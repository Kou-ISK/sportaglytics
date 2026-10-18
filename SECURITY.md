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

1. [Securityページ](https://github.com/Kou-ISK/sportaglytics/security)で **Report a vulnerability** が表示される場合は、[非公開報告フォーム](https://github.com/Kou-ISK/sportaglytics/security/advisories/new)から報告してください。フォームの利用可否はGitHub側の設定とログイン状態に依存します。この文書だけで有効化済みとは保証しません。
2. フォームが利用できない場合、現在この文書に確認済みの代替メールアドレス等は掲載していません。[Discussions](https://github.com/Kou-ISK/sportaglytics/discussions)には「非公開のセキュリティ連絡先を案内してください」という窓口案内の依頼だけを投稿できます。脆弱性の種類、影響先、再現コードやログは公開せず、管理者が非公開窓口を案内するまで詳細を保留してください。これは脆弱性を送る非公開窓口の代替ではありません。
3. 非公開窓口を利用できる状態になったら、影響範囲、最小の再現手順、確認したOS / app version、必要な範囲のログを含めてください。実試合映像、私有パッケージ、認証情報、個人を特定する内容を添付せず、合成データで再現してください。

管理者は非公開報告フォームの到達性を確認し、利用できない場合は実在する代替窓口を確認したうえでここへ掲載する必要があります。未確認の連絡先やGitHubに存在しないDM機能を案内しません。

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
