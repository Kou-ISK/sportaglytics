# Privacy and Data Handling

SporTagLytics は local-first の Electron desktop app です。このドキュメントは、アプリが扱うデータ、保存場所、外部送信の有無を説明します。

## Summary

- 映像、タイムライン、プレイリスト、分析データはユーザーのローカルディスクに保存されます。
- 現行アプリは cloud sync、telemetry、remote analytics、cloud LLM provider を実装していません。
- AI 分析はローカル llama.cpp 実行を標準境界とし、外部 API へ映像やタイムラインを送信しません。
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
| Exported clips, PNG, PDF, timeline export | User-selected save location                                           | Created only after explicit user action        |
| GGUF model files                          | `public/llama/models/*.gguf` or packaged app resource `llama/models/` | Large local files; not managed by git          |
| llama.cpp binary                          | Environment path, app resources, or `public/llama/<platform>/`        | Executed locally by Electron main process      |

## External Transmission

The app does not send match footage, timeline data, labels, notes, dashboard templates, or AI prompts to a remote service in the current implementation.

Network access can still happen outside the app when the user manually uses GitHub Releases, Homebrew, package managers, or external links. Those operations are outside SporTagLytics runtime data processing.

## AI Analysis

AI analysis builds prompts from local timeline data, labels, memo fields, statistics, and selected evidence. The prompt is written to a temporary local file and passed to a local llama.cpp child process by Electron main process.

Cloud LLM providers, remote embedding services, or any network transport for AI analysis are not part of the current contract. Adding them requires a new ADR or an update to ADR 0005, plus explicit user-facing privacy documentation and settings UI.

## Sharing and Issue Reports

When opening public issues or PRs:

- Do not attach real match footage unless you have permission to publish it.
- Redact team names, athlete names, file paths, and private notes when they are not needed.
- Prefer minimal synthetic `.stpkg`, `.stpl`, `.stad`, or JSON snippets for reproduction.
- Security-sensitive reports should follow [SECURITY.md](../SECURITY.md), not public issues.

## Removing Local Data

- Delete project packages, playlists, dashboards, and exports from the locations where you saved them.
- Reset app settings from the app UI when available, or remove `settings.json` under Electron `userData`.
- Clear recent packages from the app menu / OS recent documents when needed.
- Delete local GGUF models from `public/llama/models/` or the packaged resource location you configured.
