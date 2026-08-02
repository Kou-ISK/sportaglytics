# Project Structure

このドキュメントは SporTagLytics のディレクトリ構成と配置判断ルールです。アーキテクチャ規約の正本は `AGENTS.md`、現行アーキテクチャ要約は [system-overview.md](system-overview.md) です。本書は「新しいファイルをどこに置くか」を判断するための実務ガイドです。

## Top-Level Layout

| Path        | Role                                                       | Placement rule                                                                                   |
| ----------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `.github/`  | GitHub workflows、PR/Issue templates、Copilot instructions | GitHub 上の運用・自動化・AI 指示だけを置く                                                       |
| `docs/`     | 利用者/開発者/設計ドキュメント                             | 仕様、運用、ADR、配布手順を置く。新規 docs は `docs/README.md` に掲載する                        |
| `electron/` | Electron main / preload process                            | Node/Electron API、IPC handler、BrowserWindow、preload bridge を置く                             |
| `public/`   | Vite/Electron に同梱する静的 assets                        | アイコン、静的テンプレート、同梱 runtime assets を置く。大型ローカル LLM model は git 管理しない |
| `scripts/`  | 開発・CI 補助スクリプト                                    | architecture check、preload check、report など repo 全体の検査・生成を置く                       |
| `src/`      | React renderer application                                 | UI、features、shared domain、renderer 型を置く。Electron の直接 import は置かない                |
| root files  | package/config/community health                            | `package.json`、TS/ESLint/Vite 設定、README、LICENSE、CONTRIBUTING など repo 入口を置く          |

## Renderer Layout

Renderer は Feature-First です。依存方向は `pages -> features -> shared` を維持します。

| Path                      | Role                         | Put here                                                                                     |
| ------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| `src/pages/`              | top-level page wrapper       | routing / entry composition だけ。feature deep import はせず public index 経由にする         |
| `src/features/<feature>/` | feature implementation       | feature 固有の Screen、Controller/Hook、View、Gateway、domain logic                          |
| `src/components/ui/`      | shared UI design-system      | feature 非依存の primitives / composites / patterns                                          |
| `src/components/`         | legacy/shared components     | 複数 feature で使う UI。新規 shared UI は可能なら `src/components/ui/` へ寄せる              |
| `src/hooks/`              | truly shared hooks           | feature 固有 state を持たない cross-feature hook                                             |
| `src/contexts/`           | truly shared contexts        | アプリ横断の状態だけ。feature 専用 context は feature 配下へ置く                             |
| `src/shared/`             | shared domain / gateway      | feature 非依存の domain service、shared gateway、cross-feature contract                      |
| `src/types/`              | shared type contracts        | analysis / ipc / package / playlist / settings / timeline / video など use-case 単位の共有型 |
| `src/utils/`              | shared pure helpers          | Electron、URL、永続化に直接触れない pure helper                                              |
| `src/report/`             | report-specific shared logic | analysis report data / print layout など report 横断処理                                     |

## Feature Layout

feature 配下は機能責務で分割します。Atomic Design の分類を feature フォルダへ持ち込まないでください。

パッケージ作成の映像選択 UI は `src/features/videoPlayer/components/Setup/VideoPathSelector/steps/` に Controller / View を置き、アングル一覧とクリップシーケンスの2ペイン描画部品は `steps/videoSelection/` に配置します。`VideoSelectionStepView` はYouTube URL入力だけを必要時にダイアログ表示し、同期位置は作成画面で扱いません。クリップ単位シンクの状態制御は `src/features/videoPlayer/app/hooks/sync/useClipTimelineSyncController.ts`、描画は `src/features/videoPlayer/app/components/ClipSyncControlsView.tsx` に分離します。描画部品は props と callback のみに依存し、IPC と file dialog は gateway / hook に閉じ込めます。

| Path                      | Role                                                               |
| ------------------------- | ------------------------------------------------------------------ |
| `index.ts`                | feature 外へ公開する API。feature 外からの import はここに限定する |
| `*Screen.tsx`             | feature entry。画面構成と Controller/View 合成を担当               |
| `components/`             | feature 固有 UI。複雑な UI は View と Controller/Hook を分ける     |
| `controllers/`            | feature 固有の controller hooks / state orchestration              |
| `hooks/`                  | feature 内で再利用する hook                                        |
| `gateways/` or `gateway/` | Electron、URL、localStorage、file dialog など外部境界              |
| `utils/`                  | feature 固有 pure helper / domain calculation                      |
| `shared/`                 | 同一 feature 内の sub-domain 共有。feature 外 shared と混同しない  |
| `testing/`, `fixtures/`   | feature 固有 fixture / mock data。必要になった時点で追加する       |

### Current Features

