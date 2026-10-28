Timeline検索は下部dockで時間軸の全幅を保ちます。共通desktop compact密度と新候補の検証限界は[評価記録](reports/2026-10-compact-density.md)を参照してください。

開始画面の状態表示とfocus/scrollはprops駆動View内のDOM操作に限定します。読み込み・再試行・取消の状態源は既存の`useStartPackageOpen`を維持します。映像選択の最低高とoverflowはView側で扱い、選択・作成・同期のデータ契約は変更しません。

# SporTagLytics System Overview

Timeline所有元の通常Close/Quitは`timelineCloseProtection.ts`が調整します。用途限定のpreload bridgeからRendererへflushを要求し、hookが直前の編集と行メタデータを同期的に固定して既存保存queueへ渡します。Mainは各ownerの成功応答とatomic writerの完了を確認してから終了し、失敗時は編集を再開します。Playlistの確認とライブ録画停止を維持します。[保存契約](package-compatibility.md) / [ADR 0068](adr/0068-timeline-close-save-handshake.md)。

CSVの文字列処理はpureな`src/utils/csv.ts`へ集約し、Timeline・分析データ・マトリクスの出力時に適用します。式開始文字への接頭辞はCSVだけの表現であり、数値・保存文書・JSON/SCTimelineは変更しません。[出力契約と制限](sctimeline-implementation.md#表計算ソフト向けcsvの文字列)を正本とします。日本語UIのHTML言語は`ja`で指定し、個別の操作や設定は増やしません。

画面上のリンク作成・記録範囲はSporTagLytics自身の操作として説明します。Sportscode XMLの対応subsetとSCTimeline JSONの外部往復未検証は別の契約であり、[互換性](package-compatibility.md)と[由来の確認台帳](provenance-review.md)を参照してください。文言変更によってimport/export・保存形式や参照資料の由来は変更しません。

Playlistの保存済み文書ロードと追加配送はRendererごとの文書境界で処理します。外部文書listenerを先に登録し、ロード中の追加はsnapshot適用後にFIFOで処理します。新しい編集・ロード・syncがあれば古いdisk snapshotは適用しません。MainはWindow別ticketに対するRendererの採用応答を受けて保存先を確定し、read完了では保存先やdirtyを変えません。初回open intentも採用前の保存先にはしません。既存commandに用途限定の応答を追加し、Session宛先・文書形式は維持します。[ADR0059](adr/0059-playlist-renderer-delivery-readiness.md)。

配布runtimeは同じ43 majorのElectron43.8.1へ固定し、[GHSA-jr5w-w6x2-84p9](https://github.com/electron/electron/security/advisories/GHSA-jr5w-w6x2-84p9)を含む監査対象の修正版を使用します。既存のsandbox・contextIsolation・webSecurity、IPC公開面、protocolと署名設定は維持します。開発用wait-onのJoi18.2.9 overrideは配布runtimeに含めません。ビルド用gotの未使用HTTP response cacheは[ADR 0058](adr/0058-build-downloads-without-response-cache.md)に従って依存・実行経路から除去し、checksum付きファイルキャッシュと必須auditを維持します。

組み込みdashboardは固定IDを維持し、利用者の編集は新IDのコピーへ保存します。`useDashboardPersistence`は既存`useSettings`のboolean結果と進行状態を扱い、Controllerは成功後にのみ編集終了・切替を反映します。正規化はcount/durationを保持し、既存移行は継続します。[ADR 0056](adr/0056-built-in-dashboard-editing-contract.md)。

分析UIは既存の集計とcallbackを維持し、データに一致しないチャートの表示だけを縮めます。初回案内のprops-only Viewは共通UI patternsへ配置し、完了状態の保存・外部イベントは従来のControllerが所有します。

Dashboardのpieとbarは集計結果の`calcMode`を受け取り、割合tooltipには集計済みの元値を件数・秒数で併記します。元値のない場合は割合から推定しません。

分析上部のタブとDashboard操作欄は表示層で構成し、`DashboardFilterControl`は既存フィルターEditorの開閉だけを所有します。半円のレイアウトはRechartsの描画領域に合わせ、本体とレポートで共用します。集計値・指標・保存モデルには関与しません。

分析PNGは入れ子のスクロール領域と表を一時展開し、横長の表の祖先の幅・overflow制限とスクロールバーを一時解除します。同じscroll rootに撮影ごとに異なる検証模様を配置し、既存`capture-window-region-png`でMainの`beginFrameSubscription`が受け取った画像内の模様・位置・倍率を確認します。一致したcallback画像そのものから検証帯を除いて切り出し、別の`capturePage`は呼びません。rootをrelative配置でnative pixel原点へ移し、検証帯・cropもpixel境界へ揃え、実際にclampされたscroll末尾まで合成します。出力中はメニューの終了遷移とチャートのJSアニメーションを無効化し、失敗・閉じる・保存取消でも一時styleとscrollを復元します。PDFは従来の別window/printToPDF経路です。[ADR 0057](adr/0057-verified-analysis-frame-capture.md)。

起動画面・新規作成の表示は既存のprops-only Viewで構成し、開始操作・履歴・ロード復旧のcallback境界を保ちます。[起動画面](start-workspace.md)に表示と操作をまとめています。

Timeline reviewは既存文書を読み取る派生表示です。検索・ページ・開閉はhook、描画はprops-only Viewへ分離し、既存Timeline controllerの選択・シーク・編集とPlaylist callbackへ接続します。Windowメニューの分析もRendererの既存分析open/snapshot経路を使用します。[操作](timeline-review.md) / [ADR 0055](adr/0055-timeline-review-without-document-filtering.md)。

パッケージを開くGatewayはMainの互換preflightを通し、以前の編集コピーを含めて内容を確認し、既知の旧構造を検証済みstagingから元パスへ設置してからSessionを確保します。更新前の原本はjournal付きバックアップに残します。Timeline保存は検証済みloadを条件とし、失敗状態とretryを映像・独立Timelineへ同期します。テキスト保存は同じディレクトリの一時ファイルと順序付きrenameを使います。Sportscode XMLは専用Controller/Domain/GatewayとMain serviceで、明示映像・秒補正から別プロジェクトを作ります。[互換・原本保護の契約](package-compatibility.md)。

ライブキャプチャは専用RendererのUSB取り込みとMainのIP入力を、確定済みMP4区間へ統一し、通常パッケージのアングルへ追記します。コードは既存の共通時計を使います。[ライブ仕様](live-coding.md) / [ADR 0053](adr/0053-live-capture-package-timeline.md)。

録画の所有ウィンドウは非表示で存続し、パッケージとコマンドの接続先だけを共有します。fragmented MP4をMediaSourceへ先読み追記し、区間境界で再生成しません。録画中の映像ウィンドウはバックグラウンドでの時計抑制を無効にします。

Playlist v5は参照元package ID・相対位置と各クリップのdefaultAngleを保存します。MainのmediaReferences AdapterがOS bookmarkと端末内の登録先から移動を解決し、Rendererへ型付きIPCで渡します。既定アングルはクリップ進入時と単一ファイル書き出しで共用します。[参照・アングル仕様](playlist-features.md#参照先の移動と再接続)。

出力テキストのレイアウトはsharedの純粋関数を正本とし、Mainの映像サイズ検査・FFmpeg書き出し・静止画プレビューで共有します。専用IPCはsenderとpayloadを検証し、上限超過は保存先選択前に拒否します。[ADR 0049](adr/0049-bounded-export-text.md)。

Playlistの自由記述は文書v4のnoteに統一します。Timelineの保存フィールドは維持し、旧Playlistのメモは共有の読込境界で移行します。書き出しテキストの有無はウィンドウ内の一時状態で、毎回明示選択します。[ノート仕様](playlist-features.md#ノートの編集と映像出力) / [ADR 0048](adr/0048-playlist-instance-notes.md)。

Playlistの再生順は文書の`presentationOrder`を正本とし、Sorterのソートを保存・Undo・再生・書き出しへ共通反映します。`rows`はOrganizerの所属を保ち、検索や列表示はウィンドウ状態へ分離します。旧文書の再生順をロード時に移行します。[Playlist仕様](playlist-features.md#文書の正規順序) / [ADR 0047](adr/0047-playlist-sorter-presentation-order.md)。

SporTagLytics の現行アーキテクチャ概要です。詳細規約は `AGENTS.md` を正とし、本書は実装トレース用の要約に限定します。

関連する入口:

- [ドキュメント索引](README.md)
- [ドキュメント運用ガイド](documentation-guide.md)
- [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix)
- [プロジェクト構成](project-structure.md)
- [ADR](adr/README.md)
- [Testing and Quality Gates](testing.md)
- [Privacy and Data Handling](privacy-and-data-handling.md)
- [自動イベント検出](event-detection.md)

メイン・参照Playlist・書き出しは `shared/media/mediaTimeline` の共通時刻変換を使います。Mainの `mediaTimelineSource` がパッケージの現行配置とアングル補正を読み、型付き `media:resolve-timelines` でPlaylistへ渡します。Playlistの `media/` はソース切替・読込待機・共通時計を担当し、Paintの表示フレームも元ファイル内の時刻から変換します。[ADR 0040](adr/0040-shared-media-timeline-clock.md)。同期編集は`useAngleSyncSession`を状態源とし、型付きTimeline IPCを介して独立タイムラインの既存再生ヘッドと映像を接続します。通常のCodingツールバーに同期操作を統合し、再生用Settingsのアングル切替キーを両ウィンドウで共用します。アングルごとの連続時計を使い、Sync Pointを揃えてから配置と補正を一緒に保存します。映像Windowの背景描画制限を無効化し、Timeline操作中も時計を進める。選択外の同期プレビューも描画可能な最小領域を保つ。映像の読み込みイベントでも最新の要求時刻を反映し、シーク中のフレームを同期点に使用しません。実フレームの近傍PTSは型付き `media:frame-window` でMainから取得し、UIと分離します。[アングル同期仕様](angle-synchronization.md) / [ADR 0041](adr/0041-angle-sync-point-workflow.md)。

Codingの記録時刻も共通時計を使います。`VideoPlayerScreen`が`CodingPanelRuntime`へ渡す`codingTime`を`useCodingTime`が読み、開始・終了・リンク処理へ同じgetterを供給します。getterの参照を固定し、毎フレームの更新で別ウィンドウのIPC購読を張り直しません。元動画の`currentTime`やアングル1の存在から時刻を推定せず、パッケージ未選択・同期調整中は`null`として記録を保留します。保存形式は既存の共通時刻のままです。

`usePackagePlaybackClock`は現在位置にある通常ファイルのネイティブ動画の読み込み・シーク待ち中、時計の進行と全アングルのネイティブ再生を保留します。再生指示は保持し、準備できたら一緒に再開します。待機時間を復帰後の差分へ持ち越さず、先に準備できた映像が単独で進むことによる補正シークも防ぎます。アングル補正を含む実クリップの範囲だけを対象とし、空白・終了済みフレーム・終端エラー・ネイティブ動画要素を持たない経路は従来の時計を維持します。録画MSEのblobソースも、次の記録や空白の通過に時計の進行が必要なため待機の判定元から除外します（通常ファイルへfallbackした場合は判定します）。空白中はMSEへシークを要求せず、次の実クリップへ入る際は古い未完了シークを置き換えます。

複数クリップの再生位置は`useMediaTimeSync`が元動画へ適用します。デコード中の要求は最新位置へまとめ、再生中のずれ補正は最低250ms間隔・再生速度を考慮した許容差で行います。停止時と明示的なシークは精密に合わせます。デコーダーが停止位置を実フレームへ補正した場合、同じ要求を完了通知から繰り返さず、位置変更・読み直し・明示操作で再適用します。一度到達した位置がソースの読み込み復元で後からリセットされた場合も、未解決要求とは区別して再補正します。`useVideoTimeController`から同じプレイヤーへ二重にシークしません。速度キーはsharedの`useHeldPlayback`で操作前の再生状態・速度を保持し、MainとPlaylistがそれぞれの再生APIへ適用します。[ADR 0046](adr/0046-coalesced-playback-corrections.md)。アングル同期プレビューでもデコード中のseekを中断せず、未到達の同じ停止要求を繰り返さない。新しい時刻・元動画・再生から停止への変更は適用し、到達済みの位置が読み込みで戻された場合は再補正する。非ゼロ先頭PTSと遅延通知はHook試験と3/4アングルE2Eで確認する。

Timelineの`useTimelineViewport`は、同じポインター位置での連続拡大中に論理時刻のアンカーを保持し、OSのスクロール位置の丸め誤差を累積させません。手動スクロール・ポインター移動・表示幅変更・端への到達時は表示位置からアンカーを取り直します。

## レイヤー構成

- 依存方向: `pages -> features -> shared`
- `pages` はルーティングと feature 合成のみ担当
- `features` は `Screen / Controller(or Hook) / View / Gateway / domain` を機能単位で内包
- shared 相当は `src/components`, `src/hooks`, `src/utils`, `src/types`, `src/contexts`, `src/shared`, `src/report`
- feature 外から feature を参照する場合は `src/features/<feature>/index.ts` の公開 API のみ利用
- Electron、URL、永続化、OS file dialog などの外部依存は Gateway / Controller / Hook に閉じ込める
- Storybook 対象は描画専用 `View` と `src/components/ui`。View は `window.electronAPI` を直接使用しない
- Atomic Design はアプリ全体のフォルダ規約ではなく、shared UI 設計時のメンタルモデルとしてのみ利用
- `src/design-system/` はfoundation / semantic tokenとMUI Themeの正本、`src/components/ui/` はprops-only shared patternの配置先
- UI変更は `check:design-system` とStorybook a11y/buildで検証する

## Electron 構成

### Main process

`electron/src/main.ts` は起動と各handler/windowの組み立てに集中します。実処理はドメインごとに分割します。

代表例:

- `electron/src/ipc/fileHandlers.ts`
- `electron/src/ipc/reportHandlers.ts`
- `electron/src/ipc/dashboardHandlers.ts`
- `electron/src/ipc/codeWindowHandlers.ts`
- `electron/src/ipc/exportHandlers.ts`
- `electron/src/ipc/llamaHandlers.ts`
- `electron/src/ipc/eventDetectionHandlers.ts`

Window runtime:

- `electron/src/analysisWindow.ts`
- `electron/src/codingPanelWindow.ts`
- `electron/src/playlistWindow.ts`
- `electron/src/timelineWindow.ts`
- `electron/src/settingsWindow.ts`
- `electron/src/exportProgressWindow.ts`

Packageを扱うWindowは `electron/src/packageSessionRegistry.ts` のPackage Sessionに所属する。Main Window、Timeline、Analysis、Coding Panel、Playlistはpackage単位で所有・IPC送信先を分離する。Settings、Help、Export Progressはapplication-globalとして扱う。OSからの `.stpkg` openはMain Processのキューで処理し、既存Sessionをfocusするか、空Sessionの再利用または新規Main Windowを選ぶ。

Main Window作成時にSessionを保持し、`closed` では破棄済みWindowから再検索せず、そのSessionの補助Windowを閉じて登録とパス予約を解放する。Registryのパス検索とsender検索も、所有Main Windowが破棄済みのSessionを返さない。同じファイルの再openと遅延IPCの両方で生存する所有者だけを扱う。

通常メニューの通知は`menuCommandDelivery.ts`へ集約し、BrowserWindowとWebContentsの両方の生存を確認する。WindowsでWebContentsが先に閉じる場合や送信直前の破棄も無視し、他のWindowへの通知を継続する。破棄以外のIPC例外は隠さない。

配布版はMainの外部npm依存を同梱しません。`build:electron-main`で未同梱依存を検査し、FFprobe応答などのMain側の入力は型ガードで検証します。Renderer/preloadのライブラリはbundle内で解決します。

ビルド時のproxy bootstrapは、@electron/get 3.1.0経由のglobal-agent 4.1.3へ限定して固定します。配布runtimeの依存構成は変更しません。[監査と互換性検証](adr/0058-build-downloads-without-response-cache.md#2026-10-10-proxy-dependency-audit-update)。

### Preload

映像書き出しメニューはPackage Sessionから対象Timelineを解決し、PlaylistではそのWindow自身へ通知します。Timelineを新規表示する場合、Reactの書き出し購読が準備できるまで要求をMainに保持します。`clip-export-ready`は型と送信元を検証してMainで消費し、映像側へ転送しません。[ADR 0042](adr/0042-document-owned-export-menu.md)。

`electron/src/preload.ts` は用途別bridgeを合成します。Renderer は `window.electronAPI` のみ使用し、`electron` / `ipcRenderer` を直接 import しません。

Mainの`packageOpenDelivery`は`isLoading()`がtrueの場合に`did-stop-loading`でパッケージ通知を送ります。`did-finish-load`直後もロード状態がtrueの期間があるため、次の`did-finish-load`を待ちません。閉じたWindow/WebContentsには通知しません。

起動時のパッケージ通知は `packageOpenBridge` がpreload開始時から受信します。画面が購読する前の最新1件をウィンドウ内で保持し、現在の購読者へ一度だけ渡します。画面の再購読で消費済みの通知を再生しません。Main側のパッケージ別ウィンドウ振り分けと既存の用途限定APIを維持します。[ADR 0045](adr/0045-buffer-startup-package-open.md)。

### ローカル編集と書き出しの検査

Timelineの分割・結合は`shared/timelineRangeEditing.ts`の純粋関数で全体を計算し、`useTimelineRangeEditing`が所有runtimeへ1回だけcommitする。独立Timelineは`split-item` / `merge-items` commandを送り、結果の選択IDも所有runtimeから同期する。文書形式・履歴の所有者は変えない。

書き出しは`exportPayloadValidation.ts`でIPCの型、`exportSourceSelection.ts`で使用映像、`exportPreflight.ts`でローカルファイルと保存先を確認する。仮想Timelineは`exportVirtualTimelineSource.ts`で構成を読み、全必要ファイルの確認後に要求範囲だけを準備する。`exportSourcePreparation`がインスタンス・アングルごとの範囲と進捗を管理し、`exportTimelineRange`の共通時刻から`exportTimelineComposition`が必要な合成を行う。`exportPreparedClipRenderer`が各インスタンス・アングルの素材と原点をFFmpeg実行層へ渡し、単画面・2画面とも同じ時計を保持する。`exportStreamCopy`がコーデック・時刻基準・切断境界を確認し、可能な場合だけ無再圧縮でコピーする。[ADR 0050](adr/0050-instance-scoped-export-preparation.md)。`exportHandlers.ts`は進捗と実行の組み立てを担当する。クラウド・追加runtime依存はない。

### Typed IPC

Rendererへ公開するIPC contractの正本は `src/renderer.d.ts` です。用途別のpayload型は `src/types/ipc/` などで定義し、公開APIから参照します。Main process は sender window と payload を検証し、preload も inbound payload を guard します。

共通sender guardは、生存するBrowserWindow/WebContents、呼出元mainFrame、`getRendererUrl()`のentry documentを照合します。hash routeだけを同じ文書とし、子frame・別のfile/data/http文書は許可しません。既存のexpected-window/session比較を重ね、Settingsも同じguardを使います。個別handlerと正規rendererからのpath操作は引き続き別途検証が必要です。[脅威モデルと範囲](adr/0070-renderer-document-and-frame-trust.md)。

## BrowserWindow セキュリティ

全 BrowserWindow で以下を適用します。

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- `window.open` を拒否
- 許可されないnavigationを拒否

rendererのtop-level navigationとmain-frame redirectはアプリのentry documentへ限定します。YouTube iframeの移動、MediaPipeのBlob/WASM資産、Mainが生成するpreloadなしのHelpは別の正規経路として維持します。Mainの明示的な`loadURL`はnavigation制限を通らないため、IPCでも文書/frameを検証します。

外部binaryはrendererから直接起動せず、main process配下のmanager/runner境界で管理します。

## パッケージ / 映像モデル

`.metadata/config.json` の `angles[] -> clips[]` を現行の映像構成正本とします。

- 最大8アングル
- 各アングル最大16クリップ
- local / YouTube source
- 各clipに `timelineStartSeconds`
- optional `durationSeconds`
- アングル単位の同期補正は `syncData.angleOffsets[]`

ローカル映像は元クリップを仮想timeline上で切り替えます。クリップ間空白は再生時に黒画面・無音で扱い、書き出し時だけ必要な一時合成を行います。

旧 `tightViewPath` / `wideViewPath` だけのpackageはロード時migrationで現行 `angles[].clips[]` へ吸収します。

## Playback authority と分離Timeline

Video.js player、再生時計、Timeline document、Undo/Redo履歴はメイン動画windowを唯一のauthorityとします。

複数クリップの時間通知callbackの更新は、映像プレイヤーのライフサイクルから分離します。画面の再描画中も映像の読み込みを継続します。

TimelineはPackage Sessionごとに1つの専用BrowserWindowです。

- packageを開いた時に自動表示
- 閉じた後は `ウィンドウ > タイムラインを表示` で再表示
- document/selection sync、高頻度clock sync、編集commandを別payloadにする
- Timeline window側のhotkey commandもmain video runtimeへ戻す

関連ADR: [0021 Detached Timeline and Playback Authority](adr/0021-detached-timeline-playback-authority.md)

## Timeline model

`timeline.json` の現行formatはversion 2です。

```text
TimelineDocument
├ rows[]
└ instances[]
```

- 行が名称・色・表示順を所有
- `TimelineData` は `actionName / startTime / endTime / memo / labels / color` と任意の `provenance`
- 旧 `actionType` / `actionResult` はロード時に `Type` / `Result` labelへmigration
- 保存は現行formatのみ

新規の検出候補は実resultのモデル・元候補情報と `reviewStatus: unreviewed` を保持します。欠落した旧データは由来・人確認が不明のままで、編集から確認済みへ昇格させません。元候補スコアと現在の編集区間を分け、結合では全出所と由来不明の混在を保持します。通常の場面検索の詳細で表示します。[保存・交換の範囲](event-detection.md#timeline変換)、[ADR 0069](adr/0069-timeline-detection-provenance.md)。

`NewTimelineData = Omit<TimelineData, 'id'>` を一括追加入力に使用します。`addTimelineDatas()` は複数eventを1回のstate updateで追加するため、自動Codingで多数eventを追加しても1回のUndoで戻せます。

タイムラインの行選択とインスタンス選択は操作対象を切り替える状態です。キー操作はタイムライン内に限定し、入力欄・ダイアログを除外します。行内全選択や範囲選択後はインスタンス選択へ切り替えます。操作コマンドは`useTimelineInstanceCommands`、行のメニュー／確認表示はprops-onlyの`TimelineRowActionsView`へ分離します。

## Code Window / Coding runtime

`.stcw` は独立ドキュメントとして扱います。コード／ラベル／編集モードは対象Code Window内で切り替え、アプリ全体のmodeにはしません。

Action buttonには `leadTimeSeconds` / `lagTimeSeconds` を保存できます。未設定は0秒です。Button clickとhotkey codingは同じ `resolveRecordingRange()` を通ります。

## 分析

分析windowの主要view:

- Dashboard
- Momentum
- Matrix
- AI Analysis

AI実行ファイルはOSとCPU種別ごとに検証して同梱します。モデル重みは別途指定します。AI Analysisはローカル `llama.cpp` を使い、Timeline / labels / memo / statistics を根拠として分析文と推奨clipを生成します。映像frameそのものをLLMへ解釈させる機能ではありません。

## 自動イベント検出

比較用model pack（schema 2）は `evaluationBasis: reference-coding` を必須とし、既存Codingとの一致・再検出として表示します。`verified`にはできず、schema 1の旧consumerはこのpackを読み込みません。評価表示はpropsだけを受け取る `EventDetectionModelEvaluationView` に分離しています。契約は [ADR 0034](adr/0034-reference-coding-model-evaluation.md) を参照してください。

自動イベント検出はLLM分析とは別のローカル映像処理です。SporTagLyticsは**配布済みmodel packを安全に実行するconsumer**であり、model training/evaluationは別private R&D repositoryの責務です。

目的は、通常Timelineを初期Codingして手動分析開始を早めることです。実作業では高Precisionな一部候補だけを出すのではなく、**実イベントをほぼすべて候補として出し、人間が不要候補を削除する**workflowを優先します。

Mainの `eventDetection/resultCache.ts` は正常終了した検出候補だけを有効期限付きで再利用します。映像・モデルのmetadataと解析条件で無効化し、ディスクへの追加保存は行いません。

### Renderer

`src/features/videoPlayer/eventDetection/`:

- `components/EventDetectionPanelView.tsx`: props-only View。model status、評価値、experimental warningを表示
- `hooks/useEventDetectionController.ts`: model/angle選択、confidence設定、実行、Timeline反映
- `gateway/eventDetectionGateway.ts`: `window.electronAPI.eventDetection` のみ使用し、model listをruntime guardで再検証
- `domain/eventDetectionMappings.ts`: event mapping、manifest初期threshold、ユーザー入力の正規化
- `domain/candidatesToTimeline.ts`: confidence filter、lead/lag、重複除外、Timeline変換

モデル一覧取得と初期mappingの生成は解析画面の初回表示に紐づけます。背景の映像・コードウィンドウ更新でフォームを再読み込みせず、ユーザーが入力した設定を保持します。

UIは `分析 > 自動イベント検出…` からSession別の独立ウィンドウを開きます。`useEventDetectionWindowHost`が所有元のsnapshotとコマンドを橋渡しし、`EventDetectionWindowScreen`が表示を合成します。Mainは`eventDetectionWindow.ts`で所有関係と送信元を検証します。終了・背景実行・再表示の契約は[ADR 0038](adr/0038-detached-event-detection-window.md)を参照してください。検出後のeventは通常 `TimelineData` になり、専用AI Timelineやreview queueは持ちません。

新規作成時のパッケージルートとクリップのパスは、mainが返したメタデータの実保存先から解決します。入力名とmainが補う拡張子の差をRendererへ持ち込みません。`electron/src/eventDetection/inputValidation.ts`で全入力ファイルの存在・種類・読み取り権限を確認し、失敗時はランナーや一時リクエストを作成する前に対象パス付きで通知します。

同一run内の重複候補はconfidence順で選び、採用後に時刻順へ並べます。既存Timelineの編集内容は優先して保持します。モデル側の精度比較は前処理・走査間隔・重複抑制・thresholdを固定した評価に基づきます。詳細は[検出精度の改善と評価](event-detection.md#検出精度の改善と評価)を参照してください。

持続する1プレーの区間判定はmodel runnerが所有し、既存の任意フィールド `detectedStartTime` / `detectedEndTime` で返します。Rendererはその区間にlead/lagを適用します。clip境界・信頼度の谷・最大長を使う判定と評価設定はmodel packへ固定し、手動Timelineの結合処理に置き換えません（[ADR 0036](adr/0036-event-episode-consolidation.md)）。

確認済み映像から学習する補正重みもmodel pack内に閉じ込めます。過去のTrain特徴を使って既存判定を保ち、補正後の区間判定と同一Codingイベントの保持を評価します。製品側のIPC・Timeline保存契約は共通です（[ADR 0037](adr/0037-reviewed-model-refinement.md)）。

クラスを限定した時間方向の補正もpack内で実行します。前後8秒の特徴を使う`reviewed-temporal`はスクラムを保持してリスタート・ラインアウトだけを補正し、特徴抽出は共用します。公開画像の比較結果と採用判断は[モデル改善の仕様](event-detection.md#前後の映像と公開画像を使う補正)を正本とします。

再学習では既存Codingの出典・時間軸と、追加Trainカメラの同期を確認します。メタデータ未記録をCoding不足とは扱いません。R&Dの比較用checkpoint、本体に採用したmodel pack、配布済みモデルの状態を区別し、Validation上の一致度改善だけで配布モデルを置き換えない運用です。

model statusは `verified | experimental` の2状態です。experimentalを選ぶと`試験` badge、誤検出・見逃しの警告、Recall / Precision / evaluated matches / baseline confidence thresholdを表示します。confidence thresholdは0.00〜1.00でrunごとに変更できます。

### Shared contracts

- `src/types/eventDetection/core.ts`
- `src/types/ipc/eventDetection.ts`
- `src/shared/eventDetection/modelQualityGate.ts`

初期対象event type:

- `restart`
- `scrum`
- `lineout`

`maul` / `goalKick` はshared contractには定義できますが、model packで独立に評価され、statusごとのeligibilityを満たした場合だけproduct UIへ出します。

### Electron / local runner

`electron/src/eventDetection/`:

- `modelDiscovery.ts`: model pack / manifest探索、status別eligibility、runner integrity検証
- `eventDetectionManager.ts`: runnable model解決
- `processRunner.ts`: child process実行
- `requestRegistry.ts`: cancel管理
- `types.ts`: internal manifest / runnable model型

Runner contract:

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

verified/experimental共通制約:

- `shell: false`
- finite timeout
- bounded stderr/result size
- cancel可能
- request/result temporary fileは完了後削除
- runner executableはmanifestのSHA-256と一致必須
- path traversal拒否
- main IPC sender/payload validation
- renderer gatewayでmodel metadata validation

ML runtime（ONNX Runtime等）はrunner内部の実装詳細として交換可能にし、rendererを特定ML frameworkへ直接依存させません。

### Status別 eligibility

`verified` model packはclass単位で最低限以下を満たす必要があります。experimental対応でこの基準は緩和しません。

- Recall >= 0.95
- unseen evaluation matches >= 5
- Precisionは0〜1の有限値として記録
- confidence thresholdは0〜1の有限値

`experimental`はverified gate通過扱いにせず、宣言eventごとのmetricsが有効で、current platform runnerが共通セキュリティ検証を通過した場合だけ別statusのまま利用可能にします。

高Recall operating pointでのfalse positives per match、処理時間、manual edit operations、手Coding比の作業時間削減はprivate R&D qualificationで確認します。秒単位の厳密なevent onsetは主目的ではありません。

### Model pack staging

`resources/event-detection-models/` はrelease/local build用の任意staging pointです。model pack本体は`.gitignore`で除外し、`electron-builder`が存在するpackだけを`event-detection-models`へ`extraResources`として配置します。stagingが空でも通常buildは成立します。

配布用packは`afterPack`で[由来記録と全ファイル](event-pack-provenance.md)を照合してからmacOS runner署名へ進みます。sidecarの配布判断はruntime manifest schema 1/2の品質statusから独立し、既存ローカルpackの実行条件は変えません。[ADR 0061](adr/0061-event-pack-distribution-provenance.md)。

詳細: [自動イベント検出](event-detection.md)、[ADR 0023](adr/0023-external-rugby-event-model-rd-boundary.md)、[ADR 0024](adr/0024-experimental-event-detection-production-lane.md)

## Event Model R&D boundary

SporTagLytics public repositoryには以下を置きません。

- 元動画 / `.stpkg` / Coding dataset
- dataset preparation / training / fine-tuning
- hard-negative mining
- model family比較
- threshold / NMS / stride探索
- held-out qualification
- private source diagnostics
- frames / checkpoints / runs
- deployable model binary / checkpoint

一般ユーザーPCごとの自動fine-tuningや暗黙のtraining data uploadも初期製品では行いません。

## Playlist / Clip export

Playlistは独立BrowserWindowで扱い、`.stpl` documentを正本とします。Timelineからの追加とAI Analysisからの追加は共通playlist APIを利用します。

パッケージ参照の`usePlaylistMediaTimeline`は有効なアングルの実時計を共通時刻へ変換してから他アングルを同期します。RAFは観測の契機であり、映像のある区間を独立に進める時計ではありません。`TimelineVideoAdapter`は確認済みの時計と画像のreadinessを分け、bufferingを逆シークに変えません。初期位置・アイテム切替・明示シーク・注釈の静止位置は画像の到達まで保留します。同じmetadataのfocus再検証は再生を止めません。

初回表示とreloadでは、Mainがclip追加と同期をWindowごとに保持します。Rendererは全item/sync listenerを登録した後に既存の`request-sync`を送信し、Mainは検証済みの送信元Windowの保留通知だけを送信順に届けます。文書ロード用の`playlist:ready`は外部ファイル購読の準備を表し、item listenerの準備とは分けます。[ADR 0059](adr/0059-playlist-renderer-delivery-readiness.md)。

「ファイル > 開く > プレイリスト…」はMainの`playlistWindow/fileOpen.ts`でネイティブ選択・文書検証を行い、既存のWindow管理へ渡します。IPCのロード操作も同じパッケージ選択を使います。メニュー要求を全Rendererへ配信せず、操作元のPackage Sessionと編集中の文書を保持します。

Clip exportは `src/shared/clipExport/` にpure service / contractを集約し、main processのFFmpeg runnerで実行します。進捗は専用export progress windowへ通知し、main app操作をblockしません。

Paint動画出力は、Rendererがクリップとの表示区間の交差とソース時刻の補間を計算し、アングルごとの描画を検証済みIPCへ渡します。Mainの単画面／2画面FFmpeg runnerが図形合成、芝色処理、静止挿入を行い、2画面は合成後に高さを揃えます。[Paint書き出し](tactics.md#映像への書き出し)を参照してください。

配布版FFmpeg/FFprobeは固定source/hashからbuildしたverified toolchainのみ利用し、main processでtimeout/output上限を適用します。WindowsのH.264はOS提供Media FoundationのCPU経路を使い、`windowsH264Capability.ts`が実フレームで不足を検出します。Windows NにはMedia Feature Packが必要です。[ADR 0062](adr/0062-windows-media-foundation-h264.md)。

## Persistence / migration

互換性は最新domain型へlegacy fieldを残すのではなくロード時migrationで吸収します。

- settings: `src/types/settings/normalizers.ts`
- coding panel: `src/types/settings/codingPanelNormalizers.ts`
- timeline labels: load-time migration
- package config: legacy media model migration

保存時は最新formatへ統一します。

## Quality gates

通常PRで必須:

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

GitHub Actions `quality-check` は `main` / `develop` / `feat**` 宛てpull requestで上記相当の検証を実行します。Model R&DのCIはprivate repository側で管理します。

## 開始画面・再生UI・Paintの境界

UIの正本は `src/design-system/` のsemantic tokenとprops-only Viewです。開始画面の構成は `VideoPathSelector`、開く操作の単一状態源は `useStartPackageOpen`、IPCとロード時移行は `packageGateway` に置きます。初回・履歴・検索・ロード・エラーは[起動画面の仕様](start-workspace.md)を参照してください。

パッケージ読込で自動表示するTimelineは`showInactive()`を使い、読込元の再生画面からフォーカスを奪いません。メニューなどの明示的なTimeline表示は従来どおり前面化します。ネイティブ窓名は「再生画面」「タイムライン」の役割を保ち、共通HTMLタイトルの再読込で同名になりません。補助窓からは`ウィンドウ > 再生画面を表示`で同じSessionの主画面へ戻れます。

`applicationWindowActivation.ts`はアプリ内のフォーカス変更時に表示中のウィンドウを`moveTop()`でまとめて前面へ移し、操作対象を最後に上げます。常時最前面や別ウィンドウへのfocusは使わず、非表示・最小化ウィンドウはその状態を保ちます。通知対象も表示状態を再確認し、閉じた後に遅れて届いたfocusで再表示しません。

TimelineのTabアクション巡回は選択と本体/タグのフォーカスを条件にし、ジャンプ先のDOMフォーカスも揃えます。入力・検索・通常コントロールとOSのTab組合せを守る範囲は[Timeline review](timeline-review.md)を正本とします。

`MovieTransportView` は再生・送りのcallbackとラベルだけを受け取り、メイン映像・Playlist・Paintから合成します。メイン映像のウィンドウ比率は[ADR 0030](adr/0030-video-window-aspect.md)、Playlistは自由リサイズです。Timelineはrulerと行でスクロール座標を共有し、再生線を1本描画します。初期行色はアクションボタンから引き継ぎ、既存行の色は行モデルが所有します。

Timelineの `useTimelineSeek` は上部つまみと時間目盛りが使用します。行内の通常クリック・区間作成はシークせず、修飾キーによる端の伸縮だけが共通時計へプレビュー時刻を通知します。区間の変更はlane hook内でプレビューし、確定時だけ永続化・履歴へ渡します。履歴のUndo/RedoはReactの描画待ちに依存せず保存対象を同期的に返します。明示的なジャンプと再生ホットキーは既存の経路を使います。空白クリックは選択IDとフォーカス枠を同時に解除し、範囲選択直後のclickでは選択結果を消さないよう抑止します。

端の編集対象は押下したインスタンスIDで決まり、選択IDに依存しません。操作中は対象を一時的に強調し、修飾キー付きのclickで既存の複数選択を変更しません。対象の削除や他経路からの時刻変更、Esc・blurで未確定の編集を取り消します。修飾キーは押下時に操作を決定し、途中で解除してもマウスの左ボタンを離すまで継続します。最後のmouseup座標を反映して確定し、直後のclickによる選択変更を抑止します。

Paintは同じ映像DOMとPlaylist履歴を使い、Window-onlyな選択・ツール・パネル状態と、保存する注釈を分離します。`useStudioEditor` は編集の合成、`useStudioGesture` は描画ジェスチャー、`useStudioKeyframes` は位置キーの選択・時刻編集を所有します。ViewはIPC・永続化・URLを参照しません。

描画ジェスチャーは開始時刻とpointer IDを保持し、明示的なシークのrevisionを再生時計と分離します。`useVideoFrameDrawing` は各映像のフレームcallbackから`mediaTime`を受け、その場でCanvasを更新します。再生時計のReact更新で表示中のフレーム位置を上書きせず、停止中は編集時刻を使います。保存する時刻・座標・キーフレームの形式は共通です。

追尾は独立デコーダーで解析し、成功時に自動適用、部分結果は明示的に適用/破棄します。開始後の編集を古い結果で上書きしません。表示図形と独立した追尾範囲の判断は[ADR 0031](adr/0031-tracking-target-selection.md)、保存契約は[ADR 0029](adr/0029-tactics-motion-and-plane-contract.md)です。

通常再生・編集・PNGで共通レンダラーを使用し、動画出力ではソース時刻上のmotion overlayとアングル別の芝色処理を静止挿入より前に合成します。[Paint仕様](tactics.md)に型・上限・実装入口を、[Playlist仕様](playlist-features.md)に文書・順序・Sessionをまとめます。

## Windowsの実行境界

[Windows版](windows.md)と[ADR 0033](adr/0033-windows-desktop-runtime.md)に従い、描画・保存・追尾は共通実装、OS差分はElectronの映像処理・縦横比・loopback音声とshared shortcutへ集約する。file URLはNodeの変換またはパス成分のエンコードを通し、Windowsドライブや予約文字を壊さない。

書き出し進捗ウィンドウは内容領域基準の初期サイズを持ち、Windowsのタイトルバーが加わっても完了時の「閉じる」を見切れさせません。

### Paintの俯瞰図

戦術盤は[Paintの保存契約](tactics.md#戦術盤と映像からの配置)に従うクリップ・アングル別メタデータです。Viewはpropsのみ、編集履歴はHook、動画の読取・同梱モデル実行・PNG保存はGatewayに分離します。認識は明示操作時の停止フレームだけを対象とし、サーバー・新しいIPC・クラウドAPIを追加しません。[ADR 0039](adr/0039-local-tactical-board.md)を参照してください。

分析窓の初期データは所有sessionでcacheし、Rendererの受信listener登録後のready requestで再送します。希望viewはopen前に確保し、実reloadでも同じ手順を使います。別sessionの要求は拒否し、Main終了時にcacheを除去します。[ADR0055](adr/0055-timeline-review-without-document-filtering.md)。

## OSSと配布物の境界

アプリのMITとモデル・学習データの公開範囲は[モデル台帳](model-distribution.md)、第三者codeの告知と対応sourceは[配布手順](third-party-distribution.md)を正本とします。既存のprivate R&D / public consumer分離は維持します。

## Macの公開境界

Releaseは既存Mac署名・公証認証をCI内で消費する手動workflowです。Mac単独ではWindows CIから独立し、両OSを選んだ場合は同一commit・同一runのWindows新規buildとインストール後検査も公開条件になります。署名前payloadと最終DMG内アプリを検査し、明示した公開runだけが新しいReleaseとHomebrewを更新します。Macのsource archiveは同梱する2 targetのmanifestに対応します。[ADR 0063](adr/0063-independent-macos-release.md)と[手順](../.github/RELEASE.md)を参照してください。

Macのelectron-builder publisherは`mac.publish: null`で明示的に無効化する。`--publish never`だけでは既存GH_TOKENから更新用`app-update.yml`が自動生成されるため、DMG出力そのもので署名前の同梱物検査を実行する。公開は検証後の既存`gh release create`工程だけで行い、同梱物の許可リストは緩めない。

移行先の選択・marker照合は`packageMigrationTargets`、端末内の保存先索引は`PackageMigrationIndex`へ分離する。録画MediaSourceの全体尺と近傍バッファ、保存完了EOSは別に管理する。[ADR 0065](adr/0065-unified-project-open.md) / [ADR 0066](adr/0066-capture-playback-bounds.md)。

パッケージopenの履歴列挙はWindow/requestに所属する専用progress/取消を持ち、reload・crash・close後の結果を採用しません。Sessionのbind/releaseも要求を照合します（[ADR 0072](adr/0072-cancellable-package-history-read.md)）。[再生用コピー基盤](playback-cache.md)はMain側policy/jobとprops-only Viewに分離し、単一の短尺MP4を対象に固定変換と停止中の再生切替へ接続しています。原本の保存形式は変更せず、自動変換・自動採用は行いません。長尺の実機効果は別途検証が必要です。

取消された履歴列挙のOS処理が残っている間は、同じ親pathへの再列挙を重ねません。バックアップ名の列挙と移行候補の型付き列挙は同じ所有権管理と待機取消を使います。再試行は古い結果を採用せず、処理終了後に新しく列挙します。候補選択後にも取消を照合し、更新開始前に止めます。既に始まった更新・復旧commitは中断しません。これはOSの列挙速度を改善する保証ではありません。再生用コピーの内容不一致はHW再生検査の前に拒否しますが、正常候補の全検証は維持します。

再生用コピーの保存adapterはアプリ専用領域に隔離し、原本・タグ時計・package保存形式を変えません。全体hash・proof結合・中断stagingを含む容量計算とatomic公開を一時ファイルで検査していますが、通常アプリの短尺生成/停止中再生切替へ接続しています。既存manifestは採用済み証明ではなく、再検証する候補として扱います。

再生用コピーの所有process runnerは停止要求と終了確認を分離し、終了未確認中はコピー準備をbusyに保ちます。通常再生・package保存形式・原本は変更しません。固定recipe/validator/IPCを短尺範囲へ接続しています。Mac主窓のnative音声選択をコピー/原本双方で復元し、読戻し不一致は採用を拒否します。成功artifactの実変換時間・全列/HW観測はMain内だけに保持します。

再生用コピーには明示的な保存済み候補の再検証を接続しています。生成・再利用は全時刻/音声validatorを共有し、生成は全尺HW、再利用は毎回新規の区間HW適合性を確認する。原本と候補の実hashを再照合してから停止中の選択ticketへ渡します。再利用は変換や既存readyの削除を行わず、長尺の高速な再利用は未実装です。

再生用コピーではstream field_order欠落時のdisplay scan仮分類をMainの有界decoded prefixへ分離しています。raw metadataは補完せず、全尺frame照合が終わるまで生成しません。長尺対応・実音声同期・物理scrubの確認をこの短尺判定で代替しません。

再生用コピーの全内容proofはMainメモとprivateな認証付き記録で最大8件を保持する。実bytes全hashとruntime一致を毎回確認し、再起動後は同一app.asarも照合する（[ADR 0075](adr/0075-persistent-complete-content-proofs.md)）。HW検査は生成full/再利用compatibilityを区別し、過去のHW成功を再利用しない。詳細は[再生用コピー](playback-cache.md#保存済みコピーの明示再利用)。

再生用コピーの候補digestは同じMain Job内の隣接検査だけで共有し、消費時のhandle/path照合とclose完了を必須とする。毎回の全hash、HW後と最終採用境界の確認、全内容proofのビルド/環境無効化は維持する。詳細は[候補digest引渡し](playback-cache.md#同じ要求内の候補digest引渡し)。

長尺の初回待ちを減らす区間方式は[ADR 0077](adr/0077-demand-driven-playback-ranges.md)で検討中。現段階は有界MP4構造検査だけで、区間生成・MSE・先読みは製品へ接続していない。全尺proofとbyte範囲を混同せず、既存の保存・原本時計・exportは維持する。

区間再生のRenderer側基盤は、source/Session寿命とseek要求寿命を分離し、video/URLごとのregistryから共通時計へreadinessを返す。停止中も必要区間を要求する。通常の再生用コピー採用は従来経路のままで、Mainの検証済み読込leaseとMSE切替への接続は未完了である。

区間キャッシュのMain基盤は、一回限りの検証ticketからSession専用の再読可能leaseへ引き換え、最大2 batchで生成と検証・供給を重ねる。現時点では通常UI・正式IPCへの接続、実再生の速度保証は未完了。設計と保証範囲は[ADR 0077](adr/0077-demand-driven-playback-ranges.md)を参照。

Apple標準再生はAVPlayerが読み出し・復号・音声・時計を所有し、AVPlayerItemVideoOutputの画像を既存DOM表示面へ渡します。Mainの文書/IPC/終了所有権と最大3画像の転送は保持し、独自FFmpeg復号・PCM窓・供給回復は削除します。[ADR 0080](adr/0080-apple-player-playback.md)と[仕様・適用範囲](native-playback.md)を参照してください。

逆方向キー解放時はRendererに最後の描画PTSを1個だけ保持し、本人操作の未完了要求だけをその画像へ収束させます。遅い旧画像をpreloadで除外しても、共通時計を要求値で進めることはありません。再生中核と画像queue上限は変更しません。

通常スクラブはAppleが選んだ近傍画像の実時刻を確認して確定し、コマ送り・明示時刻指定だけを厳密シークにします。タグ/保存時計は要求値でなく確認済み時刻です。相対入力は最新要求へ加算し、旧gestureは新sourceへ伝えません。

Native表示は既存PlayerSurface・overlay・全画面要素を共有します。非対応入力/操作と厳密な文書末尾は、実停止時計・process/pipe/GPU終了を確認した後に既存互換経路へ渡します。原本・保存形式は変えず、再生用コピー作成や方式選択を通常UIへ表示しません。

配布runtimeはDeveloper IDで検証したappと同teamの固定helper・receiverを照合します。資源欠落や署名不整合をunsignedへ降格させません。任意の診断は固定数値・ローカル保存に限定し、状態源や終了成功の代わりに使いません。

### Native export候補

対応する単一角度・合成なし区間は[条件付きApple passthrough](native-export.md)で再圧縮を避けます。合成・連結・未確認形式は既存経路を維持し、独立metadata検査と原本不変・非上書き公開を必要とします。確認済み音声選択をsourceごとに同期し、未確定選択や複数angleの競合を別sourceへ流用しません。
