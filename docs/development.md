# 開発ガイド

ライブキャプチャの開発ではネットワーク有効の同梱FFmpegが必要です。`pnpm run media:build`後に`pnpm run e2e:prepare`、`node scripts/e2e-live-capture.mjs`で模擬カメラと合成IP映像を検証します。実カメラを自動テストで起動しません。[入力・保存契約](live-coding.md)。

ライブ回帰では録画ウィンドウの非表示中・Code Windowのフォーカス中にコードを開始/終了し、タグ保存と映像要素の継続を確認します。連続再生用の録画は`playbackFormat: fragmented-mp4`付きで、既存MP4との互換性は通常再生・書き出し・再オープンでも検証します。

パッケージ時計の進行を、遅れてcommitされた描画時刻で巻き戻さないでください。再生中の明示的な移動は既存の`video-seek-start`イベントの時刻を使い、一時停止中は表示時刻を反映します。遅延renderと明示seekの回帰は`usePackagePlaybackClock.test.tsx`にあります。

Playlistの参照・既定アングル変更時は`mediaReferences.test.ts`、`playlistMediaReconciliation.test.ts`、`playlistDefaultAngles.test.ts`と`node scripts/e2e-playlist-references-angles.mjs`を実行します。合成映像の2アングル×2ファイルを使い、既定値のUndo/Redo・保存再読込・境界での表示切替・移動したパッケージ・単一出力の実画素を確認します。Macでは実NSURL bookmarkで移動を確認し、WindowsのCIとインストール版も共通シナリオを使います。