| Feature                        | Responsibility                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/features/videoPlayer/`    | package loading、video playback、timeline editing、analysis panel、AI analysis integration |
| `src/features/playlist/`       | playlist window、playlist state、annotations、clip export integration                      |
| `src/features/settings/`       | app settings、hotkeys、code window editor primitives                                       |
| `src/features/analysisReport/` | printable/exportable analysis report screen and report gateway                             |

## Electron Layout

| Path                                                 | Role                                  | Placement rule                                                          |
| ---------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------- |
| `electron/src/main.ts`                               | app startup / top-level assembly      | 詳細な domain logic を増やさず、登録・組み立てに留める                  |
| `electron/src/ipc/`                                  | main process IPC handlers             | domain ごとに handler を分け、payload guard と sender validation を行う |
| `electron/src/ipc/packageMediaCompositionService.ts` | package media materialization         | ローカル元クリップの検査・コピー、書き出し用の一時FFmpeg合成            |
| `electron/src/ipc/packageClipTimelineService.ts`     | clip timeline application             | 配置・重複・範囲の検証、configの原子的更新                              |
| `electron/src/ipc/exportVirtualTimelineSource.ts`    | export timeline adapter               | 仮想ローカルタイムラインを書き出し時だけOS一時領域へ実体化              |
| `electron/src/loopbackAudioCapture.ts`               | macOS loopback capture authorization  | 対応OS判定、ユーザー操作単位の許可、display media requestの制限         |
| `electron/src/preload.ts`                            | preload bridge assembly               | domain bridge を合成する entry に留める                                 |
| `electron/src/preload/`                              | preload domain bridges                | `contextBridge` で公開する明示 API と typed listener store              |
| `electron/tsconfig.json`                             | Electron typecheck                    | no emit。AGENTSの品質ゲートから実行する                                 |
| `electron/tsconfig.build.json`                       | Electron main process build           | preloadを除外し、Viteの単一bundleを上書きしない                         |
| `electron/src/menu/`                                 | application menu helpers              | menu section、recent package menu、window action helpers                |
| `electron/src/playlistWindow/`                       | playlist sub-window main-side runtime | playlist window handler、storage、window manager                        |
| `electron/src/llama/`                                | local LLM process helpers             | model discovery、process runner、request registry、output normalization |
| `electron/src/templates/`                            | generated platform templates          | Info.plist など build/package 用 template                               |

## Documentation Layout

| Path                                                                        | Role                           |
| --------------------------------------------------------------------------- | ------------------------------ |
| `docs/README.md`                                                            | docs index。新規 docs の掲載先 |
| `docs/documentation-guide.md`                                               | docs 運用ルール                |
| `docs/testing.md`                                                           | テストと品質ゲート             |
| `docs/system-overview.md`                                                   | 現行アーキテクチャ要約         |
| `docs/project-structure.md`                                                 | ディレクトリ構成と配置判断     |
| `docs/adr/`                                                                 | Architecture Decision Records  |
| `docs/*-features.md`, `docs/*-implementation.md`, `docs/*-specification.md` | feature/spec note              |
| `docs/privacy-and-data-handling.md`                                         | privacy / local data handling  |
| `docs/homebrew-*`                                                           | 配布・導入手順                 |

## Placement Decisions

新しいファイルを追加する時は、次の順で判断します。

1. ユーザー操作や feature 固有の状態に関わるなら `src/features/<feature>/`。
2. 複数 feature で使う純粋な計算なら `src/shared/<domain>/` または `src/utils/`。
3. 複数 feature で使う共有型なら `src/types/<domain>/`。
4. Electron / filesystem / window / menu / native process に触るなら `electron/src/` または renderer gateway。
5. Renderer から Electron API を呼ぶなら feature/shared の `gateways/` に閉じ込め、View から直接呼ばない。
6. ユーザー向け説明、開発手順、設計判断なら `docs/`。
7. GitHub issue / PR / workflow / Copilot 運用なら `.github/`。

## Do Not Put Here

- `src/pages/`: business logic、state orchestration、Electron access。
- `src/components/ui/`: feature 固有 hook、feature 固有 state、Electron access。
- `src/shared/`, `src/utils/`: feature import、Electron direct import、file dialog、window access。
- `electron/src/main.ts`: 大きな domain logic、個別 feature の詳細処理。
- `.github/instructions/*.instructions.md`: 一般規約の重複本文。差分ルールだけを書く。
- `docs/adr/`: 実装差分の羅列、一時メモ、作業ログ。ADR には長期的な判断背景だけを書く。

## Generated / Local Artifacts

| Path                           | Handling                           |
| ------------------------------ | ---------------------------------- |
| `build/`, `dist/`, `coverage/` | generated output。git 管理しない   |
| `.tmp_llama/`                  | local LLM 作業領域。git 管理しない |
| `public/llama/models/*.gguf`   | large local model。git 管理しない  |
| `.DS_Store`, local env files   | git 管理しない                     |

## Checks

構成変更後は最低限以下を実行します。

```bash
pnpm run check:architecture
pnpm run report:architecture-health
pnpm run report:large-files
```

PR では `AGENTS.md` の品質ゲート 5 コマンドを通してください。
