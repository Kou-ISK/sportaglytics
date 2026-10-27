Timelineの下部検索ドック・共通compactフォームの変更と検証限界は[compact density評価](reports/2026-10-compact-density.md)を参照してください。

`e2e-ux-review`は標準Electron runnerに登録し、Mac/Windowsの`test:e2e`でも実行します。単独の導線検証と、標準runnerの全登録シナリオの結果は区別して報告します。

# Testing and Quality Gates

`scripts/e2e-timeline-close.mjs`は300msの自動保存待機内のClose（最初のstaging open前）、書込中の最新Undo、保存失敗後の再編集・再試行、2つの所有元のQuit取消と再試行を、実Main/preload/Renderer/atomic writerと別process再開で検査します。合成ファイルのrename保留・失敗と当該エラーダイアログの応答だけを注入し、保存IPCを置換しません。hook/unitでは同一tickの行補完、未知sender・古い応答、timeout、ライブ停止後の終了取消も検査します。Linuxコンテナで`DISPLAY=:91 E2E_CLOUD_LINUX=1`を明示した場合だけランチャーへ`--no-sandbox --disable-gpu`を追加します。この環境の成功をMac/Windows配布物やOS sandboxの検証と扱いません。

単一WindowのCloseでは所有元とTimelineの消滅、実ファイルの最終memoを明示的なQuitより前に確認します。macOSはWindowが0件でもprocessを残す既存仕様をassertし、その後の明示的なQuitも実process終了まで待ちます。Windows/Linuxは最後のWindowのCloseによるprocess終了を確認します。新processでの再読込、保存失敗時のClose/Quit取消と再試行は両経路で維持します。`macos-native-close.yml`は対象source変更のPRで同じ合成回帰をmacOS runner上で実行し、署名秘密情報や実試合データを使いません。正式Releaseの全E2E・署名・公証・配布物検査は別途必須です。

Timelineの検索・focus・連続レビューは`scripts/e2e-ux-review.mjs`を使用します。ローカル合成映像・24行240件で、読み取りによる文書不変、閉じた高さ、狭幅、取消、保存再開、分析メニューの初回同期、実Renderer reload後の240件/編集済みノート復旧を検証します。品質ゲートの成功だけを快適さの根拠とせず、[UX評価記録](reports/2026-10-ux-review.md)の画像・操作負担・制限も確認します。

同E2Eは初回Playlistの実Rendererロードを1.5秒遅延し、受信listenerの登録前に追加されたclipと編集済みノートが届くことを確認します。`playlistWindow/windowManager.test.ts`は初回の保留、送信順序、重複ready、reload、破棄済み/未知sender、Package Session別の配送を検証します。timeoutを延長して待ち時間への依存を隠さないでください。

`usePlaylistLoadDelivery.test.tsx`はreadを保留し、ロード後の追加FIFO・重複ID、編集中/既にdirtyのsnapshot拒否、ロードとsyncの世代、取消/破棄、Window間の分離、次のReact描画より前の行所属を確認します。`e2e-ux-review`から呼ぶ`e2e-playlist-load-delivery.mjs`は専用の合成`.stpl`のread結果だけを保留し、別observerで追加の到達を確認してからreadを解放します。初回ロードと実Renderer reloadの両方でdiskのclip・追加clip・ノートを検査し、本番writerと既存の受信listenerは置換しません。

同じpathの有効なロード中にexternal-openが重複した場合は同じ処理へ集約し、保留追加を別世代として失わないことも確認します。別path、syncで置き換えられた世代、破棄後のロードとは区別します。

`playlistWindow/documentIdentity.test.tsx`は実Main handler・preload bridge・Renderer hookと合成A/Bの実atomic writerを接続します。A→Bの要求がB→Aの順に完了してもSaveはBだけへ書き、Bロード中のA編集でsnapshotを拒否した場合はAだけへ書くこと、同文書のstale完了がdirtyとClose確認を消さないことを確認します。WindowとIPC transportは模擬です。未知/他Window/重複/reload後ticketの拒否も検査します。

同じ保存先・dirty・Close確認は`e2e-ux-review`内の`e2e-playlist-document-identity.mjs`でも合成A/Bで検査します。専用read結果のみを保留し、実Mainの完了ログを観測してから古い結果を評価します。既存UI、MainのfilePath/dirty、Ctrl/Cmd+Sによる実書込と他文書bytes、実Close dialog呼出しを検査します。dialogは当該Windowの「キャンセル」応答だけをstub化し、writerやIPC handlerは置換しません。

A/B競合用の動画は同じ合成clipをパッケージ外の専用ファイルへコピーします。パッケージ参照は初回のportable metadata解決でdirtyになる場合があるため、その変換を競合試験のclean前提へ混ぜません。接続unitにも実メディア参照handler/hookを含めて初期cleanを確認し、nativeのdirty=false/true・保存先・Closeのassertは維持します。パッケージ参照・移動・既定アングルは既存の専用回帰で検査します。

ライブキャプチャの回帰は`node scripts/e2e-live-capture.mjs`で行います（事前にmedia:build / e2e:prepare）。USB模擬入力と合成HTTP配信の同時録画、過去レビュー中のコード保存、再接続時の空白、停止・複数区間の書き出しを検証します。実機別のドライバ・連係カメラ・RTSP配信は別途ハードウェア検証が必要です。

720pの模擬入力で録画画面と映像ウィンドウを隠し、Code Windowのクリック/ホットキーを混用して25秒間連続記録します。区間をまたいでもvideo要素が同一で、emptied・バッファ不足によるwaitingが発生せず映像時刻が進むことを確認します。共通時計への補正シーク中のwaitingは区別してログに残します。可変フレーム時刻の区間重複は保存時に補正し、書き出しと再オープンも検査します。

`CaptureMediaBuffer.test.ts`はreadを明示的に保留し、その間に追加された保存済みfragmentがread/append完了直後に次のtimerを待たず処理されること、複数更新の集約、同時readの禁止、dispose後の保留破棄を確認します。時計・seek・初回buffer量を変えてwaitingを隠さず、実Electronの非seek waiting=0の検査は引き続き必要です。