書き出しノートの変更時は`clipExportTextLayout.test.ts`、`exportTextInspection.test.ts`、`exportFfmpegOverlay.test.ts`と`e2e-export-menu.mjs`で高さ上限・最低文字サイズ・実映像プレビュー・超過時の拒否を確認します。Playwrightの映像fixtureは720pとして日本語の描画を確認します。仕様は[Playlist](playlist-features.md#ノートの編集と映像出力)を参照してください。

ノートの変更では、旧文書の統合・空欄・再読込の冪等性と、Sorter入力中の削除・IME・確定・取消を確認します。pnpm run test:e2e:export-menu は、直接編集→保存・再読込→毎回のテキスト選択→実FFmpeg出力の日本語3行を確認します。StorybookのWorkspace/Playlist/NoteEditorとWorkspace/Export/TextConfirmationで狭幅・空欄・確認待ちを確認できます。

Sorter変更時は`playlistPresentationOrder.test.ts`でv1/v2移行と行をまたぐ順序、`usePlaylistSorter.test.tsx`で文書編集とUndo、`usePlaylistSelection.test.tsx`で検索中の範囲選択を確認します。`test:e2e:export-menu`内の`e2e-playlist-sorter.mjs`は実UIのソート・再生・Undo/Redo・保存再読込と、FFmpeg出力の色の順序を確認します。Playlist履歴は更新直後のUndo結果を同期的に返し、選択中のクリップをIDで維持します。

Timelineの修飾キーはドラッグ開始時に操作を選びます。キーを先に離しても取消にせず、最後の左mouseup座標で確定します。`TimelineLane.test.tsx`と`test:e2e:timeline-rows`でキー解除→マウス解除の順序、未選択での伸縮、選択と保存時刻を確認してください。

実装規約の正本はリポジトリルートの `AGENTS.md` です。本書はSporTagLyticsアプリ本体の開発環境、日常ワークフロー、品質ゲート、event detection runtime境界の実務ガイドです。

複数クリップの同期を変更する場合は、`shared/media/mediaTimeline` とMainの `mediaTimelineSource` を確認してください。保存時刻はアングル内の配置、画面・注釈・書き出し区間は共通時刻です。`pnpm run e2e:prepare && node scripts/e2e-multi-clip-playback.mjs` は4本の合成映像で、前半/後半の別々の同期、正負のアングル補正、Playlistの境界通過、Paintのシークと出力画素を確認します。Windows CIとインストール版試験にも同じシナリオを含めます。

アングル同期のView、連続時計、同期点、フレーム取得、保存の責務と検証入口は[アングル同期仕様](angle-synchronization.md#実装と検証)を参照してください。`useAngleSyncSession`を状態源とし、Timeline IPCで再生ヘッドと同期操作を接続します。同期中も通常のCoding行・時間目盛りの位置を保ち、`useAngleSyncHotkeys`はSettingsの割り当てを共通のキー照合関数で解決します。Windowsの元動画切替で読み込み完了後に時計が0へ戻るケースは`useAngleSyncPreviewClock.test.tsx`と実Electronの前後半同期で検証します。Timelineにフォーカスしたまま表示アングルを切り替えてシーク完了を待ち、映像Windowを前面へ戻して問題を隠さないようにします。既定キーだけでなく、変更済み・無効化済みの割り当てと修飾キーを単体テスト・Electron E2Eで確認します。Video.jsの公式CSSを維持し、実ウィンドウの1/2/4アングル比率と操作ボタンの可視性を確認します。

Codingへ時刻を渡す場合も、`VideoPlayerScreen`の共通時計を使ってください。`video_0.currentTime`は元動画内の時刻であり、2本目以降の配置やアングルの空白を表せません。`useCodingTime`はIPCハンドラーの参照を保ったまま最新時刻を読みます。複数クリップE2E内の`e2e-multi-clip-coding.mjs`が実際のコードウィンドウを操作し、保存されたタグ時刻とTimeline表示を確認します。

リンクの停止作用は`useActionButtonInteractions`でリンク元が未記録から記録中へ変わる時だけ評価します。リンク元の終了時には自身の記録だけを完了します。`useActionButtonInteractions.test.tsx`はB→A→B→Aの順で操作し、最後のBが停止しないことを確認します。

再生の修正は`useMediaTimeSync.test.tsx`（デコード中の要求集約・高速再生）、`usePlaybackBehaviour.test.tsx`（停止後の遅延canplay）、`useHeldPlayback.test.tsx`（停止状態の復元・修飾キー切替）を確認してください。`e2e-multi-clip-playback.mjs`内の`e2e-playback-interactions.mjs`が実Timelineの目盛り、行、ピンチ、右キーの解除と6倍速での元動画切替を検証します。重い映像のデコード性能自体は機種・コーデック・ストレージに依存するため、一律の速度倍率は保証しません。

Timelineのピンチは`useTimelineViewport.gesture.test.ts`で整数ピクセルに丸めるスクロールを再現し、連続拡大のアンカー維持、手動スクロール・ポインター移動・端到達後の再取得を確認します。E2Eの許容差を広げて丸め誤差を隠さないでください。

参照したHudl公式の[現行リリースノート](https://www.hudl.com/releases/sportscode)と[トラックパッド操作の説明](https://www.hudl.com/blog/new-trackpad-controls-added-to-sportscode-workflow)には、Timelineの倍率上限・ピンチ係数の具体値は見当たりませんでした。本アプリの1〜100倍・指数的なピンチ感度は独自の操作調整値です。2023年の記事は映像のズームについての説明であり、Timelineの数値仕様としては扱いません。

## 開発環境

| ツール  | バージョン |
| ------- | ---------- |
| Node.js | 22.12以上  |
| pnpm    | 9.1.0以上  |
| Git     | 最新版     |

通常のElectron開発・配布にPython runtimeは不要です。Event modelのtraining/evaluationは別private R&D repositoryで管理します。

```bash
git clone <repository-url>
cd sportaglytics
pnpm install --frozen-lockfile
pnpm run electron:dev
```

## 技術スタック

- React 19 / TypeScript / Material UI 7
- Electron 43 / Video.js 8 / Vite 7 / Vitest 4
- local-first desktop application
- RendererはNode/Electron APIを直接使用せずtyped preload APIを経由
- event detectionはstatus-aware model packをbounded child processとして実行

Training frameworkやdataset preparation dependencyはSporTagLytics packageへ含めません。

## Timelineの区間編集と書き出しを変更するとき

高速経路は `pnpm run test:e2e:export-fast` で確認します。合成した互換映像を実IPCで連結し、FFmpegの処理種別、全フレームのハッシュ、音声先頭補正による映像時計のずれ、尺、黒画面区間、後半の切り出し、準備中の進捗を確認します。速度計測は同一の合成素材で参考値を出し、機種依存の倍率を合否条件にはしません。離れた2場面の文字付き出力が中間区間を生成せず、エンコードが2回であることも確認します。要求区間と素材原点の変換・コピー条件は `exportTimelineRange.test.ts` / `exportSourcePreparation.test.ts` / `exportStreamCopy.test.ts` を入口とします。準備も `runFfmpegProcess` の進捗付き経路を通し、インスタンス間の未選択区間の生成を戻さないでください。性能比較の手順・素材・品質上の制約は[書き出し性能レポート](reports/2026-09-export-performance.md)を参照してください。

メニューの回帰確認は `pnpm run test:e2e:export-menu` を使います。実Electron MenuItemから、映像側の操作、Timelineの再作成・最小化復帰、Playlist固有の設定、保存先選択、FFmpegの実出力と尺まで確認します。直接export APIを呼ぶ試験だけでは、メニュー通知先やrenderer準備前の取りこぼしを検出できません。

区間編集は`timelineRangeEditing`のドメイン検証、`useTimelineRangeEditing`の履歴・選択検証、Timeline IPC guardを同時に確認します。複数の更新APIを続けて呼び、分割・結合が複数回のUndoになる実装は避けます。詳細な操作は[ユーザーガイド](user-guide.md#ビジュアルタイムライン)を参照してください。

書き出しでは実際に選択したソースだけを事前確認し、未使用アングルの欠落で出力を止めないことを確認します。`exportPreflight.test.ts`は合成前の欠落検出、`scripts/e2e-export-progress.mjs`は実IPCで後続クリップ欠落時の出力ゼロと同名再出力時の既存ファイル保持を確認します。サーバーや新しい依存の導入は不要です。

## ビルドと実行

```bash
pnpm run build
pnpm run build:electron-main
pnpm run bundle:preload
pnpm run check:preload
pnpm run electron:start
```

macOS package:

```bash
pnpm run electron:package:mac
```

`build:electron-main`はコンパイル後に`scripts/check-electron-runtime.mjs`を実行します。配布設定は`node_modules`を含めないため、Mainの実行時依存はNode組込・Electron・同梱の相対moduleに限定します。外部npm依存が出力JavaScriptへ残ると検査を失敗させます。Rendererとpreloadの依存は各bundleへ含めます。開発起動だけでなく、インストール版のE2Eも公開条件です。

配布版media toolchainは `scripts/build-media-tools.mjs` と ADR 0020 に従います。

### Event detection model packを含める場合

配布model packはGitへcommitせず、build前に次へstagingします。

```text
resources/event-detection-models/<model>/
```

`electron-builder`はこのdirectoryをpackaged appの`event-detection-models`へ`extraResources`として配置します。staging directoryが空でも通常buildは成立します。

stagingへ置くのはsanitized deployable model packだけです。raw video、`.stpkg`、frames、research runs、checkpoints、private source metadataは置きません。

## 開発ワークフロー

1. `develop` 最新からbranchを作る。
2. `<prefix>/<short-kebab-description>` を使う。
3. 実装と同じPRでtest/doc/ADRを更新する。
4. 全品質ゲートを実行する。
5. `develop` 宛てPRを作る。
6. CI結果を確認して失敗を修正する。

通常prefix: `feature`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`。
CommitはConventional Commitsを使います。

公開前に [Sharing and Issue Reports](privacy-and-data-handling.md#sharing-and-issue-reports) に沿って、差分・PR本文・添付物とコミットの著者情報を確認します。Gitの著者設定はリポジトリ単位で公開用の名前とGitHubのnoreplyメールにし、実データを使った調査結果は匿名化して記載します。`research/` と `output/playwright/` のローカル成果物は公開対象に含めません。

## 品質ゲート

PR merge前に必須:

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

Preload / packaged Electron変更時:

```bash
pnpm run build:electron-main
pnpm run bundle:preload
pnpm run check:preload
```

E2E:

```bash
pnpm run test:e2e
```

Paintの入力変更では、pointermoveが省略される短いドラッグ、停止直後の時刻更新、明示的なシークによる取消を確認します。追尾表示は再生時計ではなく表示フレームの`mediaTime`で描画し、低速の端数移動を連続させても量子化誤差が蓄積しないことを検証します。`e2e-paint.mjs`は描画の再試行をせず、連続操作ごとの図形数と保存内容を確認します。

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestでfrozen install、lint、renderer/electron typecheck、architecture、ADR、Vitestを実行します。

## アーキテクチャ

詳細は [System Overview](system-overview.md) と [Project Structure](project-structure.md) を参照してください。

依存方向:

```text
pages -> features -> shared
```

Renderer / Electron boundary:

```text
View
  ↑ props/callback
Controller / Hook
  ↓
Gateway
  ↓
window.electronAPI
  ↓
typed preload / IPC
  ↓
Electron main manager / child process
```

`src` から `electron` / `ipcRenderer` を直接importしません。

## 自動イベント検出の開発

しきい値変更で同じ映像を再解析しないよう、Mainで検証済み結果をキャッシュします。`resultCache` のテストではrequest ID更新、候補のコピー、期限・容量制限、映像・model pack・時刻・イベント変更の無効化を確認します。実モデルE2Eでは同じ入力を再実行し、最新しきい値と既存Timelineの重複除去が適用されることを確認します。

Codingの網羅範囲を断定できない比較用packはschema 2 / `experimental` / `evaluationBasis: reference-coding`として扱います。model discoveryとIPCはこの組み合わせを検証し、旧schema 1はロード時に `reported-metrics`へ変換します。新packは対応するこのブランチのアプリで検証してください。旧版アプリはschema 2を拒否します。Storybookの `Features/VideoPlayer/EventDetection/ModelEvaluation` とmodel discovery / IPC / Dialog Viewテストで、比較値を精度と誤表示しないことを確認します。

時間文脈による補正packでは、学習時とランナーでclip端の扱いを一致させ、保護対象クラスのスコアが基準packと完全に同じことを確認します。公開画像を比較する場合は、画像なし候補から学習行と中心特徴の両方を除外します。比較対象・教師データのhash・採用しなかった候補もR&Dに記録し、確認済みValidationの見逃し・重複を採用条件に含めます。実アプリでは新しいpackの発見、実映像の解析、Timeline保存、再実行キャッシュを確認します。学習・比較手順の正本はprivate R&Dの`docs/targeted-temporal.md`、製品契約は[前後の映像と公開画像を使う補正](event-detection.md#前後の映像と公開画像を使う補正)を参照してください。

- 詳細仕様: [自動イベント検出](event-detection.md)
- R&D境界: [ADR 0023](adr/0023-external-rugby-event-model-rd-boundary.md)
- experimental production lane: [ADR 0024](adr/0024-experimental-event-detection-production-lane.md)

### Product policy

自動イベント検出は通常Timelineを初期Codingする補助機能です。model statusは`verified | experimental`を明示的に区別します。

`verified`は既存runtime quality gateを満たしたclassだけを公開します。`experimental`は評価中の別レーンであり、verified gate通過扱いにしません。experimentalをproduction UIへ表示する場合は、試験badge、警告、class別Recall / Precision / evaluated matches / baseline confidence thresholdを必ず見せます。

実作業では、少数の高Precision候補だけを出すより、**ほぼ全イベントを候補として出して不要なものを削除する**workflowを優先します。そのためruntime minimumはRecall優先で、model採用時にはprivate R&D側でfalse positives per match、処理時間、manual edit operations、手Coding比の作業時間削減まで確認します。

モデル一覧の取得Effectは、解析画面を最初に開いた時のコンテキストだけに依存させます。頻繁に更新される映像・コードウィンドウの参照を取得条件に含めると、操作中のフォームが消えて入力値も初期化されます。アングル選択の整合性確認は一覧取得から分離し、Controllerの回帰テストで入力維持と閉じた画面への遅延応答の無視を確認します。

### Model packとアプリ本体を分離する

映像参照の不具合はモデル更新と分けて検証します。`pnpm run test:e2e:event-detection`は、拡張子なしの入力名で複数クリップのパッケージを新規作成し、直後の検出要求・Timeline保存・履歴からの復帰を確認します。公開CIでは入力ファイルを検査する決定的なモデルstubを使い、モデル重みや実試合映像を取得しません。実モデルの動作確認を行う場合は、検証した映像区間と推論の完了を記録し、精度評価とは区別してください。

```text
Renderer
  ↓ window.electronAPI.eventDetection
Preload
  ↓ typed IPC
Electron main
  ↓ status-aware runnable model
Model-pack runner
  ↓
ML runtime / model files
```

Runner内部はONNX Runtime等へ交換できますがrenderer contractは変えません。

探索先:

```text
resources/event-detection-models/<model>/
<Resources>/event-detection-models/<model>/
<Electron userData>/event-detection-models/<model>/
```

Model manifestにはschema/version/id、`status: verified | experimental`、supported events、class別metrics、評価時confidence threshold、platform runner relative path、runner SHA-256を含めます。

共通検証はmanifest構造、metric range、current platform runner、path containment、runner SHA-256です。`verified`はさらにminimum runtime gateを再検証します。`experimental`はquality gateを緩めるのではなく、共通検証を通った別statusとしてUIへ伝播します。

### Product runtime gate

Verified event class単位:

| Metric                    |      Minimum |
| ------------------------- | -----------: |
| Recall                    |         0.95 |
| unseen evaluation matches |            5 |
| Precision                 | 0〜1の有限値 |
| confidence threshold      | 0〜1の有限値 |

Precision単独でmodelを昇格させません。秒単位の厳密なevent onsetも主目的ではありません。

Experimental modelでは宣言eventごとにmetricsが必要ですが、evaluated match数が5未満でも`experimental`のまま実行できます。これはproduct workflow評価のためであり、`verified`へのpromotion条件には影響しません。

### Confidence threshold

UIはmanifestの`confidenceThreshold`を初期値として表示し、runごとに0.00〜1.00で調整できます。

- 低くする: Recallを取りやすい一方、false positiveが増えやすい
- 高くする: false positiveを減らしやすい一方、見逃しが増えやすい

入力値はdomain層で有限値・範囲を正規化します。ユーザー変更はmanifestや保存済み評価metricsを書き換えません。

`candidatesToTimeline`では同一runの重複についてconfidenceが高い候補を優先し、返却時だけ時刻順に並べます。配列の順序を逆転したケースと、手動編集した既存イベントを高confidence候補でも置き換えないケースを回帰テストに含めます。

model packの精度検証ではcheckpointとthresholdに加え、評価時の前処理・走査間隔・重複抑制も一致させます。Validationだけで改善したモデルを`verified`と表示しません。モデル選択・再評価はprivate R&D側で実施し、元映像や評価用データを本体のテストfixtureへコピーしないでください。

補正重みを学習する場合はprivate R&Dの `docs/reviewed-kernel.md` を参照します。過去の学習データ・追加カメラ・以前のレビューの継承と特徴cacheの出典を検証し、同数の検出でも別のCodingを失った候補は採用しません。新checkpointのhashと学習結果を記録し、未使用Testによる資格評価とは区別します。実packでは報告された見逃し区間も別の試験パッケージへコピーして検証します。

区間判定を含むpackでは `scanConfig.episodeDecoder` も評価・export・runtimeで一致させます。private R&Dの `docs/episode-calibration.md` が教師データ・特徴cache・調整手順の正本です。ニューラル重みが同じ場合もpack versionを更新し、旧packをrollback用に保存します。実packの検証では同一プレーの統合、別プレーとclip境界の分離、検出区間＋lead/lagのTimeline保存、再実行cacheを確認します。既存パッケージを直接書き換えず、別の検証パッケージを使用してください。

R&Dの`refine_head`は、既存Codingの区間内を優先する正例抽出と、同期したTrainの追加カメラを比較します。凍結したX3Dの特徴を再利用し、寄り映像だけの候補・引き映像を加えた候補・重複抑制だけの比較対象を記録します。既存の網羅性メタデータがないだけで再Codingを要求せず、完成版の出典と確認根拠を残してください。比較手順の正本はprivate R&D側の`docs/head-refinement.md`です。比較用checkpointを作っただけでは、本体の同梱model packは更新されません。

### Private R&D boundary

次はSporTagLytics repositoryの責務ではありません。

- dataset discovery / preparation
- training / fine-tuning
- hard-negative mining
- model family比較
- threshold / NMS / stride探索
- held-out qualification
- private source diagnostics
- model export

元動画、`.stpkg`、Timeline Coding、frames、checkpoints、runs、deployable model binaryをpublic repositoryへcommitしません。一般ユーザーPCごとの自動fine-tuningも初期製品では行いません。

### Runner protocol

Electronから:

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

Main process側はstatusに関係なく `shell: false`、finite timeout、output/stderr cap、cancel、request/result cleanup、path traversal、runner SHA-256、result payload validationを担当します。

### Timeline integration

Model outputは直接persisted `timeline.json` を書き換えません。Renderer domainで現在のconfidence threshold、enabled event、lead/lag、duplicate suppressionを適用して `NewTimelineData[]` へ変換し、`addTimelineDatas()` で1 state updateとして追加します。

自動追加後は通常の `TimelineData` として扱います。experimental provenanceをTimeline schemaへ保存しません。

## テストとデバッグ

再生プレイヤーの生成・破棄は映像sourceと設定の変更に従います。複数クリップの経過時間通知でcallbackの参照が変わっても、読み込み中のplayerを再生成しません。通知先は最新callbackへ更新し、source変更・unmountでは従来どおり破棄します。`useVideoJsInitialization`の回帰テストと実映像での読み込み完了を確認してください。

```bash
pnpm run test:run
```

Event detection関連では次をtestします。

- recording range
- confidence filter / duplicate suppression
- confidence threshold編集とclamp
- verified Recall-first quality gateが変わっていないこと
- experimental manifest eligibility
- unknown status / malformed metric rejection
- current-platform runner / path traversal / runner SHA-256
- renderer model metadata guard
- experimental warning / metrics表示
- IPC/process boundary

Model packがUIへ出ない場合:

1. manifest JSON
2. `status: verified | experimental`
3. class metricsの有限値・範囲
4. verifiedの場合はclass recall / evaluated match count
5. confidence threshold
6. current platform/architecture runner
7. runner SHA-256
8. runner path traversal

を確認します。

Model training/evaluationのdebuggingはprivate R&D repositoryで行います。

## Playlistを開くメニューを変更するとき

メニュー通知の生存確認は`menuCommandDelivery.test.ts`で、Windowより先に閉じたWebContents、getter/送信時の破棄、残りのWindowへの通知継続を検査します。`e2e-code-window-menu.mjs`はライブキャプチャ画面を閉じた直後の「新規パッケージ」操作をmacOS/Windowsで確認します。

Playlistを開くメニューを変更する際は`node scripts/e2e-playlist-open-menu.mjs`を使います。実メニューのcallbackから`.stpl`のロード・再生、選択取消、不正パッケージ、未保存文書の保持、既存Windowの再利用を確認します。このシナリオは通常のE2EとWindowsインストール後のE2Eにも含めます。

## リリースプロセス

1. release準備変更を `develop` へ統合
2. 必要なsanitized event-detection model packをCI/local stagingへ配置
3. `develop -> main` PR
4. main PR品質ゲート
5. merge後のmain commitへrelease tag
6. package/release assets作成。同じバージョンの公開済みタグ・DMGを上書きしません（[ADR 0032](adr/0032-immutable-release-artifacts.md)）。

Electron E2Eは `scripts/run-electron-e2e.mjs` で全シナリオの成否を収集し、1件でも失敗すると配布へ進みません。詳細は[テスト手順](testing.md)を参照してください。

配布前に `pnpm audit` / `pnpm audit --prod` も確認します。lockfileを固定してインストールし、UIのゲートとStorybook buildをReleaseでも実行します。

macOS署名はキーチェーン修正版のelectron-builder 26.16.1で行います。builder関連パッケージとlockfileを揃えて更新し、署名・公証の障害は[Release手順](../.github/RELEASE.md#macos-signing-keychain-unlock-failed)に沿って切り分けます。

`main` への直接push/mergeは行いません。Event detection model packはアプリreleaseと独立できます。

## ドキュメント運用

変更時は [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix) に従います。

- user behavior → `user-guide.md`, `requirement.md`
- IPC/architecture → `system-overview.md`
- directory配置 → `project-structure.md`
- build/script → `development.md`, `testing.md`
- 長期判断 → `docs/adr/`
- user/contributor visible → `CHANGELOG.md`

## UIの変更と確認

UI変更後は `pnpm run verify` でRenderer/Electron型検査、lint、architecture/design-system/ADR検査、テスト、アプリbuild、Storybook buildを実行します。品質ゲートの正本は[testing.md](testing.md)です。

| 対象     | Storybook / 確認事項                                                                                                                                                                                                     | 機能の正本                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| 起動画面 | `Workspace/Start`: 初回、履歴検索、空/該当なし、長い保存先、ロード中、エラー再試行、drop                                                                                                                                 | [起動画面](start-workspace.md)                   |
| 再生操作 | `Design System/Composites/Movie Transport`、`Workspace/Transport`: 半透明、送り量のラベル、描画目印                                                                                                                      | [デザインシステム](design-system.md)             |
| Timeline | `Workspace/Timeline/Continuous`、Context Menu / Row Actions: ズーム・スクロール後のruler/行/再生線一致、最上段だけの通常シークと端編集時の映像プレビュー、未選択の端編集・空白クリック・範囲選択、右クリックとキーボード | [ユーザーガイド](user-guide.md#タイムライン編集) |
| Paint    | `Workspace/Playlist/Paint`: Interactive、Empty、Player Graphics、Video Tracking、Keyframe Editing、Inspector Layout、Collapsed Inspector                                                                                 | [Paint](tactics.md)                              |

共通してdark/light、600/800/1280px、長い名称、キーボード、空状態・失敗状態を確認します。Paintでは点/描画の削除とUndo、入力欄のBackspace、リンクの連続クリック、追尾の範囲指定→適用→手修正→再追尾、パネル開閉時の状態保持を確認します。時間目盛りの入力は `useStudioRulerInput` でRAFにまとめるため、連続入力と動画側の追従も確認します。

実機のファイルダイアログ・Finder/Explorerドロップ・保存再読込・Package Session・FFmpeg出力はStorybookと別に確認します。追尾の合成WebMや公開人物映像での結果と、利用者の試合映像での精度は区別して報告します。

Mainのパッケージ通知を変更する場合は`packageOpenDelivery.test.ts`と`test:e2e:package-reopen`で、`did-finish-load`が発生しても`isLoading()`がtrueの間にOSから開く競合を確認します。タイムアウトの延長で回避せず、`did-stop-loading`後の配送を検証します。

同じパッケージの閉じる→再openは `pnpm run test:e2e:package-reopen` で確認します。履歴の登録は画面unmount後の完了も検証対象です。テストの概要とプラットフォームごとの範囲は[起動画面の検証](start-workspace.md#検証)を参照してください。

`did-finish-load`はReactの購読完了を保証しません。起動通知は `packageOpenBridge` で保持し、React側では既存の `onPackageDirectoryOpen` を購読・解除します。単体テストでStrictModeと購読者交代を確認し、`test:e2e:clip-sync`で本物のsandbox preloadへ購読前に通知を送って配送と再購読時の非再生を検証します。ウィンドウ取得は生成順に頼らず、file URLとrouteで対象を特定します。

`pnpm run test:e2e:timeline-rows`は、単体／複数インスタンスの削除・Undo、行内選択、行削除の確認、範囲選択後の対象切替、Enter／ダブルクリック編集、入力欄のBackspaceを実機で確認します。

`pnpm run test:e2e:paint-export`は、合成映像と実Canvas描画を使ってRendererの書き出し組立・共通サービス・実IPC・FFmpegまで検証します。出力映像の画素、寸法、尺、音声から、クリップ途中の追尾、芝色による前景復元、静止挿入、別アングル、異なる解像度の2画面を確認します。アーティファクトを残す場合は`E2E_SCREENSHOT_DIR=output/playwright/paint-export`を指定します。これらは実試合の追尾精度やWindows実機検証の代替ではありません。

### Sportscodeのインスタンス操作を参照する場合

2026-09-21確認: Hudl Japanの[インスタンス追加解説](https://note.hudl.jp/n/nd471a88abdf5)ではOption+Commandで赤い再生ヘッドからドラッグして作成し、[12.2.37の更新情報](https://note.hudl.jp/n/n9e0e496cf384)では同じキーで既存端を伸縮します。同じ修飾キーでもドラッグ開始場所が操作を決めます。記事の対象版と現行版は区別します。

Sorterは[Hudlの2024年の公式説明](https://www.hudl.com/blog/databases-in-hudl-sportscode-are-now-more-flexible-efficient)でクリップの並べ替えを別ビューにも反映する機能として扱われています。この方針とユーザー要求に合わせ、ソートを文書の再生順へ反映します。列操作の細部まで現行Sportscodeと同一と実機確認したものではありません。

[現行の公式機能比較](https://www.hudl.com/products/sportscode/tiers)には、Timelineからのトリム・延長・結合、複数インスタンスの長さ調整と左右移動、複製、playheadへの整列が記載されています。[公式更新履歴](https://www.hudl.com/releases/sportscode)の12.2.30では、Command+Control+Zで全インスタンス、Command+Control+Xでplayheadより右側をドラッグ移動し、Align All / Align RightはOption+Z / Option+Xとしています。これは公開更新履歴に記載された割り当てであり、旧Sportscode 11のPDFを最新操作の根拠にはしません。

本アプリの実装済み操作は[タイムライン編集](user-guide.md#タイムライン編集)が正本です。端の直接調整、Option/Altでの行間コピー、Cmd/Ctrl+C/V、削除、Undo/Redo、同じ行の前後へのジャンプは利用できます。上記の全体移動・右側一括移動・playhead整列の専用修飾キー操作とインスタンス結合は未実装です。採用する場合は、対象範囲、時間の上下限、複数件を1回で戻す履歴、既存Undo/Redoとのキー競合をまとめて扱います。

ヘルプ本文のUIは `electron/src/helpDocument.ts`、ウィンドウ生成は `helpWindow.ts` に分離します。操作を変更したら該当する機能仕様とアプリ内ヘルプを同期し、変更履歴は正本への入口として要約します。

## Windows開発

書き出し進捗の初期サイズは内容領域基準とし、完了時の「閉じる」がviewport内に収まることをE2Eで検証します。

[Windows版の開発・検証](windows.md#開発検証)を参照。`scripts/media-tools/` はプラットフォームごとの静的メディアビルド、`scripts/build-windows-llama.mjs` はWindows AI実行ファイル、`scripts/prepare-mac-llama.mjs` は公式アーカイブの検証とMac CPU別のAI実行ファイル準備、`scripts/prepare-fonts.mjs` は検証済み日本語フォントを用意する。`pnpm run electron:start` はOSに依存しないNodeラッパーから起動する。

### ウィンドウ連携と追尾の変更時

`e2e-event-detection.mjs`は合成パッケージを使い、正式ロゴ、解析画面の独立、閉じて再表示した実行状態、狭幅での操作、映像ウィンドウのサイズ維持、ウィンドウ群の前面表示ハンドラーを確認します。前面表示はElectronのfocusイベントを注入して実native APIの呼出順とfocus維持を検査するもので、OSの実際の重なり順・仮想デスクトップを自動保証する試験ではありません。`eventDetectionWindow.test.ts`はSession境界、Controllerのテストは背景実行中のTimeline編集と所有元終了を検証します。

追尾は`anchoredFeatureTracker.test.ts`で既知の端数移動・拡大と足元座標を使い、従来の平行移動積算と比較します。合成映像の誤差を実試合の精度として扱いません。

WindowsのFFmpegはzlibを静的リンクしてPNGのエンコード/デコードを有効にします。media-toolsビルドはPNG生成と読込の往復検証を通してから成功manifestを書きます。依存ソースのchecksumとライセンスを同梱し、DLL検査とPaint出力E2Eも維持します。

### 戦術盤の端末内認識

`pnpm run vision:prepare` はMediaPipe Tasks Vision 0.10.21（外部統計送信なし）の固定npm版と、SHA-256で検証するEfficientDet-Lite2 INT8 revision 1を `public/pitch-vision/` に準備します。start/build/Storybookコマンドに組み込み済みです。初回の開発・ビルドではモデル取得にネットワークが必要で、ハッシュ一致の資産があれば再取得しません。実行時には同梱資産のみを使います。SDKのfile URLフォールバックを避け、同梱WASMをBlob URL、モデルをバッファとして渡します。ElectronのwebSecurityは緩和しません。モデル・WASMはGitに含めず、配布ビルドとライセンスを同梱します。モデルの出典とハッシュは `resources/pitch-vision/NOTICE.md` が正本です。

較正・戦術盤のStorybookは `Playlist/Paint/Pitch Calibration` と `Playlist/Paint/Tactical Board`。E2Eは `pnpm run e2e:prepare` 後に `node scripts/e2e-tactical-board.mjs` を実行します。合成映像でHTTP通信を拒否し、実モデルのロード・推論、部分較正、削除/Undo、PNG、保存/再読込を確認します。人物検出の実試合精度を保証する試験ではありません。
