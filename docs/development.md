Timelineの下部検索ドック・共通compactフォームの変更と検証限界は[compact density評価](reports/2026-10-compact-density.md)を参照してください。

# 開発ガイド

長尺再生の回帰は`usePackagePlaybackClock.test.tsx`と`packagePlaybackReadiness.test.ts`でデコード待ち・復帰・明示シーク・アングル補正・空白・終了境界を検査します。実Electronでは`e2e-playback-buffering.mjs`で通常ファイルの片方のデコード待ち中に全アングルが待機し、表示切替・速度変更・同期ずれ・ファイル欠損・背景復帰・明示停止に従うことを検査します。`e2e-capture-gaps.mjs`では実MSEで録画の空白通過、短い音声末尾、僅かな再生ずれ、空白への明示シークとパッケージ終端を検査します。`e2e-multi-clip-playback.mjs`と`e2e-live-capture.mjs`で境界や録画への影響も確認します。ローカル実映像の性能測定は許可されたコピーと独立profileを使い、実データ・名前・画像を公開fixtureへ含めないでください。

終了時保存を変更する場合は[ADR 0068](adr/0068-timeline-close-save-handshake.md)に従い、hookの同一tick編集・行補完、typed preloadの送信元、Mainの全owner準備とatomic write待機を検証します。`pnpm run e2e:prepare && node scripts/e2e-timeline-close.mjs`は合成データで実保存・別process再開を確認します。ライブ停止後に終了が取り消された場合も、次の録画の終了待ちを省略しないでください。

Tabアクション巡回を変更するときは、[Timeline review](timeline-review.md)の適用範囲と[ADR 0064](adr/0064-scoped-tab-action-navigation.md)を確認します。選択・DOMフォーカス・実映像シークを隔離したElectron試験で同時に検証し、通常アプリや実試合データを使わないでください。

Playlistの配送・ロードを変更するときは`usePlaylistLoadDelivery.test.tsx`、Mainの`windowManager.test.ts`と`e2e-ux-review`内の保存済み文書ロード/reloadを確認します。Rendererごとのqueueがsnapshotと追加の順序を保ち、新しい編集・文書世代を古いdisk結果が上書きしないことが受入条件です。[判断](adr/0059-playlist-renderer-delivery-readiness.md)。

文書採用の境界はMainとRendererの両方を検証します。`playlistWindow/documentIdentity.test.tsx`と`e2e-playlist-document-identity.mjs`で、A/Bロードの逆順完了、別文書ロード中の編集による拒否、同文書ロード中の編集後Closeを扱います。Rendererの見た目に加え、MainのfilePath/dirty・実Save先のbytes・未保存promptを確認します。read完了だけでMain状態を変更せず、最新ticketへの採用応答で保存先を確定してください。