同回帰はSourceBufferの`updateend`も保留し、append完了前に次のread/appendを開始せず、完了後は追加のtimerを待たず最新fragmentを処理することを確認します。Main配送のunitでは正常reload後の一度だけのFIFO再配送とclosed Windowのregistry/配送queueの除去を確認します。

非seekのwaitingが起きた場合は、500msごとの映像時刻・buffer終端・入力別の保存済み秒数/区間数・Mainの保存済み終端をログに残します。生産側の遅延とRendererへのappend遅延を区別するための診断で、waiting=0の合否基準は維持します。Timelineの貼り付けとOption/Altコピーは固定400msではなく、保存されたJSONがそれぞれ2件・3件になる条件を既存のbounded pollで待ち、件数・ID・行名・色・時刻を厳密に検査します。画面の件数が更新されても、300ms遅延と非同期の実保存が完了したとは扱いません。

Playlist Sorterの操作と保存順は`pnpm run test:e2e:export-menu`に含みます。複数行の旧文書を読み、実UIでソートして再生・Undo/Redo・保存再読込を確認し、色の異なる合成映像のFFmpeg出力を復号して順序を検証します。Storybookの`Workspace/Playlist/Sorter`ではInteractive、Narrow、Emptyとdark/lightを確認します。

このドキュメントは SporTagLytics のテストと品質ゲート運用ガイドです。必須コマンドの正本は `AGENTS.md` です。

