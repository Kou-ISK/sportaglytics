Timelineの下部検索ドック・共通compactフォームの変更と検証限界は[compact density評価](reports/2026-10-compact-density.md)を参照してください。

`e2e-ux-review`は標準Electron runnerに登録し、Mac/Windowsの`test:e2e`でも実行します。単独の導線検証と、標準runner全18シナリオの結果は区別して報告します。

# Testing and Quality Gates

Timelineの検索・focus・連続レビューは`scripts/e2e-ux-review.mjs`を使用します。ローカル合成映像・24行240件で、読み取りによる文書不変、閉じた高さ、狭幅、取消、保存再開、分析メニューの初回同期、実Renderer reload後の240件/編集済みノート復旧を検証します。品質ゲートの成功だけを快適さの根拠とせず、[UX評価記録](reports/2026-10-ux-review.md)の画像・操作負担・制限も確認します。

同E2Eは初回Playlistの実Rendererロードを1.5秒遅延し、受信listenerの登録前に追加されたclipと編集済みノートが届くことを確認します。`playlistWindow/windowManager.test.ts`は初回の保留、送信順序、重複ready、reload、破棄済み/未知sender、Package Session別の配送を検証します。timeoutを延長して待ち時間への依存を隠さないでください。

`usePlaylistLoadDelivery.test.tsx`はreadを保留し、ロード後の追加FIFO・重複ID、編集中/既にdirtyのsnapshot拒否、ロードとsyncの世代、取消/破棄、Window間の分離、次のReact描画より前の行所属を確認します。`e2e-ux-review`から呼ぶ`e2e-playlist-load-delivery.mjs`は専用の合成`.stpl`のread結果だけを保留し、別observerで追加の到達を確認してからreadを解放します。初回ロードと実Renderer reloadの両方でdiskのclip・追加clip・ノートを検査し、本番writerと既存の受信listenerは置換しません。

ライブキャプチャの回帰は`node scripts/e2e-live-capture.mjs`で行います（事前にmedia:build / e2e:prepare）。USB模擬入力と合成HTTP配信の同時録画、過去レビュー中のコード保存、再接続時の空白、停止・複数区間の書き出しを検証します。実機別のドライバ・連係カメラ・RTSP配信は別途ハードウェア検証が必要です。

720pの模擬入力で録画画面と映像ウィンドウを隠し、Code Windowのクリック/ホットキーを混用して25秒間連続記録します。区間をまたいでもvideo要素が同一で、emptied・バッファ不足によるwaitingが発生せず映像時刻が進むことを確認します。共通時計への補正シーク中のwaitingは区別してログに残します。可変フレーム時刻の区間重複は保存時に補正し、書き出しと再オープンも検査します。

`CaptureMediaBuffer.test.ts`はreadを明示的に保留し、その間に追加された保存済みfragmentがread/append完了直後に次のtimerを待たず処理されること、複数更新の集約、同時readの禁止、dispose後の保留破棄を確認します。時計・seek・初回buffer量を変えてwaitingを隠さず、実Electronの非seek waiting=0の検査は引き続き必要です。

同回帰はSourceBufferの`updateend`も保留し、append完了前に次のread/appendを開始せず、完了後は追加のtimerを待たず最新fragmentを処理することを確認します。Main配送のunitでは正常reload後の一度だけのFIFO再配送とclosed Windowのregistry/配送queueの除去を確認します。

非seekのwaitingが起きた場合は、500msごとの映像時刻・buffer終端・入力別の保存済み秒数/区間数・Mainの保存済み終端をログに残します。生産側の遅延とRendererへのappend遅延を区別するための診断で、waiting=0の合否基準は維持します。TimelineのOption/Altコピーも固定400msではなく、保存されたJSONが3件になる条件を既存のbounded pollで待ち、件数・行名・色を厳密に検査します。

Playlist Sorterの操作と保存順は`pnpm run test:e2e:export-menu`に含みます。複数行の旧文書を読み、実UIでソートして再生・Undo/Redo・保存再読込を確認し、色の異なる合成映像のFFmpeg出力を復号して順序を検証します。Storybookの`Workspace/Playlist/Sorter`ではInteractive、Narrow、Emptyとdark/lightを確認します。

このドキュメントは SporTagLytics のテストと品質ゲート運用ガイドです。必須コマンドの正本は `AGENTS.md` です。

