# Testing and Quality Gates

このドキュメントは SporTagLytics のテストと品質ゲート運用ガイドです。必須コマンドの正本は `AGENTS.md` です。

複数アングル同期の必須検証は[アングル同期仕様](angle-synchronization.md#実装と検証)を参照してください。`scripts/e2e-multi-clip-playback.mjs` は25/50fpsの架空映像で、アングルの連続操作、同期点、コマ送り、実ウィンドウ比率、Playlist/Paintの境界シーク、正負オフセットの出力画素・尺を確認します。`e2e-angle-sync-gaps.mjs`は30秒/10秒/5秒でタイムラインのつまみ操作、本数の異なる同期、途中の黒表示、再読込と出力画素を確認します。`e2e-angle-sync-multi.mjs`は3/4アングルと可変フレーム間隔を確認します。実試合の映像は不要です。

## Required Quality Gate

PR前に以下を通します。

```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

ADR変更時:

```bash
pnpm run check:adr
```

| Command                                   | Purpose                           |
| ----------------------------------------- | --------------------------------- |
| `pnpm exec tsc --noEmit`                  | renderer/shared TypeScript        |
| `pnpm exec tsc -p electron/tsconfig.json` | Electron main/preload TypeScript  |
| `pnpm run lint`                           | ESLint zero warnings              |
| `pnpm run check:architecture`             | Feature-First / Electron boundary |
| `pnpm run check:adr`                      | ADR filename/index consistency    |
| `pnpm run test:run`                       | Vitest one-shot                   |
| `pnpm run test:ci`                        | serialized Vitest CI run          |
| `pnpm run check:preload`                  | preload bundle sanity             |
| `pnpm run report:architecture-health`     | architecture report               |
| `pnpm run report:large-files`             | soft file-size report             |

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestでfrozen install、lint、renderer/electron typecheck、architecture、ADR、Vitestを実行します。Model training/evaluationのCIは別private R&D repositoryの責務です。

## Test Placement

すべてのfixture・検証ログ・スクリーンショットは [公開時のデータ取り扱い](privacy-and-data-handling.md#sharing-and-issue-reports) に従います。実データでのみ確認できる検証はローカルで行い、公開する再現例には架空の識別情報と合成データを使います。

- pure domain logic → 同ディレクトリの `*.test.ts`
- React behavior → `*.test.tsx`
- shared contract / normalizer → contract近傍のtest
- Electron menu/manager pure behavior → `electron/src/**.test.ts`
- real BrowserWindow / file association / preload bundling → E2E

Heavy model weightやtraining frameworkをSporTagLytics unit testで取得しません。Public repositoryではmodel pack consumer boundaryだけをtestします。

## Settings / Timeline / IPC

Settingsやmigrationでは新fieldの保存読込、legacy default、invalid value正規化を検証します。Code Windowの `leadTimeSeconds` / `lagTimeSeconds` は未設定時0秒相当を維持します。

Timeline変更ではrange normalization、row ownership、history/Undo単位、duplicate/copy semanticsを検証します。自動Codingは `addTimelineDatas()` の1 state updateで追加するため、一括Undoを前提にします。

IPC / preload変更ではpayload guard、sender validation、explicit API、listener cleanup、invalid result rejectionを確認します。

```bash
pnpm run bundle:preload
pnpm run check:preload
```

## Automatic Event Detection Tests

SporTagLytics側では次を確認します。

- recording lead/lag range
- confidence filter
- lead/lag Timeline変換
- existing/same-run duplicate suppression
- model quality gate
- settings migration
- Timeline reopen menu
- verified manifest / runner SHA-256 / path traversal validation
- request/result IPC validation
- 新規作成直後の全クリップの実パス、Windows/UNCのパス、拡張子なしで保存された旧履歴の復元
- 欠落・ディレクトリ・読み取り不能の入力をランナー起動前に拒否し、対象ファイルを案内
- cancel / timeout / bounded child process behavior

Runtime quality gateはRecall優先です。最低条件はclassごとにRecall >= 0.95、match-level unseen evaluation >= 5で、Precisionは有限な0〜1の値として記録します。

高Recall operating pointでのfalse positives per match、処理時間、manual edit operations、実作業時間削減はprivate R&D qualificationで検証し、実用的でないmodelを`verified`へ昇格させない前提です。

## Model R&D Tests

Dataset preparation、training、hard-negative mining、threshold/NMS/stride探索、held-out qualification、model exportのtestは別private R&D repositoryで管理します。

Public repositoryのCIやtest fixtureへ、実チーム名、実試合名、ローカル絶対path、実動画file名、private diagnostic outputを持ち込みません。

## E2E

- `pnpm run test:e2e:timeline-rows`: 分離Timelineの行・インスタンス操作、削除とUndo、フォーカスと入力欄の保護。
- `pnpm run test:e2e:paint-export`: 実Canvas・IPC・FFmpegによるPaint映像出力。生成映像の画素・音声・尺を検査し、単画面／全アングル／異解像度の2画面と複数フリーズを確認。

```bash
pnpm run test:e2e
```

`test:e2e:event-detection`は新規作成ウィザードから、ローカル映像2本の追加、直後の検出要求、通常Timelineへの保存、実パスでの履歴登録、旧履歴からの再オープンを検証します。OSの選択結果とモデルIPCだけをstub化し、パッケージ作成・入力ファイルの読み取り確認・Timeline永続化は実処理を使います。開いている検出フォームのモデル一覧が背景更新で再取得されないことも確認します。このE2Eは学習済みモデルの精度や全試合推論の証拠にはしません。Windowsではインストール後の検証にも含めます。

個別:

```bash
pnpm run test:e2e:clip-sync
pnpm run test:e2e:event-detection
pnpm run test:e2e:code-window-menu
pnpm run test:e2e:export-progress
pnpm run test:e2e:export-menu
pnpm run test:e2e:export-fast
pnpm run test:e2e:timeline-rows
pnpm run test:e2e:package-reopen
```

Package再openは実ファイルのドロップ、映像と補助Windowの終了、同じパスをOSから再openする流れを検証します。macOSではアプリを終了せずに起動画面へ戻り、履歴・drop・ファイル選択で繰り返し再openします。Timelineの端編集は未選択の状態で修飾キー付きのブラウザー入力を送信し、保存された開始・終了時刻と選択維持まで確認します。

`export-menu`は実MenuItemのcallbackを呼び、Timeline/Playlistの設定UIを操作して合成映像を書き出します。OSの保存先選択結果と案内ダイアログだけをstub化し、実IPC・FFmpegと出力の尺を確認します。OSメニューバー自体のクリック試験ではありません。複数Package Sessionの分離、不正sender、購読解除と再ロードは `clipExportMenuAction.test.ts` で確認します。

`export-fast`は合成素材による無再圧縮連結とフレーム保存、映像時計、途中区間・空白・準備進捗を確認します。Paint・静止挿入・2画面は既存の `paint-export` と `multi-clip-playback` を併用します。

自動event detectionのreal model inference E2Eは、verified model packをCI artifactとして安全に供給できるまで通常CIへ含めません。Modelなし状態は正常系であり、UIは「検証済みモデルなし」を表示します。

## Debugging Failed CI

推奨順:

1. Install / lockfile
2. Lint
3. Renderer typecheck
4. Electron typecheck
5. Architecture
6. ADR check
7. Unit tests

最初の失敗stepを修正し、後続stepのskipを別の失敗と誤認しないようにします。

## Regression Policy

- 新機能のために既存testを無効化しない
- flaky testを単純skipしない
- legacy behaviorを変える場合はmigration testを追加
- security boundaryを緩めてtestを通さない
- Recall優先のruntime minimumを機能を見せるために下げない
- model training/evaluation codeをpublic app repositoryへ再混在させない
- private source-identifying fixtureをpublic CIへ入れない
- license不適格modelを精度だけでproduction昇格させない

## UI一括ゲート

`pnpm run verify` で型検査、lint、architecture/design-system/ADR、unit tests、アプリとStorybookのbuildを実行する。Storybook buildの成功は操作試験・a11y試験の成功を意味しない。`Workspace/*` storiesで表示と操作を別途確認し、Electronの実ファイル・映像操作はアプリで試験する。

## 起動画面と仕様の同期

`Workspace/Start` では初回・履歴あり・検索一致なし・読込中・エラー・dropをdark/lightと600/800/1280pxで確認する。fixtureは検索・履歴削除を実際に操作できる状態を持たせる。

- View: 名前・チーム・保存場所での検索、履歴削除と開く操作の分離、読込中の無効化、エラー詳細と再試行。
- Hook: 同時ロードの抑止、ダイアログ取消、失敗後の再試行、nativeイベントの購読解除。
- Drop: preloadで取得した単一 `.stpkg` だけを開き、複数・不正・読込中のdropを抑止。
- 実機: OSダイアログ、Finder/Explorerのdrop、外付けドライブ、旧形式移行、Session復元。fixtureやunit testでは実ファイル操作を確認したことにしない。

仕様を変えたときは[起動](start-workspace.md)・[Playlist](playlist-features.md)・[Paint](tactics.md)の該当正本とアプリ内Helpを更新する。CHANGELOGへの追記だけでは仕様同期を完了しない。コードの型・IPC定義を文書へ丸写しせず、実装参照が存在すること、旧UI名と廃止経路の説明が残っていないこともレビューする。

Timelineの伸縮は連続mousemove中に保存せず、mouseupで1回確定し、1回のUndo/Redoで範囲全体を復元することを確認します。Esc・modifier release・blurでは元の範囲へ戻し、再生ヘッドを移動させません。Paintでは位置数値の空欄、Enter、Esc、未変更blurと、◆ドラッグのEsc取消を確認します。

Paint入力の回帰テストはpointerdown/upだけの短いドラッグ、停止後の微小な時刻更新、シーク取消、別pointerの混入を含みます。フレーム描画では`video.currentTime`と表示フレームの`mediaTime`が異なる状態を用い、React再描画後も表示フレームに位置が一致することを確認します。追尾では整数移動だけでなく0.3ピクセルずつの連続移動を使用します。

## Windowsの配布検証

[Windows CI](../.github/workflows/windows.yml)はWindows x64上でunitとElectron操作を検証する。`scripts/e2e-electron-launch.mjs` は `E2E_APP_PATH` を指定した場合にインストール済みアプリを起動する。NSISの導入・Explorer登録・アンインストール、同梱FFmpeg/llama.cppの依存DLL、予約文字と日本語を含む保存先を検査する。検証範囲とOS条件は[Windows版](windows.md)。

### 解析画面と追尾の回帰確認

`pnpm run test:e2e:event-detection`は独立ウィンドウの開閉・背景実行・再表示・Timelineへの保存までを通します。モデルは決定的なstubを使うため検出精度の証明にはなりません。`anchoredFeatureTracker.test.ts`は合成テクスチャの既知の足元移動を旧方式と比較し、平均誤差の削減・最大誤差・特徴消失時の停止を確認します。

### ローカルレビューの修正・配布

- `timelineRangeEditing.test.ts` / `useTimelineRangeEditing.test.tsx`: 分割の端点拒否、結合の同一行制約、メタデータ保持、1回のUndo/Redoを検証。
- `scripts/e2e-timeline-rows.mjs`: 独立Timelineの右クリック分割、ショートカット結合、保存された区間とUndoを合成映像で確認。
- `exportPreflight.test.ts`: 欠落ファイルの一括通知、選択アングルだけの検査、仮想Timelineの元映像検査、無効範囲・保存先を確認。
- `scripts/e2e-export-progress.mjs`: 後続クリップが欠落した場合、先頭の正常クリップも出力しないことと、同名再出力で既存動画の内容が変わらないことを実IPC / FFmpegで確認。

### 戦術盤

`node scripts/e2e-tactical-board.mjs` は実Electronで部分較正、HTTPを遮断した同梱モデル推論、配置・削除・Undo、PNG保存、Playlist再読込を確認します。PNGはファイルの存在だけで判定せず、末尾のIENDチャンクまで書き終わるのを待ち、FFmpegでデコードした画素を検証します。描画位置・重複抑制・不正データ拒否はunit testで既知座標から検証します。自動認識の人数精度はこの合成映像試験の評価対象に含めません。

`pnpm run test:e2e` はビルド後に `scripts/run-electron-e2e.mjs` で独立した14シナリオを順番に実行します。途中の失敗も収集して残りを検証し、1件でも失敗した場合は終了コード1を返します。各シナリオは専用の一時profileとpackageを破棄します。既に検証済みのapp/main/preloadを再利用する場合は `node scripts/run-electron-e2e.mjs` を使用できます。