複数アングル同期の必須検証は[アングル同期仕様](angle-synchronization.md#実装と検証)を参照してください。`scripts/e2e-multi-clip-playback.mjs` は25/50fpsの架空映像で、アングルの連続操作、同期点、コマ送り、実ウィンドウ比率、Playlist/Paintの境界シーク、正負オフセットの出力画素・尺を確認します。`e2e-angle-sync-gaps.mjs`は30秒/10秒/5秒でタイムラインのつまみ操作、本数の異なる同期、途中の黒表示、再読込と出力画素を確認します。`e2e-angle-sync-multi.mjs`は3/4アングルと可変フレーム間隔を確認します。実試合の映像は不要です。アングル同期プレビューでもデコード中のseekを中断せず、未到達の同じ停止要求を繰り返さない。新しい時刻・元動画・再生から停止への変更は適用し、到達済みの位置が読み込みで戻された場合は再補正する。非ゼロ先頭PTSと遅延通知はHook試験と3/4アングルE2Eで確認する。

同シナリオは`e2e-multi-clip-coding.mjs`で、1本目、映像の切替をまたぐ区間、2本目、別ウィンドウのホットキー、アングル1の終了後に残るアングル2の区間をコーディングします。保存した`timeline.json`の開始・終了が共通時計と一致すること、および実Timelineにタグが表示されることを検証します。コードウィンドウの`onSync`はUIの単一購読用なので、テスト用の購読で置き換えず、表示中の記録状態を確認してください。

複数クリップE2Eの`e2e-playback-interactions.mjs`は、目盛りクリックと行クリックの区別、10倍を超えるピンチと時刻アンカー、停止中の右キー解除、6倍速での元動画境界通過とシーク回数を確認します。`timeline-rows`は未選択の端編集でも再生ヘッドが境界へ追従することを確認します。

`useTimelineViewport.gesture.test.ts`は1倍表示密度の整数スクロールを再現し、3回の連続拡大でも丸め誤差が累積しないことと、スクロール・ポインター移動・境界到達後のアンカー更新を確認します。

`e2e-angle-sync-multi.mjs`は非ゼロ開始PTSの映像が停止状態でデコードを終えること、通常Timelineとアングル同期ボタンの表示を確認してから、映像ウィンドウへフォーカスしてCmd/Ctrl+Shift+Tを送ります。最初のvideo要素の表示だけではデコードや別ウィンドウの起動完了を保証できません。フォーカス・3/4画面・同期点・可変フレーム・保存結果の検証と既存の待機上限は維持し、失敗時はアングル数・工程・実際の操作対象ページと各native windowのURL/フォーカスを記録します。成功・失敗画像は`E2E_SCREENSHOT_DIR`へ保存し、Windows CIのartifactにも含めます。`useMediaTimeSync.test.tsx`は要求位置を最初のフレームへ補正するデコーダーを再現し、停止中の同じ要求でseeked/canplayが再シークを繰り返さないこと、位置変更・読み直しでは再要求できることを確認します。到達済みの停止位置が読み込み処理で後から0秒へ戻された場合にも、元の位置を復元する回帰を検査します。

## パッケージ互換と保存保護

- `packageBackupRestoration.test.ts`: 索引付き旧コピーと隣接退避文書が残る復元、取消、第二世代復元、明示的な退避文書選択、復元後の保存・再読込、壊れた記録・symlinkの拒否、親フォルダごとの移動を検証する。
- `packageHistoryDirectory.test.ts`: 反復取消中の同一親pathのOS読込上限、名前と型付き列挙間の直列化、待機中の取消、遅い成功/失敗の消費、再試行時の新しい履歴と別親pathの独立性を検証する。
- `packageMigrationCancellation.test.ts`: 現行・旧形式の移行候補探索を保留し、OS読み取りの完了前に取消を返すこと、選択・更新を開始しないこと、原本不変、遅い失敗後に新規候補を発見すること、選択中の所有元失効を検証する。
- `legacyPackageMigrationService.test.ts`: 同名更新、全内容バックアップ、編集コピー採用・分岐・移動、権限・容量不足、同サイズ破損、同時編集、rollback失敗、PID再利用、journal破損を検証する。`legacyPackageCopyService.test.ts`は0.17.9互換コピーと既知形式変換の回帰を維持する。
- `useTimelinePersistence.test.tsx` / `timelineValidation.test.ts`: 読込失敗・壊れたJSON・未知versionでwriteを0回に保ち、retry後の復旧、保存失敗時の変更保持と順序を確認する。
- `atomicTextFile.test.ts`: commit faultのEACCES/ENOSPC/EIO、symlink、read-only destination、同時writeと一時ファイルcleanupを確認する。
- `SportscodeImport/domain/*.test.ts` / Hook / `sportscodeImportService.test.ts`: 公式subsetの秒数・group・ノート・色/空行、未知構造拒否、明示映像・補正・取消・二重実行抑止、Main payload/hash・容量・範囲・完成rename失敗を検証する。Main unitのmedia作成/probeはmockなので実動画の証拠にしない。
- `node scripts/e2e-package-safety.mjs`: 実preload/Mainによるread-only原本の拒否・同名更新・バックアップ保持・再実行、未知/未来/native/映像不在拒否、Renderer read fault中の原本保持と両Window retry、書き込み中のUndo、読込失敗中のコードボタン/ホットキー、空文書への再読込後の正常なタグ付けと別processでの再開を確認する。実アプリのtext writerは置換せず、合成保存先のfs.renameへfaultを入れる。12同時write/80回JSON読取で部分ファイルが見えないことも確認する。
- `node scripts/e2e-sportscode-import.mjs`: 合成XML・合成動画で取消、実動画尺超過の拒否、秒数補正、コピー作成、タグ/ラベル/色/ノート/空行、原本bytes保持を本番IPC/probeで確認する。`actionType`/`Type`/`__proto__`/`constructor`などのgroupを含め、実Rendererでmemo編集・保存・新process再開を行いラベル保持を確認する。

- `node scripts/e2e-legacy-external.mjs`: パッケージ外のreadonly合成映像を絶対パスとfile URIで参照する旧フォルダを移行し、同名更新後のTimelineシーク経路と再生・停止ボタンで実video要素の位置・進行・停止と原本保持を確認する。再生状態と時計はアプリのcontrollerを通し、動画要素への直接play/pauseと競合させない。

保存済みcaptureの16超clipは共通の50,000上限を使うunit負例/正例とlive-captureの再開で検証します。Playlistの途中JSONは既存export-menuの読取条件を維持し、metadata置換に同じatomic writerを使います。Windows renameの一時/恒久拒否はbounded retryの回帰を持ち、nativeの実置換で再確認します。Undoの故障注入はB/A両方のrename完了を待ってから判定し、別文書のempty retryは別package IDを使い、open-fileで作られる新sessionのMain/Timeline/コードパネルを取得し直します。対象read faultの到達と元sessionの文書不変も検査します。新processのTimeline同期へ通常listenerを追加し、既存subscriptionを置換せずに実メモリ中のlabelsを確認します。multi-clipの保存件数assertionは緩和せず、synthetic Main stderrの実filesystem errorを残します。

保存保護・XML・外部映像とTimeline UX/densityを両方含む統合候補は、通常runnerとWindowsインストール後runnerの全登録シナリオへ登録します。個別PRの成功と統合候補の成功はsource headとCI runを分けて記録します。実行前は`pnpm run e2e:prepare`とmedia toolsの準備が必要です。OSのファイル選択結果はstub化し、dialog optionsの目的別filterを検査します。Finder/Explorer picker自体、実外付けドライブ、電源断、全歴代版、Sportscode実機でのexportは別途検証が必要です。合成例には架空の名称だけを使用し、私的プロジェクトをCIへuploadしません。

`e2e-unified-open.mjs`は0.17.9の別保存先と索引を生成し、編集済みコピーの採用、元パスでの再生、別プロセスでの再開、単一バックアップを検査します。さらに現在の文書を退避して原本を復元し、復元内容の選択、再生、実Rendererの編集・同名保存、4回目の新processでの再読込と両編集コピーの全バイト保持を確認します。`E2E_NATIVE_RESTORATION=1`では復元時のOS確認をstubせず実画面操作用に待機します。同シナリオ内の`e2e-package-update-crash.mjs`はbuild済みMain serviceを子Nodeプロセスで実行し、作業領域作成からバックアップ確定まで9か所でprocessを終了して、新processで復旧と全バイト一致を検査します。インストール後実行でもcrash helper自体はworkspaceのbuild済みserviceを使い、GUIは実インストールアプリを検査する点を区別します。電源断試験ではありません。

## 公開合成サンプルと限定負荷測定

`pnpm run test:sample`はPython 3とlibx264付きFFmpeg/FFprobeを使い、配布ZIPの全hash・相対パス・MIT告知・20秒H.264の全フレーム復号、同じencoderでの連続生成一致、既存出力の上書き拒否を検査します。Ubuntu quality-checkでPythonとFFmpegを明示的に準備して実行します。通常のアプリはPythonを必要としません。

`pnpm run test:e2e:sample`は公開ZIPを展開し、実Open UI、コピーによるタグ追加、時刻・ノート編集、実disk保存、別プロセス再開、選択した3秒のMP4を確認します。OS pickerの返答だけを模擬し、writer/exportは置き換えません。標準runnerとWindowsインストール後runnerの両方に登録し、対応CIではPython 3を用意します。保存完了後に終了するため、終了直前のflush/ack・失敗時終了取消の回帰を代替しません。[手順とLinux検証範囲](quickstart.md)。

`test:run` / `test:ci`は`scripts/tests/synthetic-timeline-workload.mjs`も実行します。件数・時間の境界、ID/行の整合、入力不変、nearest-rank集計を確認します。`scripts/tests/benchmark-module-loader.mjs`は実ソースのコンパイル、既存入力の不変、実atomic保存、型エラー時の停止・一時出力削除を確認します。ネストした拡張子なしruntime importは常に合成graphで検査します。F05の由来情報が実装されているsource graphでは不正な確認状態/型の拒否も検査し、未実装branchではその追加subtestだけを理由付きskipとして表示します。性能値は合否条件にしません。`pnpm run benchmark:timeline`の再現手順と実行条件は[限定負荷測定](synthetic-workloads.md)を参照してください。

## Required Quality Gate

`test:native-runtime`の`ReplyQueue.test.cpp`は実Mach portで返信10通のFIFO・peer照合・11通目の上限拒否・無効port設定失敗を確認します。映像は使わず、画像保持上限を増やしません。既存の数値診断回帰では返信エラーの固定分類と未知文字列の非保存を確認します。

`scripts/tests/macos-release.mjs`の公開検証要約テストは、source/version/archの不一致、改変DMG/installer、未知のWindows署名状態、未公証・未staple・Gatekeeper拒否、余分なassetとraw診断情報の除外を合成reportで検査します。CLI試験は一時git repositoryと合成bytesを使い、実hash照合・既存要約の上書き拒否・改変候補での未出力を確認します。ファイル名にmacosを含みますが、この検査はLinux/Windowsでも動くNode試験で、実署名・公証・E2Eを代替しません。既存の`test:run` / `test:ci`が同ファイルを登録済みのため、限定検査も両コマンドに含まれます。

`test:run` / `test:ci`は既存Vitestの後に`check:build-downloads`と同じNode検査も実行します。`scripts/tests/build-downloader.mjs`は実際のbuilder/get/got依存を読み、loopbackの合成bytesでダウンロード・checksum・ファイルキャッシュと通信の回帰を検証します。外部モデルやElectron GUIを起動しません。依存境界の判断は[ADR 0058](adr/0058-build-downloads-without-response-cache.md)に記録しています。

PR前の共通ゲートは以下です。コマンドの定義は `package.json` を正本とします。

```bash
pnpm run typecheck
pnpm run typecheck:electron
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

UI変更時はdesign-systemとStorybookを含む以下の全体検証を実行します。ADR変更時には単独でも `pnpm run check:adr` を実行してください。

```bash
pnpm run verify
```

| Command                                                      | Purpose                                                        |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| `pnpm run typecheck` / `typecheck:electron`                  | renderer/shared とElectron main/preload TypeScript             |
| `pnpm run lint`                                              | ESLint zero warnings                                           |
| `pnpm run check:architecture`                                | Feature-First / Electron boundary                              |
| `pnpm run check:design-system`                               | semantic token / UI境界                                        |
| `pnpm run check:adr`                                         | ADR filename/index consistency                                 |
| `pnpm run test:run`                                          | Vitest one-shot + build download / distribution notice tests   |
| `pnpm run test:ci`                                           | 同じ検査をVitest file並列なしで実行                            |
| `pnpm run verify`                                            | 共通ゲート + design-system / ADR + app build / Storybook build |
| `pnpm run licenses:sources`                                  | 公開された固定media sourceの取得・対応source archive準備       |
| `pnpm run check:build-downloads`                             | build download and cache boundary                              |
| `pnpm run check:preload`                                     | preload bundle sanity                                          |
| `pnpm run report:architecture-health` / `report:large-files` | architecture / soft file-size report                           |

GitHub Actions [quality-check](../.github/workflows/formatting_code.yml) は `main` / `develop` / `feat**` 宛てpull requestで、Node 22.12.0 / pnpm 9.1.0のfrozen install、lint、renderer/electron typecheck、architecture、design-system、ADR、`test:ci`、`licenses:sources`、Storybook buildを実行します。`verify` とCIの工程は完全には同じでなく、いずれもOS別の実Electron E2E・署名・公証・installer検査を代替しません。

実行環境、コマンド、結果、未実施の範囲と理由をPRに記載します。必要な検査が環境制限で実行できない場合は合格と扱わず、merge前にCIまたは対応OSで確認します。初回build/Storybookの `vision:prepare` と `licenses:sources` は公開資産のネットワーク取得を伴います。Model training/evaluationのCIは別private R&D repositoryの責務で、公開ソースの検査にその認証・映像・重みを要求しません。

## Test Placement

Mac専用cacheの実ファイル保護（`cacheApplicationIdentity`、`cacheContentProofs`、`cacheIdentityHandoff`、`cacheProofStore`、`cacheRangeReadLease`、`cacheReusePipeline`、`cacheStorage`、`sourceIdentity`）はPOSIX descriptor・所有者・modeの契約をMac/Linuxで検査します。Windowsではこの実FS検査を適用せず、純粋なproof・audit上限・偽造ticket検査は残します。`cachePlatformCompatibility.test.ts`とnative起動試験で、非対応OSではhelper解決前の拒否とproofの非保存・非採用を実際に確認します。[NodeのWindows file mode/flag制限](https://nodejs.org/docs/latest-v22.x/api/fs.html#file-system-flags)を理由に製品の所有者・revision検査を緩めません。Windowsの通常UI・IPC・installer E2Eは引き続き必須です。

`test:native-runtime`はApple再生経路の有限pipe出力・切断、Mach返信queueと所有processのdrainを検査します。`PlayerObservation.test.cpp`は停止・速度変更の途中でtimebaseが変わる条件でも、1回の読み取りから整合したphase/rateを作り、旧速度を新しい操作の確定として通知しないことを確認します。未対応media/controlの明示通知と正常drain後の復帰は既存Session/Controller回帰と接続して確認します。実表示・可聴同期はこれらの純粋回帰だけでは合格と扱いません。

`nativeEndpointRecovery.integration.test.tsx` は実SyncedVideoPlayer・NativeSurfaceController・復帰controllerと合成media portを接続し、末尾commit中にsurfaceが破棄されないこと、原本時計・音声選択を維持してHTMLへ戻ることを検査します。`nativeOriginalRecovery.test.ts`、`cachePlayerSwitch.test.ts`、`cachePlayerSeekTarget.test.ts` は読込済み/未読込の末尾量子化、適格source終端とHTML終端の微小差、画像ready待機、不正/範囲外時刻の拒否を検査します。gateway回帰ではMain資格の終端が復帰へ渡り、共通時計を変更せずHTML所有権を解放することも確認します。media portは合成であり、実HTML復号・表示の確認は別途必要です。

すべてのfixture・検証ログ・スクリーンショットは [公開時のデータ取り扱い](privacy-and-data-handling.md#sharing-and-issue-reports) に従います。実データでのみ確認できる検証はローカルで行い、公開する再現例には架空の識別情報と合成データを使います。

- pure domain logic → 同ディレクトリの `*.test.ts`
- React behavior → `*.test.tsx`
- shared contract / normalizer → contract近傍のtest
- Electron menu/manager pure behavior → `electron/src/**.test.ts`
- real BrowserWindow / file association / preload bundling → E2E

Heavy model weightやtraining frameworkをSporTagLytics unit testで取得しません。Public repositoryではmodel pack consumer boundaryだけをtestします。

## Settings / Timeline / IPC

TimelineのTab回帰は`useTimelineGlobalShortcuts.test.tsx`で開始時刻順の前後巡回、折り返し、DOMフォーカス、未選択/無効選択、入力/通常コントロール/ダイアログ、IME、Cmd/Ctrl/Alt+Tabの除外を確認します。`node scripts/e2e-ux-review.mjs`は合成240件と映像を使い、Tab/Shift+Tabの選択・フォーカス・実映像シーク、Option/Alt別名、Escape後と検索入力中の通常Tab移動、文書を変更しないことを検証します。通常アプリのプロファイルや実試合データを使いません。

Settingsやmigrationでは新fieldの保存読込、legacy default、invalid value正規化を検証します。Code Windowの `leadTimeSeconds` / `lagTimeSeconds` は未設定時0秒相当を維持します。

Timeline変更ではrange normalization、row ownership、history/Undo単位、duplicate/copy semanticsを検証します。自動Codingは `addTimelineDatas()` の1 state updateで追加するため、一括Undoを前提にします。

検出由来の変更では `src/types/timeline/provenance.test.ts` と `src/types/ipc/timelineProvenance.test.ts` でスコア/時刻の数値境界、空ID、不正状態、IPCを検査します。`timelineDocument.test.ts` は旧配列/v2を由来不明のまま維持し、保存再開で新しい元情報を保持することを確認します。domain/controllerでは不正な由来を持つ候補の一括追加を拒否し、終了時の編集凍結による追加拒否を成功と報告しないことと、明示再試行を検査します。分割・結合・コピー・Undo/Redoでは出所と未知部分を維持します。`Workspace/Timeline/Provenance` storiesはprops-only表示です。`e2e-event-detection.mjs` の決定的stubは実ファイルの由来保存・別プロセス再開後のメモリ内由来・詳細のキーボード展開を確認しますが、モデル精度や人確認の正しさの試験ではありません。

IPC / preload変更ではpayload guard、sender validation、explicit API、listener cleanup、invalid result rejectionを確認します。

文書/frame境界は`windowSecurity.test.ts`と`windowSenderGuards.test.ts`に加え、`node scripts/e2e-window-security.mjs`で実preload/Mainまで検査します。合成ファイルを使い、正規画面の読み書き・Settings・生成Help、別HTMLと同じアプリURLを読む子frameからの読み書き拒否、top-level navigation/window.open拒否を確認します。子frameへpreloadを届ける`nodeIntegrationInSubFrames: true`は試験用probeだけに指定し、本番BrowserWindow設定は変えません。通常runnerとWindowsインストール後runnerの両方へ登録します。YouTube/MediaPipe/live captureの全動作はこの限定試験だけで保証せず、既存のclip-sync/paint/live-capture等の回帰を併用します。[設計・残る境界](adr/0070-renderer-document-and-frame-trust.md)。

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

Package再openは実ファイルのドロップ、映像と補助Windowの終了、同じパスをOSから再openする流れを検証します。reload直後のOS open試験では、進捗通知で観測した所有request IDでSessionを解放し、成功を確認してからreloadします。request IDなしの拒否を無視して読み込み完了待ちの検証へ進まないでください。macOSではアプリを終了せずに起動画面へ戻り、履歴・drop・ファイル選択で繰り返し再openします。Timelineの端編集は未選択の状態で修飾キー付きのブラウザー入力を送信し、キーを先に離してからマウスを離し、保存された開始・終了時刻、境界へ追従する再生位置、選択維持まで確認します。

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

戦術盤の準備は認識ボタンの有効状態で判定し、ページ全体の`networkidle`は使いません。`electron.launch`後に全HTTP(S)を遮断するrouteを設置し、観測できた起動時YouTube adapter scriptを正確なURLとrequest種別で区別します。それ以外の観測した起動時要求と認識開始後の全HTTP要求を失敗にし、未完了requestも診断ログへ残します。初回起動全体の完全なofflineを証明する試験ではなく、route設置後の認識が同梱モデルで成功し、認識開始後のHTTP要求が0件であることを検証します。[Playwrightの待機契約](https://playwright.dev/docs/api/class-page#page-wait-for-load-state)。

起動時scriptの分類は`https://www.youtube.com/iframe_api`と、その実行で既にロードされた同URLのscript sourceに変数の初期値に単独の文字列リテラルとして宣言されたwidgetに限定します。[Windows run39791130218](https://github.com/Kou-ISK/sportaglytics/actions/runs/39791130218)ではwidgetの版が`55de7e60`に変わり、有限版リストとの不一致でインストール後E2Eが失敗しました。版一覧を追加し続ける代わりに、CDPで取得したsourceを既存TypeScript parserで実行せず解析し、`https://www.youtube.com/s/player/<小文字16進8桁>/www-widgetapi.vflset/www-widgetapi.js`という完全な形の宣言だけを抽出します。request側も同じ形と、その回の抽出URLへの完全一致を要求します。別origin・port・userinfo・path・query・fragmentを認めず、コメント、文字列内のコード、template、連結文字列、構文エラーは証拠にしません。旧版の宣言で新版を分類することもありません。CDPのsource SHA256と宣言URLをログに残し、同じ実行で証明できない要求は引き続き失敗します。この診断はURLを追加取得せず、HTTP遮断routeと認識開始後の全HTTP要求の拒否を維持します。これは起動時の通信試行の分類であり、通信を許可する処理ではありません。`e2e-tactical-startup-http.test.mjs`は版の変化、証拠の不一致、不正URL、非リテラル、phase/type、CDP失敗時のcleanupを検査します。

アプリはYouTube映像のtechを使用するため`useVideoJsInitialization.ts`でvideojs-youtube@3.0.1をimportします。その依存はmodule読込時にiframe_apiを要求します。ローカル戦術盤の合成MP4にはYouTube techが不要であり、ここでの分類は既存の起動副作用の範囲を示すものです。人物認識の必要な外部通信として扱いません。

`pnpm run test:e2e` はビルド後に `scripts/run-electron-e2e.mjs` で登録された独立シナリオを順番に実行します。途中の失敗も収集して残りを検証し、1件でも失敗した場合は終了コード1を返します。各シナリオは専用の一時profileとpackageを破棄します。既に検証済みのapp/main/preloadを再利用する場合は `node scripts/run-electron-e2e.mjs` を使用できます。

## オーバーレイ書き出しの性能回帰

`e2e-export-fast.mjs`は離れた複数インスタンスで未選択区間を生成しないことをFFmpegのエンコード回数・出力尺・画素で確認します。`exportPreparedClipRenderer.test.ts`は同じIDの再登場、同じ物理ファイルの別時刻での再利用、主・副アングルの異なる原点を確認します。秒数と変更領域外のSSIMは[性能レポート](reports/2026-09-export-performance.md)の専用benchmarkで測定し、機種依存の速度をCI合否には使用しません。

Timelineのnative最小外寸は720×300です。Windowsの旧外寸260では実client高195pxとなり、32pxの行と操作を保持して検索とTimelineを同時表示できませんでした。旧260pxのresize要求は新最小外寸へ制限されます。短いclientでは外側余白を削り、32px footer・軸・完全1行と検索の完全1行を残し、一覧/詳細だけを内部スクロールします。検証は要求外寸・実外寸・innerHeightを別記し、外側scroll位置と実clientviewport内の行/ラベル全体を確認します。最小サイズで長時間のレビューが快適との保証はしません。

分析ready同期は`analysisWindow.test.ts`と`useAnalysisWindowController.test.tsx`で、窓作成前に送られた最新snapshot・listener後の受信・別session拒否を確認します。窓のdid-finish-loadとReact listenerの登録を同一視せず、native側でも実reloadを行います。

統合Macではreveal対象の下端がviewportを0.055px越えるnative負例を得たため、tagのscroll marginを4px確保して完全表示を検査します。Windows installedの行入替はUIの順序と実保存の順序を別々に待ち、固定400msを保存完了と扱いません。期待順序・件数・表示条件は緩和しません。

## 第三者告知の検証

`node --test scripts/tests/distribution-notices.mjs`で告知本文・NOTICEの保持、未使用依存の除外、本文欠落時の失敗、配布sourceとbinary manifestの不一致拒否を確認します。通常の`test:run` / `test:ci`にも含みます。directory packageのResources/ASAR検査と各OS検証の境界は[配布手順](third-party-distribution.md)を参照してください。

`node --test scripts/tests/event-pack-provenance.mjs`は合成packだけで、由来・レビュー・利用条件の欠落、未申告ファイル、重み/runner/告知の改変、path境界、署名前の停止、署名後hashと署名前証拠の分離を検査します。`test:run` / `test:ci`に含まれます。モデルなしのdirectory packageも維持し、実packの権利確認やmacOS署名・公証はこの試験と区別します。

`node --test scripts/tests/windows-distribution.mjs`は合成ASARと非実行binaryで、installed NOTICE/inventory/資産/model/WASM/compiler告知の欠落・改変、GGUF/event pack混入、path逸脱、署名reportの欠落・hash不一致・異常状態を拒否することを検査します。`test:run` / `test:ci`に含みます。署名状態はunitでは模擬値であり、実Authenticodeとinstaller bytesの検査は[Windows CIの配布report](windows.md#開発検証)で行います。

ビルドdownloaderの9ケースには、実際の@electron/getを別processで起動するHTTP proxy経由取得とNO_PROXY bypassを含みます。loopback serverと合成bytesで検証し、外部artifactを取得しません。既存のagent/timeout/redirect/checksum/progress/file-cache検査も維持します。

Windows H.264置換の追加検査は[Windows開発・検証](windows.md#開発検証)を参照してください。installed E2Eにも`export-menu`、`export-fast`、`paint-export`、`angle-sync-multi`、`angle-sync-gaps`を加え、通常runnerと同じ登録シナリオを検査します。Media Foundation不足のunit負例とWindows N実機検証は区別します。

## Mac最終DMGの配布検査

`scripts/tests/macos-release.mjs`は公開本文についても、Mac単独・Windows未署名・有効なAuthenticode署名の区別、未知/欠落した署名状態での停止、ロケールに依存しないUTF-8ファイル出力を検査します。本文へE2E件数を固定せず、実行結果の正本は各runのログとします。合成reportだけを使うため、実署名や公開の再実行にはなりません。

`scripts/tests/macos-release.mjs`は対象OSのsource選択、必須manifest欠落、再現可能archive・既存出力保護、main/version/tag照合の失敗経路を検査します。`test:run`/`test:ci`へ含まれます。Release専用afterPackは署名前payloadを保存し、`scripts/macos/verify-dmg.mjs <dmg> <arm64|x64> <report.json>`が実DMG内のstrict署名・公証ticket・Gatekeeper・NOTICE/model/hashを検査します。未署名候補とローカルunit成功をこの最終検査の代替としません。[入力・認証・公開ゲート](../.github/RELEASE.md)。

Windows同時公開の`release-evidence.mjs`は同一runのinstalled reportと最終installerを完全source commit/tree・version・hashで結び付けます。`scripts/tests/windows-distribution.mjs`は旧版・別commit/tree・改変installer・異常署名状態・manifest不一致・私有モデル混入の負例を検査します。Release workflowはWindows jobが成功してからartifactを取得し、公開直前にも再検査します。

Macのelectron-builder publisherは`mac.publish: null`で明示的に無効化する。`--publish never`だけでは既存GH_TOKENから更新用`app-update.yml`が自動生成されるため、DMG出力そのもので署名前の同梱物検査を実行する。公開は検証後の既存`gh release create`工程だけで行い、同梱物の許可リストは緩めない。

`e2e-capture-reopen`は合成84秒の確定録画で全体duration、60秒へのシーク、逆方向・終端・終端からの戻り、同じvideo要素での連続再生、別process再開を検査する。`e2e-unified-open`はOS picker応答のみstub化し、共通UI→実Main→別保存先の再利用→実動画再生を新processでも検証する。両方を標準runnerにも登録する。unitはEOSによるduration再計算、録画sampleによるduration伸長、移行先オフライン・索引書込失敗・欠番・Finderメタデータ変更・予約解放を固定する。

## Model release selection foundation

`node --test scripts/tests/event-model-release-policy.mjs`は版順、未承認/withdrawn/アプリ版不一致/target不足の除外、同版衝突、catalog・候補・根拠のhash改変、古いlock、noneとrollback拒否、symlink、CLI失敗時の入力非開示を合成データで確認します。checked-in catalog/lockとpackage.jsonの対応も実検査し、`test:run` / `test:ci`へ含めます。これは選定metadataの整合試験で、実モデル精度・許諾・target固有runtime・署名公証の試験ではありません。[実同梱前に必要な検証](event-model-release-policy.md#次の実装と受入条件)。

## 再生用コピーと取消可能な履歴確認

`cacheJob.test.ts`はfps/全表示時刻/全音声packet・設定の照合、原本変更、容量、取消後の遅い完了、片付け失敗、明示的な停止中選択を合成portsで検査します。実変換・ディスクatomic公開・HW再生の証拠ではありません。コピー作成View/Controllerは通常再生から撤去しました。実装と未接続範囲は[設計](playback-cache.md)を参照してください。

`packageHistoryRead` / `packageOpenHandlers` / preload bridge / startup Hook・Gateway・Viewの回帰は、待機取消、late結果/エラー、reload/crash、unmount、他Window/旧request拒否、取消送信失敗を検査します。`packageBackupRestoration`は取消後に原本bytesと履歴判定が保持され、再試行可能なことを実一時ファイルで確認します。`packageSessionRegistry`は同Window/同pathの後続bindを旧cleanupが解放しないことを確認します。対応OSの実open/preload E2Eと遅い保存先での応答は別検証です。

`sourceIdentity.test.ts`は全bytes/取消/差替え/特殊ファイル拒否を、`cacheStorage.test.ts`は実一時ファイルを使い、job接続、seal前採用拒否、出力hashとの結合、容量/中断job/同時writer、後続差替え、symlink/hardlink、片付け失敗と再試行、公開先保全、ready改変の検出を確認します。合成proofを使うため、動画の全列validator・HW効果・process停止・実音声の検証ではありません。

`cacheConversionRunner.test.ts`は合成workerと時計で取消/容量/期限/出力量・遅いclose・停止未確認・単一poll・古いcallbackを検査します。`cacheWorkerProcess.test.ts`はspawnをmockし、shellなし・所有childへのTERMだけ・close別通知を確認します。`cacheStorage.test.ts`は実一時ファイルの容量超過で停止要求し、合成close前は出力を保持し、close後だけ片付ける接続を検査します。これらは実FFmpegやOSのprocess終了を実行した試験ではありません。終了未確認のView/Storyは再生成や片付けを出さず、原本を使用できることを明示します。

`cacheDisplayScan.test.ts`と`cacheProbe.test.ts`はfield_order欠落の仮分類、空/混在/属性欠落/unknown拒否、全尺後半の不一致、prefix取消/診断/不完全JSONとclose前の所有維持を確認します。bounded prefixを全尺proofの代替にせず、実素材のcoded orderや音声聴取の証明とはしません。

`cacheContentProofs.test.ts` は実ファイルhashを使い、同サイズ改変、probe中の交換、取消/遅延完了、再起動/runtime差、返却値の分離と8件LRUを検査する。`cacheReusePipeline.test.ts` はwarm proofでもHW・所有権・最終hashを再検証し、HW中の同内容ファイル交換を拒否する。模擬probeの合格を実変換や長尺の性能改善とは扱わない。

再生用コピーのHW検査は`cacheHardwareCoverage/ProbePage/Probe.test.ts`で区間欠落・seekの飛び・古いcallback・早期ended・複数player/fallback・期限後成功・遅いcloseを拒否する。`cacheJob.test.ts`で生成にcompatibility証拠を使えないこと、reuseにモード不一致の証拠を使えないことを検証する。原本復帰の音声・画像ACKとleaseはnative controllerと`cachePlayerSwitch.test.ts`で確認する。実機は同一入力/候補と360秒など固定した計測上限を使い、cold/warmの内容proof、各HW区間、hash、背景負荷を記録する。IPC診断は実UI/実音声/物理scrubの合格ではない。

再生用コピーの永続proofは`cacheProofStore.test.ts`で認証/版/shape/時刻関係・容量・link/owner/mode・取消/書込不確定・同時要求を、`cacheApplicationIdentity.test.ts`で物理bytes/交換/取消を、`cacheContentProofs.test.ts`で再起動と改変時の全解析を検査する。`cacheReusePipeline.test.ts`は非同期保存後のowner/原本/取消と新規HW失敗を確認する。これらは実ASAR/実HW/実音声の検証を代替せず、別Main・同profileの短尺IPC計測で永続記録の実採用を確認する。

`scripts/tests/electron-runtime.mjs`は実梱包依存checkerへ架空のcompiled Mainを渡し、Electron内蔵`original-fs`・Node builtin・相対importの受理と、未知require/dynamic import・似た名前の拒否を検査する。実Electronでraw ASARを読めることは別の梱包IPC検証で確認する。

`cacheIdentityHandoff.test.ts`は同サイズ改変・mtime復元・同内容inode交換・links・別path・二重消費・取消・open待ち中のclose・close失敗と明示retryを実FSで検証する。`cacheReusePipeline.test.ts`は実handle.readのbytesとMainの有界auditを比較し、fresh/warmの全digest回数、Jobのcleanup失敗保持を確認する。短尺の別Main IPC計測は同一build/profileのpersistent proofを用い、全field/音声proofと新規HWが残ることを確認する。測定は実UI/再生品質の合格を意味しない。

`shared/playbackRanges`のunitは、連続seek中の旧read破棄、native append/removeの直列所有、取消後の遅延完了、未確認read/SourceBufferの保持、容量に含むin-flight bytes、使用中区間のeviction拒否、再読込、close失敗の一回所有を検査する。共通時計では停止中の要求配送、元のsource時刻への変換、capture例外との分離、URL/アングル所有を確認する。Mainのread lease、実MSEの連続区間、元動画復帰、実音声同期、物理scrubは別の未完了ゲートである。

区間キャッシュの基盤回帰では、ticket偽造・別所有者・再引換え・再読取時の改変、最終revision照合中の失効、read/close失敗と予約保持、生成とconsumerの最大2件、取消の即時通知と遅いsettleを検査する。Main/Renderer接続とnative供給ACK・実音声同期・物理scrubは別の実機検証であり、この合格から推定しない。

Native再生の`nativePlaybackSession.test.ts`は配送と画像/音声準備、古い応答、速度scopeを検査する。`nativePlaybackManager.test.ts` / `nativePlaybackHandlers.test.ts`は再qualification、実sender guard、payload、終了待ちと不明なcleanupを確認する。Rendererのcontroller/gateway、toolbar、`nativePackageClock.integration.test.tsx`は原本時計、遅いHTML play、復元後のlease解放を検査する。in-process bridgeの成功は実BrowserWindowや映像音声品質の合格ではない。[検証と限界](native-playback.md#検証と限界)。

Native snapshot通知は`nativeSnapshotDelivery.test.ts`で1万更新時の有界配送、旧owner/文書ACK拒否を、preload試験で購読解除後のACK回収と不正payloadを確認する。Session/Controller試験では非同期write失敗の即時通知、timerを進めない時計更新、購読者例外時のdrainを検査する。実BrowserWindowの失敗結果をunit成功で置き換えない。

### Native export候補

[native-export.md](native-export.md#未達のgate)のunit/process所有権と実媒体境界検証を行います。receipt/metadataと出力品質合格を分け、通常providerを有効にする前に複数playerの音声終端・edit list・描画fallback・配布検証が必要です。

Apple再生の入力資格は`nativeSourceProfile.test.ts` / `nativeSourceAccess.test.ts`で先頭・音声/映像末尾差・metadata/source変更を確認します。実機では同一原本で停止再開、中間/終盤seek、既存原本復帰を直列検証し、背景負荷と終了receiptを残します。独自PCM窓の旧検査はAVPlayerの実出力検証として流用せず、有限の画像所有数と時刻連続性を検証します。

Renderer recovery diagnostics are covered by `nativePlaybackController.test.ts`: duration failure after a normal drain, unknown private error exclusion, and lease retention when reporting rejects. Manager, handler and preload tests cover same-owner post-close reports, document/generation changes, subframes, extra text, invalid numbers and duplicates. These automated checks do not certify physical UI input or audible synchronization.

Native runtimeのmacOS変更では`pnpm run test:native-runtime`を追加実行します。実FIFO probeと合成backend/surface/診断上限をNode test runnerで検査し、`.node.cjs`はVitestへ重複登録しません。資源検査・session directoryのTypeScript回帰は通常Vitestに含めます。署名済みpackageの自動native開始・非対応source・原本復帰・正常終了は実アプリで別途確認します。

音声読み出し・復号・出力はAVPlayerが所有します。旧AAC/PCM窓の独自回帰は削除し、選択・消音・速度・原本復帰の契約を確認します。合成回帰や消音再生から可聴同期を推定しません。

同runnerのowned backend/runtime回帰は、receipt欠落、`exit`だけの通知、`close`不一致、control pipe失敗、GPU drain失敗、重複close、旧世代の遅延通知を分けます。物理終了後だけ資源回収を試み、成功しても元のreceiptエラー・診断sessionを保持することを検査します。signal終了は模擬ChildProcessイベントであり、実アプリへsignalを送りません。この結果から実異常終了後の原本復帰や通常Quit成功を主張しません。

## Native標準再生

自動nativeの負例は表示準備の順序、同一URLの登録置換、失敗後の無限再試行防止、cache切替時のdrainを含めます。配布は署名metadata欠落・wrong team/identifier・改変・symlinkを拒否し、最終実署名artifactで自動open/停止再開/fallback/終了を確認します。既存unsignedの成功は署名済みartifactの代替証拠ではありません。

Native供給回復は`ProductSupplyRecovery.test.cpp`を`test:native-runtime`で実行し、fractional停止時計・映像/音声reserve・旧画像ACK・停止未確認・期限・累積時間予算・取消を確認します。映像のみの10ms未満の不足猶予と、音声不足・原本時刻/連続経過時間上限では猶予しないこと、3回目の短い回復を回数だけで拒否しないことを確認します。Main/Renderer回帰ではbuffering契約、再開時の逆行、未完了seek、pause、新seek、heartbeat/音量変更での期限延長拒否を検査します。実helperの停止/補充/再開と実原本の画面確認は別で、unit成功から待機なしとは判定しません。
