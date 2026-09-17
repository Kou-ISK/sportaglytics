# Privacy and Data Handling

SporTagLytics は local-first の Electron desktop app です。このドキュメントは、アプリが扱うデータ、保存場所、外部送信の有無を説明します。

## Summary

- 映像、タイムライン、プレイリスト、分析データはユーザーのローカルディスクに保存されます。
- 現行アプリは cloud sync、telemetry、remote analytics、cloud LLM provider を実装していません。
- AI 分析はローカル llama.cpp 実行を標準境界とし、外部 API へ映像やタイムラインを送信しません。
- YouTube音声アシストは、macOS 13以降またはWindowsでユーザーが明示的に開始した時だけ表示中のシステム再生音を取得し、メモリ上で解析します。取得音声はファイルへ保存しません。
- 将来 cloud LLM や外部送信を追加する場合は、ADR とユーザー向け docs の更新を必須とします。

関連 ADR:

- [0005 Local LLM Analysis Boundary](adr/0005-local-llm-analysis-boundary.md)
- [0006 Application Document Formats and File Associations](adr/0006-application-document-formats-and-file-associations.md)

## Stored Data

| Data                                      | Location / owner                                                      | Notes                                          |
| ----------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Project package                           | User-selected `.stpkg` package                                        | `videos/`, `timeline.json`, `.metadata/`       |
| Playlist package                          | User-selected `.stpl` package                                         | `playlist.json`, optional embedded `videos/`   |
| Code window layout                        | User-selected `.stcw` document                                        | JSON document                                  |
| Dashboard template                        | User-selected `.stad` package                                         | dashboard import/export document               |
| App settings                              | Electron `app.getPath('userData')/settings.json`                      | Theme, hotkeys, code window settings, AI prefs |
| Recent package list                       | Renderer `localStorage` and OS recent documents                       | Stores local paths only                        |
| Onboarding completion                     | Renderer `localStorage` key `sportaglytics-onboarding-completed`      | Boolean flag                                   |
| LLM prompt/schema temporary files         | OS temp directory as `sportaglytics-llama-*` during local generation  | Removed after request on best effort           |
| YouTube音声アシストの取得音声             | Renderer process memory                                               | 15秒の解析後、キャンセル、エラー時に破棄       |
| Exported clips, PNG, PDF, timeline export | User-selected save location                                           | Created only after explicit user action        |
| GGUF model files                          | `public/llama/models/*.gguf` or packaged app resource `llama/models/` | Large local files; not managed by git          |
| llama.cpp binary                          | Environment path, app resources, or `public/llama/<platform>/`        | Executed locally by Electron main process      |

## External Transmission

The app does not upload local match footage, timeline data, labels, notes, dashboard templates, captured system audio, or AI prompts to a remote service in the current implementation.

YouTube映像を再生する場合は、入力されたURLに基づいてYouTubeの埋め込みプレイヤーへネットワーク接続します。音声アシストは再生中の音をローカルで解析し、YouTubeの音声URL解決、ダウンロード、一時ファイル保存は行いません。

## System Audio Capture

- macOS 13以降またはWindowsで、ユーザーが「音声で微調整」を押した場合だけloopback captureを許可します。
- OSのシステム音声取得許可が必要です。拒否または非対応環境では通常の手動配置を維持します。
- 取得中は対象外のアプリ音声が混入する可能性があります。解析前に他アプリの音声を停止してください。
- MediaStreamの全trackは解析終了、キャンセル、エラー時に停止し、取得データを永続化しません。

Network access can still happen outside the app when the user manually uses GitHub Releases, Homebrew, package managers, or external links. Those operations are outside SporTagLytics runtime data processing.

## AI Analysis

AI analysis builds prompts from local timeline data, labels, memo fields, statistics, and selected evidence. The prompt is written to a temporary local file and passed to a local llama.cpp child process by Electron main process.

Cloud LLM providers, remote embedding services, or any network transport for AI analysis are not part of the current contract. Adding them requires a new ADR or an update to ADR 0005, plus explicit user-facing privacy documentation and settings UI.

## Sharing and Issue Reports

このリポジトリのコード、ドキュメント、fixture、コミット、PR、Issue、添付画像・ログは公開情報として扱います。利用者がローカルの映像やCodingを調査・学習・検証に使うことを許可しても、それらの公開を許可したことにはなりません。

- 公開許可のない氏名・連絡先・端末のユーザー名・ホームディレクトリ・私的なメモ・アカウントの請求状態を含めません。CIの結果は成功・失敗・未実行と技術的な影響を記載し、私的なアカウント事情は転載しません。
- 実試合の映像、スクリーンショット、Coding、日付・対戦カード・得点を含むファイル名は、公開許可なしに掲載しません。再現例は `Team A` / `Team B`、`fixtures/sample-match.stpkg` などの架空名・相対パスと合成データを使います。確認した構造や匿名化した集計値は、元データを特定できない範囲で説明します。
- 生の調査・学習データは別の非公開領域に保持します。ローカルの `research/` と `output/playwright/` はGitの対象外です。無視設定は事故の予防であり、添付ファイルの安全性や既存のGit履歴からの削除を保証しません。
- 公開前に、差分だけでなくPR本文、コメント、ログ、画像、ファイル名、コミットの著者名・メールを確認します。ログや画像は合成データで取り直すか、必要な箇所だけを匿名化して共有します。コミットには公開用の名前とGitHubのnoreplyメールを使用し、個人用メールを追加しません。
- 既に公開した本文や現行ファイルは修正します。Git履歴・PRの差分・外部のコピーに情報が残る場合があるため、通常の削除コミットを完全削除とは扱いません。公開履歴の書換えは共同作業への影響を確認し、明示的な承認を得てから行います。

プロジェクトの公開URL・公開ハンドル、ライセンス表記、第三者の権利表示は維持します。セキュリティに関する報告は公開Issueではなく [SECURITY.md](../SECURITY.md) に従ってください。

## Removing Local Data

- Delete project packages, playlists, dashboards, and exports from the locations where you saved them.
- Reset app settings from the app UI when available, or remove `settings.json` under Electron `userData`.
- Clear recent packages from the app menu / OS recent documents when needed.
- Delete local GGUF models from `public/llama/models/` or the packaged resource location you configured.