複数アングル同期の必須検証は[アングル同期仕様](angle-synchronization.md#実装と検証)を参照してください。`scripts/e2e-multi-clip-playback.mjs` は25/50fpsの架空映像で、アングルの連続操作、同期点、コマ送り、実ウィンドウ比率、Playlist/Paintの境界シーク、正負オフセットの出力画素・尺を確認します。`e2e-angle-sync-gaps.mjs`は30秒/10秒/5秒でタイムラインのつまみ操作、本数の異なる同期、途中の黒表示、再読込と出力画素を確認します。`e2e-angle-sync-multi.mjs`は3/4アングルと可変フレーム間隔を確認します。実試合の映像は不要です。

同シナリオは`e2e-multi-clip-coding.mjs`で、1本目、映像の切替をまたぐ区間、2本目、別ウィンドウのホットキー、アングル1の終了後に残るアングル2の区間をコーディングします。保存した`timeline.json`の開始・終了が共通時計と一致すること、および実Timelineにタグが表示されることを検証します。コードウィンドウの`onSync`はUIの単一購読用なので、テスト用の購読で置き換えず、表示中の記録状態を確認してください。

複数クリップE2Eの`e2e-playback-interactions.mjs`は、目盛りクリックと行クリックの区別、10倍を超えるピンチと時刻アンカー、停止中の右キー解除、6倍速での元動画境界通過とシーク回数を確認します。`timeline-rows`は未選択の端編集でも再生ヘッドが境界へ追従することを確認します。

`useTimelineViewport.gesture.test.ts`は1倍表示密度の整数スクロールを再現し、3回の連続拡大でも丸め誤差が累積しないことと、スクロール・ポインター移動・境界到達後のアンカー更新を確認します。

## パッケージ互換と保存保護

- `legacyPackageMigrationService.test.ts`: 旧配列・tight/wide・旧アングル・旧`.stpkg`、コピー検証、未知version、symlink、参照不在、再利用、衝突、権限・容量不足・コピー/rename中断、原本変化を検証する。
- `useTimelinePersistence.test.tsx` / `timelineValidation.test.ts`: 読込失敗・壊れたJSON・未知versionでwriteを0回に保ち、retry後の復旧、保存失敗時の変更保持と順序を確認する。
- `atomicTextFile.test.ts`: commit faultのEACCES/ENOSPC/EIO、symlink、read-only destination、同時writeと一時ファイルcleanupを確認する。
- `SportscodeImport/domain/*.test.ts` / Hook / `sportscodeImportService.test.ts`: 公式subsetの秒数・group・ノート・色/空行、未知構造拒否、明示映像・補正・取消・二重実行抑止、Main payload/hash・容量・範囲・完成rename失敗を検証する。Main unitのmedia作成/probeはmockなので実動画の証拠にしない。
- `node scripts/e2e-package-safety.mjs`: 実preload/Mainによるread-only旧形式コピーと再利用、未知/未来/native/映像不在拒否、Renderer read fault中の原本保持と両Window retry、書き込み中のUndo、読込失敗中のコードボタン/ホットキー、空文書への再読込後の正常なタグ付けと別processでの再開を確認する。実アプリのtext writerは置換せず、合成保存先のfs.renameへfaultを入れる。12同時write/80回JSON読取で部分ファイルが見えないことも確認する。
- `node scripts/e2e-sportscode-import.mjs`: 合成XML・合成動画で取消、実動画尺超過の拒否、秒数補正、コピー作成、タグ/ラベル/色/ノート/空行、原本bytes保持を本番IPC/probeで確認する。`actionType`/`Type`/`__proto__`/`constructor`などのgroupを含め、実Rendererでmemo編集・保存・新process再開を行いラベル保持を確認する。

- `node scripts/e2e-legacy-external.mjs`: パッケージ外のreadonly合成映像を絶対パスとfile URIで参照する旧フォルダを移行し、別コピーの実video要素で再生/seekと原本保持を確認する。

保存済みcaptureの16超clipは共通の50,000上限を使うunit負例/正例とlive-captureの再開で検証します。Playlistの途中JSONは既存export-menuの読取条件を維持し、metadata置換に同じatomic writerを使います。Windows renameの一時/恒久拒否はbounded retryの回帰を持ち、nativeの実置換で再確認します。Undoの故障注入はB/A両方のrename完了を待ってから判定し、別文書のempty retryは別package IDを使い、open-fileで作られる新sessionのMain/Timeline/コードパネルを取得し直します。対象read faultの到達と元sessionの文書不変も検査します。新processのTimeline同期へ通常listenerを追加し、既存subscriptionを置換せずに実メモリ中のlabelsを確認します。multi-clipの保存件数assertionは緩和せず、synthetic Main stderrの実filesystem errorを残します。

保存保護・XML・外部映像とTimeline UX/densityを両方含む統合候補は、通常22シナリオとWindowsインストール後17シナリオへ登録します。個別PRの成功と統合候補の成功はsource headとCI runを分けて記録します。実行前は`pnpm run e2e:prepare`とmedia toolsの準備が必要です。OSのファイル選択結果はstub化し、dialog optionsの目的別filterを検査します。Finder/Explorer picker自体、実外付けドライブ、電源断、全歴代版、Sportscode実機でのexportは別途検証が必要です。合成例には架空の名称だけを使用し、私的プロジェクトをCIへuploadしません。

## Required Quality Gate

`test:run` / `test:ci`は既存Vitestの後に`check:build-downloads`と同じNode検査も実行します。`scripts/tests/build-downloader.mjs`は実際のbuilder/get/got依存を読み、loopbackの合成bytesでダウンロード・checksum・ファイルキャッシュと通信の回帰を検証します。外部モデルやElectron GUIを起動しません。依存境界の判断は[ADR 0058](adr/0058-build-downloads-without-response-cache.md)に記録しています。

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
| `pnpm run test:run`                       | Vitest one-shot + build downloads |
| `pnpm run test:ci`                        | serialized Vitest + build downloads |
| `pnpm run check:build-downloads`          | build download and cache boundary |
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

`test:e2e:package-reopen`は、本物の`did-finish-load`コールバック内からOSのパッケージopenを発火し、ロード状態がまだtrueでも映像が表示されることを確認します。通常の起動タイミングに依存せず通知の競合を再現します。

`test:e2e:clip-sync`は最初に専用の非表示BrowserWindowを作り、実際のsandbox preloadへRenderer購読前のパッケージ通知を送信します。`scripts/e2e-package-open-buffer.mjs`で通知が一度だけ届き、購読し直しても再生されないことを確認します。package openを含むメイン画面の待機は生成順ではなくfile URLとrouteで識別します。

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

Package再openは実ファイルのドロップ、映像と補助Windowの終了、同じパスをOSから再openする流れを検証します。macOSではアプリを終了せずに起動画面へ戻り、履歴・drop・ファイル選択で繰り返し再openします。Timelineの端編集は未選択の状態で修飾キー付きのブラウザー入力を送信し、キーを先に離してからマウスを離し、保存された開始・終了時刻、境界へ追従する再生位置、選択維持まで確認します。

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

Timelineの伸縮は連続mousemove中に保存せず、mouseupで1回確定し、1回のUndo/Redoで範囲全体を復元することを確認します。Esc・blurでは未確定の範囲を元に戻します。修飾キーを先に離してもmouseupまで継続し、端編集中は再生ヘッドが境界へ追従します。Paintでは位置数値の空欄、Enter、Esc、未変更blurと、◆ドラッグのEsc取消を確認します。

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

戦術盤の準備は認識ボタンの有効状態で判定し、ページ全体の`networkidle`は使いません。HTTP(S)は全て遮断したまま、起動時だけの既知YouTube adapter scriptを正確なURLとrequest種別で区別します。それ以外の起動時要求と、認識開始後の全HTTP要求を失敗にし、未完了requestも診断ログへ残します。[Playwrightの待機契約](https://playwright.dev/docs/api/class-page#page-wait-for-load-state)。

`pnpm run test:e2e` はビルド後に `scripts/run-electron-e2e.mjs` で独立した15シナリオを順番に実行します。途中の失敗も収集して残りを検証し、1件でも失敗した場合は終了コード1を返します。各シナリオは専用の一時profileとpackageを破棄します。既に検証済みのapp/main/preloadを再利用する場合は `node scripts/run-electron-e2e.mjs` を使用できます。

## オーバーレイ書き出しの性能回帰

`e2e-export-fast.mjs`は離れた複数インスタンスで未選択区間を生成しないことをFFmpegのエンコード回数・出力尺・画素で確認します。`exportPreparedClipRenderer.test.ts`は同じIDの再登場、同じ物理ファイルの別時刻での再利用、主・副アングルの異なる原点を確認します。秒数と変更領域外のSSIMは[性能レポート](reports/2026-09-export-performance.md)の専用benchmarkで測定し、機種依存の速度をCI合否には使用しません。

Timelineのnative最小外寸は720×300です。Windowsの旧外寸260では実client高195pxとなり、32pxの行と操作を保持して検索とTimelineを同時表示できませんでした。旧260pxのresize要求は新最小外寸へ制限されます。短いclientでは外側余白を削り、32px footer・軸・完全1行と検索の完全1行を残し、一覧/詳細だけを内部スクロールします。検証は要求外寸・実外寸・innerHeightを別記し、外側scroll位置と実clientviewport内の行/ラベル全体を確認します。最小サイズで長時間のレビューが快適との保証はしません。

分析ready同期は`analysisWindow.test.ts`と`useAnalysisWindowController.test.tsx`で、窓作成前に送られた最新snapshot・listener後の受信・別session拒否を確認します。窓のdid-finish-loadとReact listenerの登録を同一視せず、native側でも実reloadを行います。

統合Macではreveal対象の下端がviewportを0.055px越えるnative負例を得たため、tagのscroll marginを4px確保して完全表示を検査します。Windows installedの行入替はUIの順序と実保存の順序を別々に待ち、固定400msを保存完了と扱いません。期待順序・件数・表示条件は緩和しません。