Electronは同じ43 majorの[43.8.1](https://github.com/electron/electron/releases/tag/v43.8.1)へ固定します。[GHSA-jr5w-w6x2-84p9](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9)を含む依存監査の修正版です。lockfile固定でinstallし、packaged appの実runtime versionを確認してください。runtime更新後はsandbox preload・YouTube埋込の起動と分析PNGのcold初回DPR1/2をMacで再確認し、旧runtimeの合格を流用しません。署名・公証は別の配布条件です。

2026-10-26の依存監査対応はVite7.3.7、Storybook10.6.2、Vitest4.1.12、fast-uri3.1.9、undici6.29.1/7.30.1です。undiciはupstream major別のoverrideとし、Electron/getの7系を6系へ変更しません。Storybookのpeerとws8.21.1を揃えます。Zodは最低修正版4.6.6を満たす[4.6.7](https://github.com/colinhacks/zod/releases/tag/v4.6.7)へlockfileで固定し、AI応答の既存schema・unknown-key除去・validation error・非有限数とfallbackを回帰確認します。監査ignore・重大度基準・TLS設定は変更しません。Joi18.2.9 overrideはwait-on9.1.0の開発依存への対応で、配布runtime更新とは分けて扱います。

開発・ビルド依存の2026-10-10監査対応は[ADR 0058の追補](adr/0058-build-downloads-without-response-cache.md#2026-10-10-proxy-dependency-audit-update)を参照してください。Electron/get/Gotを維持し、scoped global-agent更新とproxy/NO_PROXY回帰を追加します。

Timeline reviewを変更する場合は`Workspace/Timeline/Review` storiesと`node scripts/e2e-ux-review.mjs`を確認してください。E2Eは一時profileと合成240件・24行を使い、検索→映像→編集→Playlist→分析→再開を検証します。OSファイルダイアログの取消結果はadapterを置換し、Finder自体の操作は検証しません。スクリーンショットは`E2E_SCREENSHOT_DIR=output/playwright/ux-review`で保存できます。[評価範囲と手順](reports/2026-10-ux-review.md)。

パッケージ互換を変更するときは、[互換・原本保護の仕様](package-compatibility.md)に従って既知構造と未知versionを分け、検証済みstagingから同じパスへ更新し、更新前の原本をjournal付きバックアップへ残す既存契約を維持してください。Mainのvalidation/staging/backup/復元とRendererのload-gated persistenceを別々に検証します。Sportscode XMLのDomain・Hook・View・Gatewayを分離し、通常TimelineへのJSON置換と混ぜません。`e2e-package-safety.mjs` / `e2e-sportscode-import.mjs`は合成データと独立profileだけを使います。重いbuild/Electron/full suiteは同じ端末で並列に起動しないでください。

ライブキャプチャの開発ではネットワーク有効の同梱FFmpegが必要です。`pnpm run media:build`後に`pnpm run e2e:prepare`、`node scripts/e2e-live-capture.mjs`で模擬カメラと合成IP映像を検証します。実カメラを自動テストで起動しません。[入力・保存契約](live-coding.md)。

ライブ回帰では録画ウィンドウの非表示中・Code Windowのフォーカス中にコードを開始/終了し、タグ保存と映像要素の継続を確認します。連続再生用の録画は`playbackFormat: fragmented-mp4`付きで、既存MP4との互換性は通常再生・書き出し・再オープンでも検証します。

パッケージ時計の進行を、遅れてcommitされた描画時刻で巻き戻さないでください。再生中の明示的な移動は既存の`video-seek-start`イベントの時刻を使い、一時停止中は表示時刻を反映します。遅延renderと明示seekの回帰は`usePackagePlaybackClock.test.tsx`にあります。停止中のシークが一度到達した後、ソースの読み込み復元で0秒へ戻る場合は同じ目標へ再補正します。未到達のクランプ要求を繰り返さない検査と、到達後のリセットを復元する検査を`useMediaTimeSync.test.tsx`で維持してください。

Playlistの参照・既定アングル変更時は`mediaReferences.test.ts`、`playlistMediaReconciliation.test.ts`、`playlistDefaultAngles.test.ts`と`node scripts/e2e-playlist-references-angles.mjs`を実行します。合成映像の2アングル×2ファイルを使い、既定値のUndo/Redo・保存再読込・境界での表示切替・移動したパッケージ・単一出力の実画素を確認します。Macでは実NSURL bookmarkで移動を確認し、WindowsのCIとインストール版も共通シナリオを使います。

書き出しノートの変更時は`clipExportTextLayout.test.ts`、`exportTextInspection.test.ts`、`exportFfmpegOverlay.test.ts`と`e2e-export-menu.mjs`で高さ上限・最低文字サイズ・実映像プレビュー・超過時の拒否を確認します。Playwrightの映像fixtureは720pとして日本語の描画を確認します。仕様は[Playlist](playlist-features.md#ノートの編集と映像出力)を参照してください。

ノートの変更では、旧文書の統合・空欄・再読込の冪等性と、Sorter入力中の削除・IME・確定・取消を確認します。pnpm run test:e2e:export-menu は、直接編集→保存・再読込→毎回のテキスト選択→実FFmpeg出力の日本語3行を確認します。StorybookのWorkspace/Playlist/NoteEditorとWorkspace/Export/TextConfirmationで狭幅・空欄・確認待ちを確認できます。

Sorter変更時は`playlistPresentationOrder.test.ts`でv1/v2移行と行をまたぐ順序、`usePlaylistSorter.test.tsx`で文書編集とUndo、`usePlaylistSelection.test.tsx`で検索中の範囲選択を確認します。`test:e2e:export-menu`内の`e2e-playlist-sorter.mjs`は実UIのソート・再生・Undo/Redo・保存再読込と、FFmpeg出力の色の順序を確認します。Playlist履歴は更新直後のUndo結果を同期的に返し、選択中のクリップをIDで維持します。

Timelineの修飾キーはドラッグ開始時に操作を選びます。キーを先に離しても取消にせず、最後の左mouseup座標で確定します。`TimelineLane.test.tsx`と`test:e2e:timeline-rows`でキー解除→マウス解除の順序、未選択での伸縮、選択と保存時刻を確認してください。

実装規約の正本はリポジトリルートの `AGENTS.md` です。本書はSporTagLyticsアプリ本体の開発環境、日常ワークフロー、品質ゲート、event detection runtime境界の実務ガイドです。

複数クリップの同期を変更する場合は、`shared/media/mediaTimeline` とMainの `mediaTimelineSource` を確認してください。保存時刻はアングル内の配置、画面・注釈・書き出し区間は共通時刻です。`pnpm run e2e:prepare && node scripts/e2e-multi-clip-playback.mjs` は4本の合成映像で、前半/後半の別々の同期、正負のアングル補正、Playlistの境界通過、Paintのシークと出力画素を確認します。Windows CIとインストール版試験にも同じシナリオを含めます。`useMediaTimeSync.test.tsx`では非ゼロ開始PTSへの補正後に停止中の再シークが繰り返されないことを確認し、`e2e-angle-sync-multi.mjs`では3/4本の実映像が起動時にデコードを終えることを検証します。

アングル同期のView、連続時計、同期点、フレーム取得、保存の責務と検証入口は[アングル同期仕様](angle-synchronization.md#実装と検証)を参照してください。`useAngleSyncSession`を状態源とし、Timeline IPCで再生ヘッドと同期操作を接続します。同期中も通常のCoding行・時間目盛りの位置を保ち、`useAngleSyncHotkeys`はSettingsの割り当てを共通のキー照合関数で解決します。Windowsの元動画切替で読み込み完了後に時計が0へ戻るケースは`useAngleSyncPreviewClock.test.tsx`と実Electronの前後半同期で検証します。Timelineにフォーカスしたまま表示アングルを切り替えてシーク完了を待ち、映像Windowを前面へ戻して問題を隠さないようにします。既定キーだけでなく、変更済み・無効化済みの割り当てと修飾キーを単体テスト・Electron E2Eで確認します。Video.jsの公式CSSを維持し、実ウィンドウの1/2/4アングル比率と操作ボタンの可視性を確認します。アングル同期プレビューでもデコード中のseekを中断せず、未到達の同じ停止要求を繰り返さない。新しい時刻・元動画・再生から停止への変更は適用し、到達済みの位置が読み込みで戻された場合は再補正する。非ゼロ先頭PTSと遅延通知はHook試験と3/4アングルE2Eで確認する。

Codingへ時刻を渡す場合も、`VideoPlayerScreen`の共通時計を使ってください。`video_0.currentTime`は元動画内の時刻であり、2本目以降の配置やアングルの空白を表せません。`useCodingTime`はIPCハンドラーの参照を保ったまま最新時刻を読みます。複数クリップE2E内の`e2e-multi-clip-coding.mjs`が実際のコードウィンドウを操作し、保存されたタグ時刻とTimeline表示を確認します。

リンクの停止作用は`useActionButtonInteractions`でリンク元が未記録から記録中へ変わる時だけ評価します。リンク元の終了時には自身の記録だけを完了します。`useActionButtonInteractions.test.tsx`はB→A→B→Aの順で操作し、最後のBが停止しないことを確認します。

再生の修正は`useMediaTimeSync.test.tsx`（デコード中の要求集約・高速再生）、`usePlaybackBehaviour.test.tsx`（停止後の遅延canplay）、`useHeldPlayback.test.tsx`（停止状態の復元・修飾キー切替）を確認してください。`e2e-multi-clip-playback.mjs`内の`e2e-playback-interactions.mjs`が実Timelineの目盛り、行、ピンチ、右キーの解除と6倍速での元動画切替を検証します。重い映像のデコード性能自体は機種・コーデック・ストレージに依存するため、一律の速度倍率は保証しません。

Timelineのピンチは`useTimelineViewport.gesture.test.ts`で整数ピクセルに丸めるスクロールを再現し、連続拡大のアンカー維持、手動スクロール・ポインター移動・端到達後の再取得を確認します。E2Eの許容差を広げて丸め誤差を隠さないでください。

参照したHudl公式の[現行リリースノート](https://www.hudl.com/releases/sportscode)と[トラックパッド操作の説明](https://www.hudl.com/blog/new-trackpad-controls-added-to-sportscode-workflow)には、Timelineの倍率上限・ピンチ係数の具体値は見当たりませんでした。本アプリの1〜100倍・指数的なピンチ感度は独自の操作調整値です。2023年の記事は映像のズームについての説明であり、Timelineの数値仕様としては扱いません。

開始UIの表示確認はStorybookの`Workspace/Start`（5入口・履歴・busy・エラー・drop）と`Workspace/CreatePackage`（基本情報・入力エラー・映像・作成中）を使います。新規作成storyのファイル選択・保存はcallback fixtureであり、native I/Oの検証ではありません。Macでは同一候補に合成パッケージを使い、1440×775と800×420、dark/lightで切れ・折返し・Tab移動・取消/復旧を確認します。ブラウザ描画不能な環境の型チェックやStorybook buildを視覚QAの合格とは扱いません。

小窓の開始状態は履歴下端からbusy→失敗→再試行と、失敗を閉じる・選択取消後のOpenへのfocus復帰を確認します。`VideoPathSelectorStatus.test.tsx`はDOM順序・focus・scroll要求を検証しますが、実際の座標や文字切れは検証しません。`Workspace/CreatePackage/EightAngles`では800×420でアングル名・本数・メイン表示、一覧内の最終行選択、本文scroll後のclip操作と固定footerを確認します。

分析表示は`Workspace/Analysis/Dashboard`の適合データ・テンプレート不一致・フィルタ不一致・真の0件を分けて確認します。`fixtures/reviewTimeline.ts`は6行24場面の合成データです。`AIInput` / `AIResult`は未実行・生成中・失敗・根拠ありのprops-only fixture、`Momentum`はポゼッション適合/不適合、`Workspace/Onboarding`は案内の移動・終了を確認します。LLM実行やnative I/OをStorybookのcallbackで代替した結果を、それらの動作保証としません。

ダッシュボードの保存契約は`useDashboardTabController.test.tsx`で実`useSettings`と合成のメモリ保存gatewayを接続し、コピー・新規・編集・保存・再mount・キャンセル・保存失敗・外部import拒否を確認します。`dashboardNormalizers.test.ts`は固定template復元、count/duration保持、旧設定移行を検証します。`Workspace/Analysis/DashboardHeader`で固定/コピー/編集中/保存中を描画確認し、Macでは合成プロファイルの設定再読込と`.stad`往復を別途確認します。[保存契約](adr/0056-built-in-dashboard-editing-contract.md)。

`DashboardPieTooltip.test.tsx`は合成Timelineを実集計し、固定寸法のRechartsでhover表示を確認します。割合の件数・秒数、明示シリーズの元値、通常値、元値なしを検証します。jsdomでは寸法の供給だけを置換しており、実画素・tooltip位置は`Workspace/Analysis/Dashboard/MatchingData`をMacで別途確認します。

分析上部の変更は`AnalysisPanelToolbar.test.tsx`（4タブ・キー移動・3出力・処理中）、`DashboardHeaderBar.test.tsx`（選択と編集制約）、`DashboardFilterControl.test.tsx`（編集・reset・閉じる・focus復帰）で確認します。Storybookの`DashboardHeader/NarrowLongName`、`Dashboard/NarrowCharts`・`LongTeamNames`を使い、Macでは1440×775と800×420のdark/lightでselect上端・折返し・適用条件の解除・グラフラベルとtooltipを確認します。レポートの240px半円も同じ表示部品を使うためPDF/PNGを別途確認します。

全内容PNGは`fullContentCapture.pixels.test.ts`で座標ごとに異なる合成画素を使い、1/1.25/1.5/2倍の分数root原点・実crop座標・縦横末尾重複・15,000px境界を全画素比較します。canvas/Imageは小さなラスタ実装へ置換しており、PNG codecやnative撮影の画素保証ではありません。`frameCaptureViewport.test.ts`は分数原点をCSS transformではなくrelative配置で揃えることと検証帯の配置・復元を確認します。DOM矩形stubはcompositor補間を再現しません。`presentedFrameCapture.test.ts`は境界の中間色を含む画像の受入と1bit違いのnonce・縦横1画像ピクセルずれの拒否、同callback画像からのcrop、timeout・競合・navigation・crash・破棄時の購読解除を確認します。`fullContentCapture.test.ts`は撮影中のscroll/extent変更・unmount時の拒否と復元、`useAnalysisExportActions.test.tsx`は実Menu/Pieと保存取消・失敗時の未保存を確認します。Main/preload/Rendererは同じ型契約で再buildしてください。

Mac受入では一時profileと合成21widget・24×24表だけを使い、observerや追加待機を入れずcold起動後の最初のPNGを1倍/2倍・分数倍率で複数回確認します。先頭と全継ぎ目・末尾、21見出しと割合ラベル、表の全行列、検証帯/scrollbar混入の不在、scroll/style復元と保存取消・途中closeを確認します。同期の対応関係はnative画像での受入が必要です。PDFとdashboard保存/再読込も別経路として確認し、cloudのunit/compile成功をnative合格と扱いません。

## 開発環境

| ツール  | バージョン                        |
| ------- | --------------------------------- |
| Node.js | 22.12以上                         |
| pnpm    | 9.1.0（`packageManager`と同じ版） |
| Git     | 最新版                            |

通常のElectron開発・配布にPython runtimeは不要です。Event modelのtraining/evaluationは別private R&D repositoryで管理します。

```bash
git clone <repository-url>
cd sportaglytics
npm install -g pnpm@9.1.0
pnpm --version
pnpm install --frozen-lockfile
pnpm run electron:dev
```

pnpmのglobal install先へ書けない環境では、利用環境のCorepack等で同じ9.1.0を選択してください。最新pnpmへの自動更新やlockfileの再生成をセットアップの代用にしません。依存版は `package.json` と `pnpm-lock.yaml`、コマンドは `package.json` のscriptsが正本です。

公開ソースの型・unit・Storybook検証に私有R&D repositoryや学習データは不要です。初回installと `vision:prepare` を含むbuild/Storybookでは公開依存・固定モデルの取得にネットワークが必要です。Electron E2E・native packagingはOS別のツールと準備が必要で、Linuxのunit成功をmacOS/Windows実機成功と扱いません。fork PRで利用できない署名・公証・private packの確認はmaintainer側の工程として未実施範囲を記録します。

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

packを同梱する場合は[配布前レビューと由来記録](event-pack-provenance.md)に従って`distribution-provenance.json`と公開可能な根拠・LICENSE/NOTICEを用意します。`afterPack`は署名前のmanifestと全ファイルを照合し、未確認・不整合のpackがあれば失敗します。`verified`表示はこの配布レビューを代替しません。既存ローカルpackの実行時契約は維持します。

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

`test:run` / `test:ci`はVitestに加えて`check:build-downloads`を実行します。builderの合成ダウンロード、checksum拒否、ファイルキャッシュ、agent・redirect・progress・timeout、HTTP response cacheの再有効化拒否をloopbackで確認します。ビルド依存の限定パッチとpnpm 9 manifest hookは[ADR 0058](adr/0058-build-downloads-without-response-cache.md)を参照してください。`electronDownload.cache`のファイル保存先は維持し、gotの`downloadOptions.cache`は使用しません。

共通ゲートと変更対象ごとの追加検証は [Testing](testing.md#required-quality-gate) を正本とします。UI変更は `pnpm run verify` を実行し、実行環境・コマンド・結果・未実施範囲をPRへ残します。

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

CIの実施範囲は [Testing](testing.md#required-quality-gate) と `.github/workflows/formatting_code.yml` を参照してください。素材や外部仕様の出典、互換性の未検証範囲は [由来の確認台帳](provenance-review.md) へ集約します。

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

自動追加後は通常の `TimelineData` として扱い、元モデル・候補情報を任意の `provenance` に保存します。欠落した旧データを補完せず、再生・編集から人確認を推定しません。スコアは元候補の値のままです。`src/types/timeline/provenance.ts` が型とguard、`src/shared/timeline/timelineProvenance.ts` が読込・コピー・結合を担当します。Timeline/Analysis IPCでも任意フィールドを検証し、通常のupdate commandには由来の編集を許しません。候補の由来が保存契約に適合しなければ、一括追加の前に検出結果を拒否します。設計と互換性は[ADR 0069](adr/0069-timeline-detection-provenance.md)、試験範囲は[Timeline / IPC検証](testing.md#settings--timeline--ipc)を参照してください。

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
2. Mac候補はevent packなしを確認し、同梱モデルと告知をレビュー
3. `develop -> main` PR
4. main PR品質ゲート
5. merge後のmain commitへrelease tag
6. Release desktopをmainから手動dispatchし、全ゲート後にpackage/release assets作成。同じバージョンの公開済みタグ・DMGを上書きしません（[ADR 0032](adr/0032-immutable-release-artifacts.md)）。

Electron E2Eは `scripts/run-electron-e2e.mjs` で全シナリオの成否を収集し、1件でも失敗すると配布へ進みません。詳細は[テスト手順](testing.md)を参照してください。

Releaseの検証要約は`scripts/release-verification-summary.mjs`で生成します。最終DMG reportとWindows reportのversion/source identity/検査状態を確認し、配布候補の実bytesをhashして照合します。公開要約の値は許可リストで抽出し、raw logやrunner pathは転記しません。新規ReleaseのassetとSHA256SUMSへ含め、詳細reportのActions artifactは90日保持します。公開要約は独立attestationではなく、品質・E2Eの成否はリンク先workflowで確認します。[公開手順と保証範囲](../.github/RELEASE.md#公開前のゲート)。

月次architecture reportも通常CIと同じNode 22.12.0 / pnpm 9.1.0を使います。Release要約の限定検査は`node --test scripts/tests/macos-release.mjs`で実行でき、Macへの接続や署名・公証を開始しません。

配布前に `pnpm audit` / `pnpm audit --prod` も確認します。lockfileを固定してインストールし、UIのゲートとStorybook buildをReleaseでも実行します。

macOS署名はキーチェーン修正版のelectron-builder 26.16.1で行います。builder関連パッケージとlockfileを揃えて更新し、署名・公証の障害は[Release手順](../.github/RELEASE.md#公開後と復旧)に沿って切り分けます。

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

Timelineの自動表示は`openWindow({ activate: false })`、ユーザーの明示表示は既定のactivateを使います。窓の初期表示と役割タイトルは`documentWindowPresentation.ts`に分離します。`clipExportMenuAction.test.ts`で自動表示時のfocus維持と明示表示時の復帰を確認し、`menuSections.test.ts`で再生画面へのSession別経路を検査します。実CUAではnative窓タイトル・route・同じPIDを対応させ、複数窓ができた後も主画面の操作領域を取得できることを確認します。

`e2e-event-detection.mjs`は合成パッケージを使い、正式ロゴ、解析画面の独立、閉じて再表示した実行状態、狭幅での操作、映像ウィンドウのサイズ維持、ウィンドウ群の前面表示ハンドラーを確認します。前面表示はElectronのfocusイベントを注入して実native APIの呼出順とfocus維持を検査するもので、OSの実際の重なり順・仮想デスクトップを自動保証する試験ではありません。`applicationWindowActivation.test.ts`は非表示・最小化・破棄後の遅延focusを無視することを検査し、`e2e-window-security.mjs`でも実nativeウィンドウが非表示を保つことを確認します。`eventDetectionWindow.test.ts`はSession境界、Controllerのテストは背景実行中のTimeline編集と所有元終了を検証します。

追尾は`anchoredFeatureTracker.test.ts`で既知の端数移動・拡大と足元座標を使い、従来の平行移動積算と比較します。合成映像の誤差を実試合の精度として扱いません。

WindowsのFFmpegはzlibを静的リンクしてPNGのエンコード/デコードを有効にします。media-toolsビルドはPNG生成と読込の往復検証を通してから成功manifestを書きます。依存ソースのchecksumとライセンスを同梱し、DLL検査とPaint出力E2Eも維持します。

Windows media buildにはMSYS2 UCRT64の`gcc`、`cygpath`、`pacman`と、使用packageが配置する告知全文も必要です。compiler/runtimeのpackage版・13告知のSHA-256を`build.json`へ記録し、cacheとpackagingで対応を確認します。告知不足を回避するためにhash検証を外さず、[配布手順](third-party-distribution.md#windows-compilerruntimeの告知)に従ってpackage更新を確認してください。

### 戦術盤の端末内認識

`pnpm run vision:prepare` はMediaPipe Tasks Vision 0.10.21（外部統計送信なし）の固定npm版と、SHA-256で検証するEfficientDet-Lite2 INT8 revision 1を `public/pitch-vision/` に準備します。start/build/Storybookコマンドに組み込み済みです。初回の開発・ビルドではモデル取得にネットワークが必要で、ハッシュ一致の資産があれば再取得しません。実行時には同梱資産のみを使います。SDKのfile URLフォールバックを避け、同梱WASMをBlob URL、モデルをバッファとして渡します。ElectronのwebSecurityは緩和しません。モデル・WASMはGitに含めず、配布ビルドとライセンスを同梱します。モデルの出典とハッシュは `resources/pitch-vision/NOTICE.md` が正本です。

較正・戦術盤のStorybookは `Playlist/Paint/Pitch Calibration` と `Playlist/Paint/Tactical Board`。E2Eは `pnpm run e2e:prepare` 後に `node scripts/e2e-tactical-board.mjs` を実行します。合成映像でHTTP通信を拒否し、実モデルのロード・推論、部分較正、削除/Undo、PNG、保存/再読込を確認します。人物検出の実試合精度を保証する試験ではありません。起動時の未分類YouTube widget要求で停止した場合は、[起動scriptの分類・証拠の条件](testing.md#戦術盤)に従い、観測したexact URLと同じ実行のbootstrap宣言を照合します。未分類要求の包括許可やHTTP遮断の解除は行いません。

## 第三者告知と対応ソース

renderer/preload buildは実際の出力moduleからlicense inventoryを生成します。追加した依存にはlicense本文が必要です。`pnpm run licenses:sources`はnative再buildなしで固定source archiveを準備します。[配布手順と確認範囲](third-party-distribution.md)。

Windows CIは同じrunで作成・インストールした成果物のNOTICE、資産・モデル・native告知のbytesと署名状態を検査し、hash reportを保存します。[実行手順と証拠の範囲](windows.md#開発検証)。

macOS llamaの準備は固定版の依存告知を外部ファイルへコピーし、cacheと`afterPack`で本文hash・実行ファイル内の全文を検査します。版変更時は [告知の出典](../resources/third-party/llama-b7849/README.md) も更新し、両archの実ファイルで検証してください。`node --test scripts/tests/distribution-notices.mjs`は欠落・改変・別runtimeを拒否する合成試験で、macOS配布検証を代替しません。

Windows media toolchainはMedia FoundationのCPUエンコーダーを使用します。Windows NではMedia Feature Packを有効にしてください。native build、CPU MP4、全シナリオのインストール後検査は[Windows開発・検証](windows.md#開発検証)を参照してください。

Macの配布準備は[Release手順](../.github/RELEASE.md)に従います。`release.yml`は手動dispatchのみで、既存SecretsをCI内で利用します。`publish=false`もApple送信を含むため、未署名のローカル検査には使いません。Mac専用sourceは`node scripts/package-media-sources.mjs --platform macos --require-builds`で生成し、Python 3とMac 2 targetの既存manifestを使います。`include_windows=true`は同じrunで新規buildしたWindows installer・report・manifestを検査し、`--platform windows --require-builds`の対応sourceも同じ新規Releaseへ公開します。

Macのelectron-builder publisherは`mac.publish: null`で明示的に無効化する。`--publish never`だけでは既存GH_TOKENから更新用`app-update.yml`が自動生成されるため、DMG出力そのもので署名前の同梱物検査を実行する。公開は検証後の既存`gh release create`工程だけで行い、同梱物の許可リストは緩めない。

保存済み録画のシーク・終端・別process再開は`node scripts/e2e-capture-reopen.mjs`、共通picker・以前の編集コピーの採用・同じ場所への保存と9境界のプロセス終了復旧は`node scripts/e2e-unified-open.mjs`で合成データを検証する。既存live-captureに加えて対象実行する。

## 公開サンプルと限定負荷測定

初回導線用の小さな配布ZIPと生成recipeは[quickstart](quickstart.md#サンプルの由来と再生成開発者向け)、Node上の限定計測は[合成負荷測定](synthetic-workloads.md)を参照してください。`pnpm run sample:generate` / `pnpm run test:sample`だけはPython 3とlibx264付きFFmpegを使います。通常のアプリ実行にはPythonは不要です。`pnpm run test:e2e:sample`は公開ZIPの展開にPythonだけを使い、アプリ側の読み込み・保存・出力を実行します。WindowsのPython実行名は`PYTHON`環境変数で指定できます。

`pnpm run benchmark:timeline`は既存結果を上書きしないため、再測定では新しい出力パスを引数に渡します。計測はNodeで完結し、Mac/WindowsのUI評価やcodec性能の代わりにはなりません。

## Renderer文書とIPC送信元の検証

BrowserWindow/preload/IPCを変更するときは[ADR0070](adr/0070-renderer-document-and-frame-trust.md)の脅威モデルを確認します。共通guardはmainFrameと`getRendererUrl()`のentry documentを照合し、既存のsession/expected-window検証も維持します。新しいrenderer URL・外部ページ・子frameへ権限を広げる変更は、正規用途と拒否する経路を先に列挙してください。

`node scripts/e2e-window-security.mjs`は一時profileと合成文書だけで、実preload/Mainの許可・拒否と生成Help/Settingsを検査します。実行前に通常の`e2e:prepare`が必要です。Linuxクラウドでsandboxを利用できない場合の起動フラグは検証環境の制約として記録し、本番BrowserWindowの`sandbox`を変更しません。この限定検査の成功をMac/Windows配布検証や全IPCの完全隔離とは扱いません。[必須試験](testing.md#settings--timeline--ipc)。

再生用コピーの短尺接続の範囲と[通常リリース条件](playback-cache.md)を区別してください。120秒以内の全fileで実機qualificationを行い、全長変換は別途実行範囲を確認します。`electron/src/playbackCache`の検証用portsは実FFmpeg/HW効果の代替ではありません。パッケージopenの取消は専用IPCを使い、読み取り待ちの中止と更新commitの完了を区別してください。

`packageHistoryDirectory.test.ts`は同一親pathの反復取消でOS列挙が増えないこと、名前と型付き列挙をまたぐ所有権、旧I/O完了後の新しい列挙、別親pathの独立性を検証します。`packageMigrationCancellation.test.ts`は現行・旧形式の候補探索中の取消、遅い失敗後の新規候補の発見、選択中に所有元が失効した場合の更新防止と原本不変を確認します。候補探索にも`historyRead`を渡し、取消を空の候補や利用不可コピーとして扱わないでください。`cacheReusePipeline.test.ts`は不一致の全時刻/音声proofと原本変更をHW起動前に拒否し、正常候補には引き続きHW検査を要求します。いずれも実保存先のI/O速度や実デコーダー性能の合格ではありません。

保存adapterの`openPlaybackCacheStorage`にはMainが所有するアプリdata領域と明示的な総容量/空き容量reserveを渡します。生成中は所有runnerが`checkBudget`を監視し、process終了後のvalidate段階で`seal(validation, signal)`、最後に`publish`を呼びます。hash中の取消を維持するため、sealをpublish内へ移さないでください。private一時ファイルの検査と、実FFmpeg/IPC/再生選択の接続・OS別試験は区別します。

変換runnerは`runCacheConversion`へ保存層の`checkBudget`と明示期限を渡し、停止状態callbackをjobへ接続します。`close`前にconvertをrejectしてstaging削除を始めないでください。単一pollと終了未確認のbusy維持は合成workerで検査し、実process停止・固定recipe・Main終了時の所有は別の接続検証とします。

再生用コピーのMain/preload境界は `src/shared/validation/jsonValues.ts` の依存なしJSON readerで検証する。Mainは外部runtime dependencyを同梱しない構成を維持し、`build:electron-main` の配布依存検査を省略しない。

再生用コピーの複数音声検証では、Mac主窓で限定有効化した`AudioVideoTracks`の長さ・enabled配列をコピー採用前後/原本復帰後で照合してください。API無効・track欠落・setter無反映はunitで拒否を確認します。実機は製品の再生/停止/seek操作を使い、共通時計と競合する直接`video.play()`を計測側から呼ばないでください。変換の所要時間はMain成功artifactのprocess実測を使用し、poll状態の差や無音合成素材の値から実素材を保証しません。HW生観測・全時刻/音声proof・原本hashを私的証跡へ保存し、実音声同期/物理scrubをAPI観測と区別します。

保存済み再生用コピーは明示reuseで原本/候補の全hash・現在runtimeの新規compatibility HW確認を毎回行います。生成時のfull HWと混同せず、区間/frames/mediaTimeを記録します。全列proofは同一起動内のメモ、または同一ビルド・環境・実bytesに結合したprivate認証付き記録だけ再利用し、それ以外は再計算します。生成時間と採用後の操作試験を別に記録し、実機の候補再利用では変換呼出し0回を確認します。新しい検証profileへの候補copyは準備作業として記録し、製品のprivate root探索を広げたり検証結果を注入したりしません。

field_order欠落素材のfixtureではraw stream値を注入せず、全packetの由来/共通時計と全decoded表示順を別に証明します。製品のprefix仮分類→全尺input proof→変換の順序、後半の混在/欠落拒否を回帰し、同梱VideoToolboxの実変換は別途調整したCUA試験で確認します。

再生用コピーの性能測定では未検証の初回、同一起動内のメモ、正常終了後の別Mainによる永続proof利用を分け、sourceProof/contentProofのfrom・reused・persistence・elapsedMs、変換とHWの時間を記録する。再起動試験は最初の製品IPCが実際に保存した同じprofileを使い、記録注入・鍵コピーをしない。実梱包のoriginal-fsでstoredとpersistentを確認し、Node上の模擬ASARだけで実機合格にしない。全hash・所有権・HWの検査を無効化して測定しない。[仕様](playback-cache.md#保存済みコピーの明示再利用)。

候補探索と内容検査の隣接digestは同一Jobの`CacheIdentityHandoff`だけで共有する。捕捉前にJobをretainし、closeの失敗はcleanupに残す。通常finallyと明示retryCleanupを区別し、失敗closeを暗黙に再発行しない。性能比較では`mediaReads`の回数/合計bytes/overflowを確認し、probe時間・HW時間・物理ディスク転送とは区別する。

区間再生の基盤は`cacheMp4Boxes.test.ts`で64bit/サイズ0/高位bit変異/欠損/連続境界/容量上限/取消/共有budgetを検査する。byte layoutの合格はcodec・全field/音声・時計・HWの証明ではない。段階実機検証は[ADR 0077](adr/0077-demand-driven-playback-ranges.md)に従い、まず複数音声MSEと隣接境界、その後field依存範囲と生成速度を分ける。

区間再生のRenderer基盤を変更するときは、`PlaybackRangeBuffer` / `SourceBufferTaskQueue` / `rangeBufferIndex` / `rangePlaybackRegistry`と共通時計のunitを確認する。読込・native完了・closeを別々に保留し、期限を終了確認と取り違えないこと。通常採用は未有効化のため、これらのunitだけで実機統合済みと記録しない。既存capture blob、source reload、空白・複数映像の共通時計も回帰対象とする。

区間キャッシュの所有・取消回帰は `cacheRangeReadLease.test.ts` と `cacheRangePipeline.test.ts` に置く。Session失効の即時通知と実I/O・worker closeのdrainを分け、遅いACKで次世代を成功扱いにしない。実測では生成単独の速度と検証・供給を含む速度を区別し、UI未接続の基盤試験を実再生合格に扱わない。

Native再生はmacOS arm64の適格な停止中sourceを自動使用します。開発は固定build-local runtime、配布は署名検証済みの固定Resourcesを使います。[機能inventoryと受入条件](native-playback.md)を確認し、6倍速・全音声・scrub・tag/save/exportを維持してください。全field/hash証明は開発診断であり、通常openで全尺走査しません。

終了receiptが失敗した場合の内部資源回収は、[操作と所有権](native-playback.md#操作と所有権)に従って物理終了と正常drainを区別します。`test:native-runtime`で両方の失敗経路を検査し、資源回収だけを原本復帰やQuit成功と扱わないでください。

bwdifの2 slice workerを比較する際は、同一区間の全field画素・PTS・metadata、decoderを含むprocess全体のCPU/RSS、取消と終了を確認します。decode worker4個、session数、32field creditは維持します。単体測定と実製品の供給不足を区別し、閾値を緩めて合格にしません。互換再生へ引き継いだ文書ではpauseごとの再試行を行わず、再open時に資格を取り直します。

`relativeSeekInput.integration.test.tsx`では実DOMキー/ボタンクリックを受領させ、古い別窓時計通知とHTML時計の遅延中も相対入力が失われないことを検査します。`timelineWindowSeek.test.ts`は所有元の未確定位置・方向反転・端点・source/同期モード変更を確認します。合成IPC/clockの検証であり、OS入力生成や物理表示の検査とは区別します。

連続ドラッグの回帰では`useMediaTimeSync.test.tsx`で実際の`video-seek-start`イベントも発行し、位置propsだけの更新で代替しない。有限ローカル全区間seekable時の集約と、録画バッファ欠落・source読直し・gap再入時の置換を併せて検査する。`NativeSurfaceController.test.tsx`は適格外操作からの復帰を明示したfixtureで、確認済み中間画像の表示・共有時計・最終位置までのlease保持を合成確認する。これは実マウス入力・実デコーダー・物理表示の検証ではない。復帰中の取消・設定変更・実エラー・遅延完了は`nativePlaybackController.test.ts`で確認する。

Native時計の通知を変更するときは、`nativeSnapshotDelivery`の配送中1件・最新保留1件、preloadのowner/ACK検証、非同期write失敗、UI購読者の例外、再open/文書変更の回帰を実行する。Rendererタイマーを進めない通知試験と、背景状態を記録した実BrowserWindow試験を分ける。

Native seekの要求整理を変更するときは、未完了の同一停止位置へのpointer releaseが新しい復号や期限延長を起こさないこと、異なる最新位置・再生中・完了後の要求が残ることをcontroller回帰で確認する。実UIでは通常倍率のdragとreleaseを対照比較し、画像ACK、音声ready、最終位置、物理表示を混同しない。

時刻の有理数表現を変更するときは、`sourceClockFraction`と`SourcePosition.test.cpp`で両言語の採否・分子/分母、field境界の隣接double、PCM範囲、極小値・上限超過を確認する。数値変換だけでなく、実synchronizerの停止アンカー、audio renderer再接続、seek/再開/再停止が元の要求時計を保持することを検証する。

Native末尾復帰の変更時は、量子化差の有界処理と実SyncedVideoPlayerの末尾commit回帰を実施します。合成portの成功と原本での実HTML復帰は別の検証です。[回帰の範囲](testing.md#test-placement)を参照してください。

## Native exportの開発候補

通常起動ではnative export providerを渡しません。[専用helperのbuildと回帰検証](native-export.md#検証入口)を参照してください。完了receiptだけでは公開資格になりません。

限定native画面を変更する際は、canvasのbacking寸法、absolute sourceとfile URLの同一性、復帰中の操作置換、実停止時計、media失敗とcleanup不明の区別、自然終端でのpause競合を回帰する。専用profileと架空packageで元ファイルを直接参照し、実projectへ書き込まない。短時間mute試験、聴取、長時間品質は分けて報告する。

音声選択から書き出しへの変更は、`clipExportAudio.test.ts`、`usePlaybackAudioSelections.test.tsx`、`playbackAudioRegistry.test.ts`でsource切替・native準備中・同一source競合・最終angleへの適用を検査します。無変換条件は`exportStreamCopy.test.ts`と`exportFfmpegRunners.test.ts`で確認し、音声番号を付けるだけで既存の適格な全体出力を再圧縮へ落とさないようにします。

自動起動の`useNativePlaybackPanel.test.tsx`は準備順序・同URLの登録置換・適格外・失敗後の再試行防止を検査します。`useNativeCacheActions.test.tsx`はnative終了後の既存cache操作と文書変更の取消を検査します。有音資格の存在を実聴取合格とは扱いません。

The limited native trial reports Renderer failure through a dedicated typed IPC to its existing document owner. It requires no new permissions, persistent settings or generic event API. The optional sink must not affect drain or recovery when absent or failing; automatic source qualification remains separate from diagnostic persistence.

### Native preview helperのローカル構築

macOS arm64では`pnpm run native:build`で固定sourceからhelperとN-API receiverを生成します。最大4 compile job、出力は`.cache/native-playback/darwin-arm64`です。入力hashやtoolchainが変われば再構築し、再利用時は厳密なfile集合とhashを確認します。`pnpm run test:native-build`は欠落・改変・余分なfile・symlink拒否を確認します。`pnpm run native:sources`で[対応ソース](third-party-distribution.md#native-playback-previewの対応ソース)を準備します。helper単体の生成は実署名artifactの起動・品質合格の代わりにはなりません。

通常macOS packageは`native:build`と既存media/llama資源を準備して作成します。`scripts/macos/standard-after-pack.mjs`がarm64のnative資源を厳密照合・事前署名し、`native-after-sign.mjs`が外側署名後に再検証します。`nativeSignature`/`nativeResources`負例と`test:native-runtime`を実行し、実packaged起動・fallback・終了を別途確認します。新しいcredential/OS設定は不要な既存署名環境だけを使用し、公証は[Release手順](../.github/RELEASE.md)で確認します。

短いnative供給不足の回復を変更した場合は`pnpm run test:native-runtime`とMain/Rendererのnative Session/Controller回帰を実行します。回復は同一worker・既存queueの範囲で停止時計を維持し、補充の累積時間を有限にします。映像だけの一過性不足は原本時計と連続wall時間の両方10ms未満に限り共通時計を継続し、停止回数だけで失敗にしません。実原本の再測定では不足と回復後の進行、操作応答、終了receiptを別々に記録し、回復した待機を消して品質合格にしません。

フィルタ/frame decoderのthread方針は`test:native-build`で実macOSのrequested QoS/relative priority、生成失敗の後始末、上流call siteの限定適応を検査します。build revisionと`nativeResources`の受入revisionは同時更新し、旧・未知revisionの拒否を維持します。対応sourceには上流archiveと固定日付の変更通知を再適用するrecipe/headerを含めます。

音声窓の供給方針を変更した場合、`test:native-runtime`の`PCMWindowSupply.test.mm`で実owner/pumpと合成readerを接続して、再生開始・先行投入後の昇格・停止中の閾値・全3音声の原本時刻・取消済み完了・末尾・同時reader上限を確認します。実音声読取速度と可聴同期はこの合成回帰に含みません。

圧縮音声の取得とPCM復号は`FiniteAACInput` / `AACWindowDecode`へ分離しています。合成のcookie・packet境界・converter失敗回帰は`test:native-runtime`に含め、実媒体のPCM/PTS照合とは区別します。内部索引のメモリとI/O中断閾値はpacket payload上限と別に評価してください。通常起動時の全尺PCM/hash走査は追加しません。
