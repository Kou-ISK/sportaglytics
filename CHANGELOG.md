# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- 将来リリース向けの最新適格event model選定方針、公開candidate catalogとapp-to-model lockのhash検査、合成CI負例を追加。現在は空catalogで追加イベントモデルなし。取得・同梱・rollback例外は未実装で、公開済みv0.17.12の固定配布内容は変更しない。[方針と残る受入条件](docs/event-model-release-policy.md)。

## [0.17.18]

- Macの逆方向キーを離した後、未完了シークの遅い画像へ位置が飛ぶ問題を修正。最後に描画した画像を維持し、別操作・原本復帰・即時再押下を保持する。
- この版はキー解放後の位置修正に限定。押下中の0.5倍/高速逆方向の画像更新不足と、停止位置の再確定に約2秒を要する限定実測、未公開Playlist候補の画像更新問題は未解決。実聴取同期・長時間品質を確認済みとはしない。新しいUIや変換処理は追加しない。

## [0.17.17]

- Mac Apple Siliconの対応H.264/AACファイルでは、合成なしの単一カットをAVFoundation passthroughで出力し、不要な再圧縮を省く。指定範囲と選択音声を維持し、利用時の全尺走査や新しいUI設定は追加しない。
- オーバーレイ・描画・複数区間の結合・非対応入力は従来の書き出し経路を維持する。元の圧縮品質を保持するため、従来の再圧縮より出力が大きくなる場合がある。
- 署名資源・原本不変・提示区間を検査し、一時出力の取消と最終保存先への非上書き公開を管理する。限定区間の画像・PCM比較と実聴取は別の確認として扱う。[仕様と検証範囲](docs/native-export.md)。

## [0.17.16]

- パッケージ参照Playlistで画面更新が遅れるたびに古い時刻へ逆シークする問題を修正。映像の実時計を使い、同じ同期情報のfocus再読込では再生を止めない。読み込み待ち、区間切替、2アングルの空白と同期、注釈フリーズを維持。保存尺より早いEOFは自動再開せずエラーで停止する。
- Mac向け修正。メインのAVPlayer再生、UI操作、保存形式、書き出し方式は変更しない。長尺原本の限定比較・署名・公証・配布結果はRelease記録を参照し、全尺の安定性や実聴取同期の保証とはしない。

## [0.17.15]

- Macの対応映像の再生中核をAVPlayerへ変更。独自FFmpeg復号・PCM窓を外し、通常スクラブは実表示時刻を使う高速経路、コマ送り・時刻指定は厳密経路に分離。再生用コピー操作・方式表示・常時の開発警告を通常画面から削除し、音声操作を既存ツールバーへ統合。[仕様と検証範囲](docs/native-playback.md)。

- 停止・速度変更中のAVPlayer時計通知を整合させ、古い状態と新しい速度の組合せによる誤停止を防ぐ。未対応速度は終了確認後に互換経路へ引き継ぐ。
- 通常スクラブ、原本の短時間再生・停止再開・末尾往復を確認。実聴取同期・長時間安定は未確認であり、署名・公証・配布の完了は同版のRelease記録を参照。

## [0.17.14]

macOS向けのネイティブ標準再生と供給・操作・終了処理の改善を配布する候補です。初回・遠距離シークには待ち時間が残ります。最終候補の長尺原本の短時間再生・停止再開・シーク・通常終了を確認しましたが、最大待機時間の外部記録、実聴取による同期、長時間安定は未確認です。過去の間欠停止を全て解消した保証とはしません。署名・公証・公開の完了は同版のReleaseと検証記録を参照してください。

- 数msの一過性映像不足を同じ音声時計で吸収し、短い回復の回数だけで再生を打ち切らない。持続不足の累積時間予算・取消・原本時計を維持。
- 音声の必要範囲だけを有界に読み取り、元の全音声PTSとPCMを保持。返信キューの正当なburstを拒否する容量不足を修正。

- 非公開のnative clip export adapterを追加。合成なし区間の候補・音声選択・既存fallbackと独立qualificationを分離し、通常起動は従来経路を維持します。詳細は[設計](docs/native-export.md)。

- 対応するmacOS arm64の単一原本をネイティブ再生へ自動接続。任意切替をなくし、非対応操作・形式は内部の互換再生で維持。署名済みhelperの同梱・原本への復旧・既存cache選択を統合。[範囲と未達の受入条件](docs/native-playback.md)。

- 保存済み再生用コピーの同一要求内で候補digestを安全に引き渡し、重複全読込を1回削減。途中交換・取消・close失敗の保護は維持。

- 再生用コピーの全内容proofを同じ実bytes・環境・ビルドに結合したprivate記録へ保持し、再起動後の重複デコードを削減。破損・変更時は全解析へ戻り、毎回の全hashと新規HW確認を維持します。長尺と実再生品質は別途検証が必要です。

### Fixed

- 通常再生で表示要求を待つ間に、表示時刻を過ぎた検査済み画像候補が復号枠を占有し続ける経路を修正。最新画像・未来field・停止/シーク・送信済みGPU資源の保持と既存上限を維持。
- native終了receiptの検証失敗で後続の画面資源回収まで省略される経路を修正。所有子プロセス・通信路の終了確認後に既存のGPU所有検査を試み、元の終了エラーと復帰保護は維持。
- ネイティブ経路から厳密な文書末尾へ戻る際、映像と文書の微小な終端差を区別し、停止画像を確認して原本へ復帰する。一般の範囲外要求と原本時計は維持。
- 依存監査の修正版へ更新。Electron43.8.1、Zod4.6.7と開発・配布ツールを更新し、監査例外やセキュリティ設定の緩和は行わない。

- タイムライン書き出しに素材ごとの確認済み音声選択を引き継ぐ。切替中・同一素材の選択競合を検出し、別アングルへ音声番号を流用しない。従来の適格な単一音声の全区間無変換出力は維持。

- 再生用コピーの再利用HW検査を先頭・中間・末尾の新規適合性確認へ分離。初回生成の全尺検査と全内容proofを保持し、decode error後の原本復帰は確認完了後だけ通知。未検証の長尺・実音声品質を合格とは扱わない。[保証範囲](docs/playback-cache.md)。

- 長尺・高負荷のローカル動画で、デコード待ちの間に共通時計だけが進み、復帰後の自動シークを繰り返す問題を修正。空白区間・クリップ境界・明示シークは維持する。録画のMSE再生は追記用の時計を維持し、記録のない空白へのシークと次のクリップへの復帰停止を防ぐ。
- 遅れて届いたフォーカス通知が、閉じて非表示にした録画操作ウィンドウなどを再表示しないようにする。

## [0.17.13]

未公開の準備版です。長尺動画の待機・録画の空白区間からの復帰、非表示ウィンドウの遅いfocus処理の修正は次の配布版へ引き継ぎます。既存mainの準備履歴を保持し、この版のtagや配布物を後付けしません。

## [0.17.12]

0.17.11の正式工程はmacOS E2Eで停止し、配布物は未公開です。既存tagを維持し、同版のOSS改善と以下の試験修正を新しい版へ引き継ぎます。配布・署名・公証の状態は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)と同版の検証要約を参照してください。

### Fixed

- Timeline終了試験を、最後のWindowを閉じてもアプリを残すmacOSの既存仕様に合わせる。所有元/Timelineの消滅と保存内容を明示的なQuitより前に確認し、新processでの再開、故障時の取消・再試行、全WindowのQuitを維持する。対象source変更のPRでもmacOSの合成回帰を実行する。

## [0.17.11]

終了時保存とOSSの初回利用・共有・検証導線を改善する版です。配布・署名・公証の完了は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)の同版と実行証跡を参照してください。既存の公開版・tag・配布物は維持します。

### Added

- 新しい自動検出候補に元モデル・版・候補スコア/時刻を保存し、場面検索の詳細に表示する。保存再開・Undo・コピー・分割・結合で保持する。旧データの由来や人確認を推定せず、人確認済みを記録する操作は未提供。[範囲と互換性](docs/event-detection.md#検出後の区間修正)。

- 図形だけの20秒映像を含む約29 KBの合成サンプルと、タグ追加・修正・保存再開・MP4共有までの[初回手順](docs/quickstart.md)を追加。生成recipe・hash・MIT告知、再生成検査、通常/Windowsインストール後の実操作試験を用意する。
- 240 / 2,400 / 10,000件の合成Timelineで、実検証・検索・直列化・atomic writeを測定する[限定負荷測定](docs/synthetic-workloads.md)を追加。Node/tmpfsの測定であり、画面応答・長時間映像・Mac/Windows性能の保証とは区別する。

### Fixed

- Timeline・分析データ・マトリクスのCSVで、式として解釈され得る文字列に接頭辞を付ける。数値・保存データ・JSON出力は維持し、文字列の見え方と再保存時の制限を[出力仕様](docs/sctimeline-implementation.md#表計算ソフト向けcsvの文字列)に記載する。
- SCTimeline JSONの既定ファイル名を`timeline.SCTimeline`へ変更し、保存ダイアログでもJSONと明示する。交換データの構造と読み込み条件は維持する。
- 日本語UIのHTML言語指定を`ja`へ修正する。

- 検出完了時に保存・終了処理が候補追加を拒否した場合、追加成功と誤表示せず再試行を案内する。
- Timelineの最終編集を保存してから主画面を閉じ、アプリ終了時は全Timelineの保存応答とMainのwrite queueを待つ。保存失敗・応答なしでは終了を取り消して編集と再試行を維持する。[保存・終了の契約](docs/package-compatibility.md#読み込み保存の失敗)。
- Timeline保存を既存の読込上限16 MiB（UTF-8）以内に制限し、上限超過では元ファイルと編集中の内容を保持して終了を取り消す。一般の交換用exportへ同じ上限は適用しない。
- 共通Electron IPCで送信元mainFrameとアプリ文書URLを照合し、Settingsも同じguardへ統一する。任意file/data/外部ページへのtop-level navigation・redirectを拒否し、既存iframe資産と生成Helpの経路を維持する。[判断と検証範囲](docs/adr/0070-renderer-document-and-frame-trust.md)。

### Changed

- 初回利用・貢献の入口から合成サンプルへ案内し、文章AI・外部イベント検出pack・Paintモデルの準備と役割を区別する。v0.17.10で配布済みの同パス更新・復元、Mac署名公証とWindows未署名の条件へ文書を揃える。
- [素材の由来](docs/asset-provenance.md)に独自アイコンのAI生成申告を記録し、生成条件の未確認事項と確認済みのモデル・配布告知を分ける。貢献例・公開ログの確認項目・非公開セキュリティ報告の案内を具体化する。
- 新規Releaseに配布物hash・source commit/tree・署名検査結果・Actions runを記す公開検証要約を追加し、詳細検証artifactを90日保持する。既存Releaseへ後付けせず、実配布の検証状態は[Release手順](.github/RELEASE.md)と実行結果で確認する。
- 月次architecture reportのNodeを通常CIと同じ22.12.0へ統一する。

## [0.17.10]

公開状況と配布日は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を参照してください。既存の公開版とタグは維持します。

### Fixed

- 共通の「開く」で旧構造を元の場所・名前へ更新し、以後の編集も同じ場所へ保存する。0.17.9の編集済みコピーを確認し、内容が分岐した場合だけ使う内容を選択する。
- 全ファイルのコピー照合、journalによる途中終了からの復旧、日時付きの原本バックアップと復元案内を追加する。録画中・使用中・権限不足・容量不足・同名競合では不用意に置換しない。バックアップから復元した内容を以前の編集コピーで再び置き換えず、復元内容の確認後も同じ名前で保存・再オープンできる。[更新と復旧](docs/legacy-package-migration.md)。

## [0.17.9]

公開状況と配布日は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を参照してください。ライブ録画の再生待機と、共通の「開く」からの原本を保護する移行を改善する版です。既存の公開版とタグは維持します。

### Fixed

- 同期情報の保存が設定JSONを一時的に空にする問題を修正。原子的置換を使い、不正な設定は同期情報だけで上書きしない。
- ライブ録画の全体尺と再生バッファを分離し、離れた位置へのシークや録画終端で待機が続く問題を修正。保存済み録画の終端・再オープンを検証する。[ライブ仕様](docs/live-coding.md)。
- プロジェクトを開く入口を統合し、保存形式を内部で判定。移行済みコピーの別保存先・連番欠番の再利用、未完成コピーの拒否、失敗時の予約解放を追加する。[互換仕様](docs/package-compatibility.md)。

## [0.17.8]

公開状況と配布日は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を参照してください。Tabアクションジャンプの修正を含む版です。既存の公開版とタグは維持します。

### Fixed

- Timelineで選択中の同一アクションへ移動するTab／Shift+Tabを復元。開始時刻順の巡回と端の折り返しを維持し、ジャンプ先へDOMフォーカスも移す。入力・通常コントロール・OSのTab組合せを奪わず、Escapeで選択解除後は通常のTab移動へ戻る。[操作と適用範囲](docs/timeline-review.md)。
- Windowsインストール版E2Eで観測したYouTube起動widget `c271e571`を分類候補に追加。同じ実行のbootstrapによる完全一致URLの証明、全HTTP遮断、認識開始後のHTTP要求0件を維持する。

## [0.17.7]

公開状況と配布日は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を参照してください。0.17.6の正式工程は署名前の同梱物検査で停止し、未公開です。既存のタグは維持します。

### Fixed

- Windowsインストール版E2Eで観測したYouTube起動widget `0229cd64`を分類候補に追加。同じ実行のbootstrapからの完全一致URLの証明、全HTTP遮断、認識開始後のHTTP要求0件は維持する。
- Macのpublisher自動検出を明示的に無効化し、DMG生成時の不要な更新メタデータ混入を防ぐ。NOTICE・モデル・hashの許可条件、署名・公証・最終DMG検査は維持し、検証後のRelease工程だけで公開する。

## [0.17.6]

公開状況と配布日は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を参照してください。0.17.5の公開工程はMac E2Eで停止し、配布物は未公開です。既存のv0.17.5タグは維持します。

### Fixed

- Windowsインストール版E2Eで観測したYouTube起動widget `21090930`を分類候補に追加。同じ実行のbootstrapからの完全一致URLの証明、全HTTP遮断、認識開始後のHTTP要求0件を引き続き必須とする。
- 停止したままクリップを切り替えた後、動画の遅い読み込みが位置を0秒へ戻した場合も、要求したフレームへ再補正する。最初のフレームより前への到達不能なseekを繰り返さない制御を維持する。
- 最初の実フレームが0秒より後の映像で、停止seekの繰り返しによる起動・同期操作の停滞を防ぐ。

## [0.17.5]

公開状況と配布日は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を参照してください。この版はMacとWindowsの同一commitからの配布を準備しています。

### Fixed

- 戦術盤E2Eで観測したYouTube widget `ec429320`を起動scriptの分類対象に追加。同じ実行のbootstrapによる完全一致URLの証明、全HTTP遮断、認識開始後のHTTP要求0件の検査を維持。[検証条件](docs/testing.md#戦術盤)。

### Changed

- Windowsの同梱OpenH264をOS提供のMedia Foundation CPUエンコーダーへ置換。codec不足を検出し、Windows NではMedia Feature Packを案内する。[Windows版](docs/windows.md)。

- Macの配布を手動workflowへ分離し、既存Secretsによる署名・公証、最終DMG内のNOTICE・モデル・hash・Gatekeeper検査を公開の必須条件にする。両OS公開を指定した場合は同一commitのWindowsを新規build・インストール検査し、実hashとOS別対応sourceを一度に公開。[Release手順](.github/RELEASE.md)。

- Windows CIでインストール後のNOTICE・同梱資産・モデル・native告知のbytesとAuthenticode状態を検査し、同じ候補のhash reportを保存。[検査範囲](docs/windows.md#開発検証)。

- 同梱event packへ出典・固定revision/hash・LICENSE/NOTICE・利用制限・公開レビュー記録を必須化し、署名前の全ファイルと照合。未確認または不整合ならpackagingを停止する。モデルなし配布と既存ローカルpackの実行時互換は維持する。[配布記録](docs/event-pack-provenance.md)。

- AI指示の適用範囲・例外管理と人によるレビュー責任を明確化し、pnpm固定版、開発手順、品質ゲートの参照先を整合。
- Code Window等の「Sportscode準拠」表現を実際の操作説明へ変更し、SCTimeline JSONの外部往復未検証を明記。保存形式や動作は変更しない。
- [由来の確認台帳](docs/provenance-review.md)に資産・旧配布物の確認状態を記録。旧Releaseの補足公開や権利確認の完了を意味しない。

## [0.17.4] - 2026-10-10

### Changed

- 配布物へ実bundle由来の第三者告知とFreeType FTL本文を同梱し、同版ReleaseへFFmpeg等の固定対応source archiveとbuild manifestを添付する。[配布手順](docs/third-party-distribution.md)。

- アプリOSS・private R&D・モデル重み・学習データの公開境界と、3系統の[モデルカード・配布台帳](docs/model-distribution.md)を明文化。確認済みの比較記録と未確認の出所・許諾・recipeを区別。

### Fixed

- 開発・ビルド依存のsource-map-js、Joi、shell-quoteを修正版へ固定し、Electron/getのproxy依存を上流global-agent 4.1.3へ限定更新。未修正のsprintf-js依存経路を除去し、proxy/NO_PROXYを含む回帰検査を追加。[判断](docs/adr/0058-build-downloads-without-response-cache.md#2026-10-10-proxy-dependency-audit-update)。

## [0.17.3] - 2026-10-04

配布なしとなった0.17.2の変更を含む修正版です。配布物の公開状況は[Releases](https://github.com/Kou-ISK/sportaglytics/releases)で確認してください。

### Fixed

- 初回Playlistの描画が遅い場合も、受信listenerの準備完了までMainがclip追加と同期を保持し、順番に届ける。固定時間の待機に依存しない。[受信契約](docs/adr/0059-playlist-renderer-delivery-readiness.md)。
- 保存済みPlaylistのロード中に届いたclipをロード後にFIFOで追加し、古いdisk snapshotが新しい編集・文書世代を置き換える競合を防ぐ。行所属と重複IDの扱いを維持。[受信側の検証](docs/testing.md)。
- Playlistの古いロード完了がMain側の保存先やdirtyを変えないよう、Window別ticketとRendererの採用応答で文書を確定する。A/B文書のSave先と未保存のClose確認を両processで検証。[採用契約](docs/adr/0059-playlist-renderer-delivery-readiness.md)。
- 録画fragmentのread/append中に届いた更新を保持し、処理完了直後に最新の保存済み区間を読む。次の200ms周期までの余分な待機を除き、再生時計・seek・録画区間を維持。[検証](docs/testing.md)。

### Changed

- Electron E2EのTimelineコピー保存と戦術盤準備を操作の完了条件で待機し、ライブキャプチャのbuffer不足診断を追加。件数・保存内容・オフライン認識・非seek waiting=0の検査を維持。[検証契約](docs/testing.md)。

## [0.17.2] - 2026-10-04（配布なし）

正式リリース検証で問題を検出したため、タグを保持し、DMG・Windowsインストーラーは公開していません。修正版は0.17.3です。[Release手順](.github/RELEASE.md)。

### Changed

- Timelineの全幅を保つ下部検索dockと操作menuへ整理し、入力・ボタン・表・Dialogの密度を統一。新規作成の基本情報を内容に合わせた高さにし、Hotkey一覧を区切り行へ整理。[変更と検証範囲](docs/reports/2026-10-compact-density.md)。

- 分析上部をタブと折返し可能な操作欄へ整理。Dashboardの選択ラベルの上端切れを防ぐ配置とし、フィルター入口を操作欄へ統合。半円グラフを描画領域に合わせて拡大。[分析操作](docs/user-guide.md#ダッシュボードv040以降)。

- 分析の空チャートを状態行へ整理し、AIの入力と結果を操作順に配置。初回案内を共通Dialogへ統一。条件不一致とTimeline自体の0件を区別し、既存の編集・生成・出力操作を保持。

- 起動画面の操作・履歴の余白と枠を整理し、新規パッケージの見出しと進行表示を統合。5つの開始操作と履歴検索・削除・復旧は保持。[操作](docs/start-workspace.md)。

### Added

- Timelineの行名・ラベル・ノートを検索し、時刻順の結果から映像・全文確認・編集・Playlist追加へ進む開閉式レビュー欄を追加。[操作](docs/timeline-review.md)。
- Sportscode Edit List XMLと明示映像・秒数補正から、別の新規`.stpkg`を作成する操作を追加。ネイティブSportscode形式は未対応。[対応と制限](docs/package-compatibility.md)。

### Fixed

- Electron runtimeを43.3.0から43.5.1へ更新し、信頼できない内容を読み込むsandboxed preloadのcode cacheに関する[GHSA-qmv3-fv6v-rmhq](https://github.com/electron/electron/security/advisories/GHSA-qmv3-fv6v-rmhq)へ対応。同じ43 major内の正式版に固定し、既存UI・IPC・保存形式・署名設定は維持。

- 開発用wait-onのJoi overrideを[GHSA-6h2x-m376-mqjq](https://github.com/hapijs/joi/security/advisories/GHSA-6h2x-m376-mqjq)の修正版18.2.6へ更新。配布runtimeには含めません。

- 開発・ビルド依存の監査対応として同majorの修正版へ固定し、未使用Jest型依存とbuilderの未使用HTTP response cache経路を除去。checksum付きファイルキャッシュとproxy・timeoutを維持し、合成ダウンロードの回帰を品質ゲートに追加。[判断と保守条件](docs/adr/0058-build-downloads-without-response-cache.md)。

- Retinaなどの高DPI環境で分析の全内容PNGが継ぎ目を上書きし、チャートや見出しを欠落させる問題を修正。メニューを除去し、チャートのアニメーションを停止してから撮影・合成するよう変更。 撮影ごとの検証模様と位置が一致したフレームだけを保存し、スクロールバーを除去、分数倍率でも切り出しと合成の画素境界を統一。

- Dashboardの割合円グラフでtooltipが割合を重複表示する問題を修正し、集計元の件数・秒数を併記。[表示](docs/user-guide.md#ダッシュボードv040以降)。

- 固定の基本分析テンプレートに「複製して編集」を設け、保存時に編集が失われる入口を解消。保存失敗時はdraftと入力を維持し、有効なcount集計がコピー・importの正規化でdurationへ変わる問題を修正。

- 狭い開始画面で読み込み状態・失敗が操作欄の下に隠れる問題と、新規映像選択のアングル一覧が潰れる問題を修正。失敗時の表示位置とキーボードによる再試行への復帰を追加。

- 分析ウィンドウの受信準備後に最新snapshotを同期し、初回表示とreload時にデータが失われる競合を修正しました。

- 選択中のTimelineでTabが場面巡回を優先し、通常focus移動を妨げる問題を修正。巡回はOption/Alt+上下を使用。
- ウィンドウメニューから分析を開いた時に初回Timeline同期が届かず「同期中」に留まる問題を修正。
- Timeline読み込み失敗で空の文書を自動保存する経路を抑止し、映像・独立Timelineのエラー表示と再試行、順序付きの原子的テキスト置換を追加。
- 既知の旧SporTag `.stpkg` / 拡張子なしフォルダを原本保持のコピー移行へ統一。未知version、参照不在、権限・容量・途中失敗を検査。目的別のファイル選択を分離。

## [0.17.1] - 2026-09-23

### Fixed

- 起動直後のパッケージを開く通知が、読み込み完了イベントとロード状態の更新順序によって保留されたままになる問題を修正。以下の0.17.0の変更を含む初回配布です。

## [0.17.0] - 2026-09-23（配布なし）

リリース検証で起動時のパッケージ通知の競合を検出したため、タグのみ作成し、DMG・Windowsインストーラーは公開していません。修正版は0.17.1です。

### Fixed

- Windowsでライブキャプチャ画面を閉じた直後のメニュー操作が失敗する問題を修正。

- ライブ録画の操作画面を非表示で維持し、タイムラインから再表示できるようにしました。録画パッケージへのコードウィンドウ接続と背景での時刻更新を修正し、fragmented MP4の先読みで区間境界のプレイヤー再生成を解消しました。[ライブ仕様](docs/live-coding.md)。

### Added

- USB/HDMIキャプチャ・OS対応のiPhoneカメラ・IP映像を最大4入力まで取り込み、録画中に標準タイムラインでコーディングするライブキャプチャを追加。[対応条件と操作](docs/live-coding.md)。

- Playlistのクリップごとに既定アングルを保存し、連続再生と単一ファイルの書き出しへ反映。
- 参照PlaylistをパッケージID・相対位置・Macのファイル追跡で再接続。見つからない場合の移動先指定は同じ元パッケージの全クリップへ適用。[操作仕様](docs/playlist-features.md#参照先の移動と再接続)。

## [0.16.1] - 2026-09-22

### Fixed

- 「ファイル > 開く > プレイリスト…」から保存済みの `.stpl` を開けるように修正。編集中の文書を維持し、同じファイルは既存ウィンドウを表示。取消・読み込み失敗では空のウィンドウを作成しません。

### Performance

- 複数映像から選んだ場面ごとに元ファイルを直接使い、未選択区間の合成と不要な再圧縮を削減。文字・Paint・同期位置を保ち、解像度や圧縮設定を下げずに書き出しを高速化する。[適用条件](docs/user-guide.md#元の画質を保つ高速書き出し)。

## [0.16.0] - 2026-09-21

### Fixed

- 書き出しノートの背景を映像高の最大20%に制限し、1080p換算24px未満への縮小を防止。実映像のテキストプレビューと全クリップの長文チェックを追加。

- Playlistの自由記述を「ノート」に統一し、Sorter・Inspectorから直接編集した文章を映像へ書き出す。旧メモとノートは内容を保持して文書v4へ移行する。
- 映像書き出しのたびにオーバーレイテキストの有無を確認し、一般設定の固定値を廃止。複数行のノートのはみ出しと、通番の非表示設定が反映されない問題を修正。操作は[Playlist仕様](docs/playlist-features.md#ノートの編集と映像出力)を参照。

## [0.15.1] - 2026-09-21

### Fixed

- Timelineの連続ピンチ拡大で、スクロール位置のピクセル丸め誤差が累積してカーソル下の時刻がずれる問題を修正。以下の0.15.0の変更を含む初回配布です。

## [0.15.0] - 2026-09-21（配布なし）

リリース検証でピンチ拡大のずれを検出したため、タグのみ作成し、DMG・Windowsインストーラーは公開していません。修正版は0.15.1です。

### Added

- Playlist Sorterに項目選択・昇順/降順の操作を追加。ソート結果を再生・書き出し・保存順へ反映し、所属行とPaintを維持したままUndo可能に。旧文書は従来の順序を引き継いで移行。[Playlist仕様](docs/playlist-features.md)。

### Fixed

- Timelineの端編集で修飾キーを先に離すと変更が消える問題を修正。最後のマウス位置で確定し、選択を維持。Sorter検索中の範囲選択も表示行に限定。

- Code Windowの停止リンクを記録開始時だけ発火するよう修正。Timeline最上段のクリックシーク、端編集中の映像プレビュー、最大100倍のポインター位置を保つズームに対応。右向き速度キーを離した時の再生状態を復元し、複数クリップの二重シーク・デコード中の連続シークと停止後の遅延再生を抑制。[操作仕様](docs/user-guide.md)。

- 同じアングルの2本目以降でコーディングすると、タグが映像ファイル内の時刻で前半側へ記録される問題を修正。開始・終了を試合全体の共通時刻へ統一し、映像の切替をまたぐ記録にも対応。[記録時刻の仕様](docs/user-guide.md#イベントタグ付け)。

## [0.14.1] - 2026-09-21

### Added

- 映像書き出しの同期準備を選択範囲へ限定し、互換映像の無再圧縮連結と完成ファイルのコピー保存に対応。準備中の進捗を表示し、Timelineでも情報表示を切り替え可能に。[高速書き出し仕様](docs/user-guide.md#元の画質を保つ高速書き出し)。

- 通常のCodingタイムライン上部にSync Point / Align Anglesを統合。専用アングル行・案内バーを削除し、同期点を時間目盛りに表示。既存の再生ヘッドと設定済みホットキーによるアングル切替を使い、本数が異なる映像も任意の場面で同期し、欠落区間を黒表示。実フレームのコマ送り、前後半の連続操作、映像配置に応じたウィンドウ比率、配置と補正の同時保存に対応。[操作仕様](docs/angle-synchronization.md)。Video.js内部UIの露出とメタデータ読込による未保存調整の消失を修正。

- 複数映像・アングルの配置と同期補正をPlaylist/Paint/書き出しへ統一し、後半の元映像切替と正負オフセットの出力を修正。[操作仕様](docs/user-guide.md#マルチアングル同期)。

- Paintに選手・ボール・矢印を編集できる戦術盤とPNG出力を追加。部分ピッチの4点較正、フレーム確認、同梱モデルによる停止映像からの俯瞰配置候補に対応。保存・制約は[Paint](docs/tactics.md#戦術盤と映像からの配置)を参照。

- 表示中のアプリウィンドウをまとめて前面へ移し、起動画面のロゴを正式アイコンへ統一。
- 自動検出の設定・進捗・結果を独立ウィンドウ化。背景実行、再表示、最新Timelineとの重複判定に対応。
- Paintの追尾に描画位置での拡大・回転補正と短期基準画像の再照合を追加。Windows同梱FFmpegのPNG対応を修正。
- [市場価値を高める改善案](docs/reports/2026-09-product-value.md)を追加。

### Distribution

- macOSのApple Silicon / Intel向けDMGとWindows x64向けNSISインストーラーを配布。Windows版は未署名です。

### Fixed

- 起動直後に開いたパッケージが表示されない競合を修正。画面の受信準備前に届いた通知をウィンドウ内で保持し、一度だけ引き渡す。

- 高速書き出しの検証処理が未同梱ライブラリを要求して配布版を起動できない問題を修正。Mainの外部依存をビルド時に検査。

- Windowsで同期中に前後半の元動画を切り替えると、映像が先頭に戻って指定フレームへ移動しない問題を修正。

- 映像ウィンドウからエクスポートを選んでも設定が開かない問題を修正。Timelineの再表示・最小化復帰と、操作中のPlaylistへの書き出し通知に対応。[操作説明](docs/user-guide.md#タイムラインのクリップ書き出し)。
- Timelineの範囲選択後の削除対象とキー操作のフォーカスを修正。Enter／ダブルクリック編集、右クリックでの複数削除、行内の全インスタンス選択を統一。[操作説明](docs/user-guide.md#タイムライン編集)を更新。
- Paint動画出力で各クリップの選択アングルと描画を保持し、開始前から続く追尾を補間。異なる解像度の2画面合成と描画生成失敗の通知に対応。[出力仕様](docs/tactics.md#映像への書き出し)を更新。

- 複数クリップの再描画でプレイヤーが繰り返し初期化され、実映像の読み込みが完了しない問題を修正。

### Changed

- リスタート・ラインアウトを時間文脈で補正し、スクラムの判定を保持する試験model packの契約・公開画像比較・採用条件を[仕様](docs/event-detection.md#前後の映像と公開画像を使う補正)へ追加。

- 公開用のfixture・ドキュメント例を匿名化し、PR・ログ・コミット情報を含む公開時のプライバシー確認手順を明文化。

- 過去の学習映像と確認済み例を保持した補正モデルの採用条件・実pack検証を文書化。同一Codingの保持、別スクラムの分離、確認済み誤検知の改善を評価。

- 自動検出の同じ映像・モデルでの再実行時に解析済み候補を再利用し、しきい値調整時の待ち時間を短縮。
- 同一プレーの反復検出を区間へまとめるmodel packの契約・評価・試験手順を文書化。既存Timelineは保持し、モデル重みの更新と区間判定の改善を区別。

- 自動イベント検出の試験モデルで、既存Codingとの比較値を実際の精度と区別して表示。比較用model packの読み込み契約は[仕様](docs/event-detection.md)を参照。

## [0.14.0] - 2026-09-21

配布前のElectron E2Eで起動時の問題を検出したため、タグのみ作成し、インストーラーは公開していません。この版の変更は修正を加えて0.14.1へ含めています。

## [0.13.3] - 2026-09-14

### Fixed

- 新規作成直後のパッケージ・クリップ参照から`.stpkg`が抜け、自動イベント検出が`video file is missing`で失敗する問題を修正。実際に作成された保存先を使い、旧版の拡張子なし履歴も実在確認後に開けるようにした。
- 自動イベント検出の開始前に全映像ファイルの存在・種類・読み取り権限を確認し、失敗時は対象ファイルと対処方法を表示する。

- 自動イベント検出画面が背景の映像・コードウィンドウ更新で再読み込みされ、クリックや入力済みの検出設定が失われる問題を修正。

## [0.13.2] - 2026-09-14

### Fixed

- Timelineの端をOption+Command（WindowsはAlt+Ctrl）で直接ドラッグし、未選択のインスタンスも伸縮できるように修正。既存の選択と再生位置を維持する。
- 映像ウィンドウを閉じた後にSessionとパス予約が残り、同じパッケージを再度開けなくなる問題を修正。ファイルを含まないドラッグを無視し、ドロップ形式の案内と読み込み失敗の復旧案内を分離。
- 起動画面を離れた後にメタデータ取得が完了すると、最近開いたパッケージの履歴が保存されない問題を修正。

## [0.13.1] - 2026-09-14

### Changed

- 自動イベント検出の[学習・評価手順](docs/event-detection.md#検出精度の改善と評価)を更新。既存Codingの確認と再Codingを区別し、同期した引き映像による学習比較、実イベントの見逃しチェック、比較用モデルと配布モデルの境界を明記。

### Fixed

- Paintで短いドラッグや停止直後の時刻更新によって描画が確定しない問題を修正。追尾表示を実際の映像フレームへ同期し、小さな移動で蓄積する位置の丸め誤差を低減。
- 自動イベント検出で、重複する低confidenceの候補が先着順で残り、より強い候補の時刻が失われる問題を修正。採用結果は時刻順とし、既存の手動編集を保持する。

## [0.13.0] - 2026-09-13

### Added

- Timelineに再生位置での分割と同一行の結合を追加。ラベル・メモを保持し、1回のUndoで戻せます。[操作説明](docs/user-guide.md#タイムライン編集)。
- Timeline / Playlistの書き出しに、必要なローカル映像・元クリップ・保存先の事前確認を追加。同名の既存動画は連番で保持します。

- Windows 11 x64向け映像・音声同期・AI実行環境、日本語字幕フォント、NSIS導入とインストール済みElectronの検証。[Windows版](docs/windows.md)を正本とする。

### Fixed

- プレイリストを別ウィンドウで開いた直後の読込競合と、PaintでUndo直後に保存すると描画が古い状態になる問題を修正。
- Intel MacのAI実行ファイルをx64版へ修正し、両Mac版の同梱時にCPU種別と依存ライブラリを検証。
- WindowsのCtrl操作、file URL、日本語・予約文字を含むパス、操作欄を除いた映像ウィンドウの縦横比固定。既存Mac設定のショートカットを読込時に共通形式へ変換。

## [0.12.1] - 2026-09-13

### Fixed

- HomebrewのIntel向けCPU名を配布DMG名の `x64` へ明示的に対応付け、ダウンロードURLの不一致を修正。

- macOS署名用の一時キーチェーンへ誤ったパスワードを渡すelectron-builderの既知不具合を、修正版26.16.1への更新で解消。

## [0.12.0] - 2026-09-13

配布DMGは署名工程の失敗により未公開。以下の機能は0.12.1に含まれます。

### Added

- Paint描画モード: 選手ビーム・ディスク・リンク、位置キーのタイムライン編集、対象範囲を指定する映像追尾、ピッチ較正、芝色処理、素材プリセット、プレゼン表示、動画への描画書き出し。操作・制約は[Paint仕様](docs/tactics.md)を参照。
- Design Systemのsemantic token、共有UIのStorybook、UI chrome検査、`pnpm run verify`による一括検証。
- 複数 `.stpkg` をPackage Sessionごとの独立したMain Windowで開き、既存パッケージへの要求ではそのウィンドウを復元・focus。

### Changed

- 起動画面を検索可能な最近の履歴と開く・新規作成の操作へ整理。保存場所の表示、重複ロード防止、持続するエラーと再試行を追加。[起動仕様](docs/start-workspace.md)を正本とする。
- dark/lightの共通UI、Timelineの連続した行・再生ヘッド、Playlistのnative風リストとメニューを統一。再生バーは角丸・半透明とし、Playlistに描画位置の目印を表示。
- メイン映像ウィンドウはアングル数に応じた縦横比を保持。Playlistウィンドウは自由な縦横比を維持。
- Paintの右ペインを折りたたみ可能にし、選手リンクは順次クリックで人数を指定。Delete / Backspaceは選択した位置キー・図形へ作用し、Paint中のクリップ誤削除を防止。
- Timeline、Analysis、Coding Panel、PlaylistのWindowとIPCをPackage Session単位で分離。

### Fixed

- ライトモードの映像再生バーで、編集モード切替と時刻の文字色が暗くなる問題を共通media chromeで修正。

- Timelineの伸縮を1操作1履歴へ変更し、Esc取消とUndo/Redoの保存同期を改善。
- Paintの位置数値の空欄・未変更入力による意図しない保存を防止し、Enter確定・Esc取消と位置キードラッグの取消を追加。
- 依存関係の監査指摘を修正したバージョンへ更新。Releaseでlockfile固定、UI検査、公開タグ・DMGの上書き防止を適用。

- Timelineのアクション選択・長さ変更で再生位置が移動する動作を廃止し、ドラッグシークを上部つまみに限定。空白クリックでは選択IDとフォーカス枠を解除。
- 起動画面の `.stpkg` ドロップをElectronの `webUtils.getPathForFile` 経由へ変更。

### Documentation

- 起動・Playlist・Paintの現行操作、保存契約、制約、実装責務、検証方法を機能別の正本へ統合し、古いUI説明・型の複製・変更の逐次追記を整理。アプリ内Helpも同期。

## [0.11.1] - 2026-08-26

### Changed

- `.stpl`, `.stpkg`, `.stcw`, `.stad` のカスタムファイルアイコンを新デザインへ更新（macOS `.icns` / Windows `.ico`）。

## [0.11.0] - 2026-08-25

### Added

- Playlist Document schema v2: Organizer rows and deterministic presentation order, with backward-compatible migration for existing `.stpl` files.
- Playlist Window workspace shell with Organizer/Sorter switching, a resizable review area, Clip Inspector, and a non-destructive metadata Sorter.

## [0.10.3] - 2026-08-22

### Fixed

- 現行のパッケージ作成・最近開いたパッケージの表示文言へ Electron E2E を同期し、release workflow の E2E gate が旧UI文言で停止しないよう修正

## [0.10.2] - 2026-08-21

### Fixed

- パッケージ作成画面の現行ラベルにElectron E2Eを同期し、公開リリースで作成ワークフローを継続して検証できるよう修正

## [0.10.1] - 2026-08-21

### Added

- Timeline下部Footerに、Sportscodeに近い行追加操作と `− 100% ＋` の表示倍率コントロールを追加し、既存のCmd/Ctrl+wheel zoomも維持

### Changed

- ホーム画面を「最近開いたパッケージ → 既存パッケージを開く → 新規作成」の日常利用優先順へ整理し、一般UI文言を日本語へ統一
- Timelineの行追加を行一覧末尾から固定Footerへ移動し、表示倍率とdocument操作を同じ下部chromeへ整理
- エラー表示を自動消去せず、ユーザー向け説明・対処方法・展開可能な技術詳細の順で確認できるrecovery UXへ変更
- 映像書き出し失敗時のFFmpeg等のraw errorを詳細表示へ移し、元映像・保存先権限・空き容量の確認を先に案内
- native menuの命名を「パッケージ」「〜を開く」「ウィンドウを拡大/縮小」へ統一し、Timelineの表示倍率とnative window zoomを明確に区別
- アプリ内Helpを現行の独立Timeline / Code Window構成へ同期し、modifier + drag等の高度操作を検索可能な説明として追加
- design systemにDesktop Toolbar/Footer、Surface hierarchy、用語、menu、error recovery、Help as discovery layerの原則を追加

### Documentation

- `docs/user-guide.md` を初期画面、Timeline Footer/zoom、高度操作、menu terminology、error recoveryの現行UIへ同期
- `docs/design-system.md` にDesktop分析アプリとしてのUI・用語・Help運用規約を明文化

## [0.10.0] - 2026-08-19

### Added

- Timeline row を Sportscode の公開仕様にある色・名前・インスタンス数で並べ替え、並び順を project state として保存できる機能を追加
- Code Window editor で複数選択した button と内部 link をまとめてコピー＆ペーストし、相対配置・link関係を維持したまま新規IDへ複製できる機能を追加
- 検証済みモデルとは品質レーンを分離した experimental event-detection model を本番アプリで「試験」表示付きで利用でき、run単位で confidence threshold を調整できる仕組みを追加
- `.stpkg` 導入前の legacy project folder を元データ非破壊で sibling `.stpkg` へ自動移行し、同一sourceの再移行を防ぐ provenance / conflict-safe migration を追加

### Changed

- Timeline の time ↔ pixel 変換を共通 coordinate mapper へ集約し、instance の可視幅を実durationとzoomに完全比例させ、短いinstanceの操作領域だけを描画幅と分離して確保する構成へ変更
- active Code Window の Action button color を通常coding workflowにおける Timeline row / instance のpresentation color正本とし、色変更を既存Timelineへ同期
- Code Window 上部 toolbar をcompact化し、canvasの可視領域を拡大
- ローカル音声同期を固定 ±30秒・先頭20秒中心の探索から、低レートenergy featureによる広域Top-K探索、複数energy window検証、局所raw PCM refine、複合confidenceへ変更し、数十秒〜数分の開始差と先頭無音への耐性を改善
- Release workflow で macOS Electron E2E をDMG packagingより前の必須ゲートとし、失敗時はGitHub ReleaseとHomebrew Tap更新を行わないように変更

### Fixed

- Timeline で選択中の単一・複数instanceを `Delete` / `Backspace` で削除できない問題を修正し、text input / dialog等の編集面では誤削除しないようガード
- Timeline のrange selection矩形と実際のhit-testがzoom / horizontal・vertical scroll時にずれる問題を修正
- 選択済みinstanceの `Command + Option` edge drag による開始・終了時刻変更を共通座標系へ統一し、modifier release / blur / mouseup時にdrag stateが残る問題を修正
- 低confidenceまたは非有限値の自動音声同期結果が、正しい手動・保存済み同期offsetを上書きし得る問題を修正

### Privacy

- experimental event-detection model も verified model と同じpath containment、SHA-256、IPC validation、process timeout/cancel境界を通し、学習データ・checkpoint等の研究artifactを公開repositoryへ含めない配布境界を維持

### Documentation

- experimental event detection、Timeline操作、legacy `.stpkg` migration、広域audio sync / confidence guard、release E2E gate の設計判断と運用をADR・仕様書・release runbookへ反映

## [0.9.0] - 2026-08-18

### Added

- Code WindowのAction buttonごとにSportscode方式の開始前・終了後の記録秒数を設定でき、クリックとhotkeyの両方で同じrangeを適用
- 検証済みmodel packが導入されている環境で、Restart / Scrum / Lineout等をローカル解析し、progress/cancel、重複除外、Lead/Lag適用を経て通常のTimelineへ一括追加できる自動イベント検出runtime基盤を追加

### Changed

- 映像上の「タイムラインを表示」floating buttonを削除し、閉じたTimelineの再表示をOSの「ウィンドウ」メニューへ統一
- ラグビーイベント検出の学習・評価・dataset preparationをアプリ本体から分離し、SporTagLytics側は検証済みmodel packの安全な実行とTimeline統合だけを担当する構成へ変更
- 自動イベント検出の最低品質条件をRecall重視へ見直し、実際の製品採用は推論時間と人間の修正負荷を含めて判断する方針へ変更

### Privacy

- 学習データ、Coding元情報、checkpoint、研究run artifactをSporTagLyticsの公開repositoryと配布物から分離し、製品runtimeに不要な研究メタデータを持ち込まない境界を明確化

### Documentation

- 自動イベント検出のverified model runtime、Model Pack契約、外部R&D境界、品質判定方針をADRと開発ドキュメントへ反映

## [0.8.4] - 2026-08-15

### Added

- 映像とタイムラインを独立ウィンドウへ分離し、タイムライン側の編集・シーク・ホットキーを映像側の単一再生状態へ同期
- 左矢印と修飾キーを押している間、0.5倍速・2倍速・4倍速・6倍速で連続逆再生する操作を追加

### Changed

- タイムライン再生ヘッドを短い同期間隔の間で滑らかに補間し、連続シークを描画フレームごとに集約して追従性を改善
- プレイリストの「前のアイテム」を `Cmd+Option+←` へ変更し、`Cmd+←` を6倍速逆再生へ統一

### Fixed

- プレイリストの再生/停止で動画ソースが再ロードされ、クリップ開始位置へ戻る問題を修正
- プレイリストの終端処理が複数回発火する問題、範囲外シーク、フリーズ注釈から自動復帰しない問題を修正
- プレイリストの複数削除・並べ替え・Undo/Redo後に再生中アイテム、注釈、未保存判定がずれる問題を修正
- 再生時計のリスナーが時刻更新ごとに再登録され、シークと再生ヘッドが引っ掛かる問題を修正
- タイムラインの再生ヘッドを見た目の太さを変えずに掴みやすくし、インスタンス操作と重なる場合はインスタンスを優先するよう修正

## [0.8.1] - 2026-08-02

### Changed

- メニューバーをドキュメント指向へ再編し、映像パッケージとコードウィンドウの作成・選択を「ファイル > 新規 / 開く」へ集約
- 対象が不明な「コードウィンドウを開く」と重複項目を削除し、選択した `.stcw` だけを表示する操作へ統一
- トップレベルの「コーディング」を廃止し、コード／ラベル／編集モードを対象のコードウィンドウ内で切り替える構成へ変更
- コードウィンドウの編集表示を実行時と同じボタン外観へ統一し、ウィンドウresizeでキャンバス寸法を暗黙に変更しないように変更
- 設定をcompactな2カテゴリ構成へ整理し、ホットキー検索、未変更時の保存抑止、狭いウィンドウへの対応を追加
- ヘルプをsystem appearance対応の検索可能なreference UIへ変更

### Fixed

- 編集モード中に別の `.stcw` を選択しても、独立コードウィンドウが以前のレイアウトを表示し続ける問題を修正

## [0.8.0] - 2026-08-02

### Added

- 最大8アングル・各16ローカルクリップをパッケージ化し、クリップ間の空白を再生時に黒画面と無音で扱う仮想タイムラインを追加
- YouTube URLを映像アングルとしてパッケージへ保存・再生する機能を追加
- クリップ単位の絶対タイムライン配置、再生時の黒画面・無音区間、macOSでのYouTube音声アシストを追加

### Changed

- パッケージの映像モデルを `angles[] -> clips[]` へ拡張し、旧 `tightViewPath` / `wideViewPath` はロード時互換として維持
- パッケージ作成を基本情報・映像の2ステップへ簡素化し、同期設定を再生画面のシンクモードへ移動
- 映像追加を各アングルの「＋」からローカル／YouTubeを選ぶ操作へ変更し、複数選択・複数ドロップ・クリップ並べ替えに対応
- マルチアングルの同期offset保存契約、実Electron E2E、YouTube音声アシストのプライバシー境界をドキュメントへ反映
- タイムライン行の選択・ドラッグ並べ替え・削除と、選択行へインスタンスを`Command+C/V`で貼り付ける操作を追加
- インスタンスの通常ドラッグを行間移動、`Option`ドラッグを行間コピーとしてSportscodeの操作体系へ統一
- メニューバーの「コーディング > 新規コードウィンドウ…」から空の `.stcw` を作成し、独立コードウィンドウで開けるように変更
- コードウィンドウファイルの作成・編集・保存を独立ウィンドウに集約し、設定画面から管理タブを削除

### Fixed

- Electron型検査のemitがsandbox用preload bundleを上書きし、コードウィンドウの同期と設定ウィンドウの読み込みが同時に失敗する問題を修正
- 映像書き出し設定ダイアログと進捗ウィンドウがメイン操作を妨げ、進捗バーがFFmpegの実処理位置に連動しない問題を修正
- コードウィンドウのIPC listenerが再購読のたびに蓄積し、「別名保存」ダイアログや映像操作ホットキーが複数回発火する問題を修正
- 旧パッケージのアングル単位再生用コピーを参照し続ける問題を修正し、ロード時に元クリップ参照へ移行
- `file://` で動作する Electron 版で YouTube 埋め込みのクライアント識別情報が欠落し、Error 153 で再生できない問題を修正
- YouTube アングルを共通コントローラーと再生・シーク・速度変更ホットキーから操作できない問題を修正
- コードボタンの未解決チーム名とリンクによる自動活性化・終了で不要なステータス通知が表示される問題を修正
- ライトテーマでコードウィンドウの空状態説明と境界線のコントラストが不足する問題を修正

## [0.7.0] - 2026-07-19

### Added

- コードウィンドウをメインウィンドウから独立させ、映像パッケージに依存せず複数の `.stcw` ファイルを開いてタグ付けできるように対応
- コードウィンドウ自体を編集モードへ切り替え、ボタン、ラベル、リンク、ウィンドウサイズをその場で編集できる機能を追加
- コードボタンに設定済みショートカットキーを表示する設定を追加
- コードウィンドウ編集時に複数選択したボタンをまとめて移動できる操作を追加

### Changed

- コードウィンドウのボタン編集を右クリックのインスペクターダイアログへ変更し、編集ヘッダー、メニュー、リンク矢印をコンパクト化
- メインウィンドウからコード用ペインを除去し、タイムライン描画領域の高さを縮小
- コードウィンドウのサイズをユーザーがリサイズした実ウィンドウ寸法に追従するように変更

### Fixed

- 独立コードウィンドウのボタン押下状態が解除されず活性表示のまま残る問題を修正
- コードウィンドウにフォーカスがあると映像操作ホットキーを使用できない問題を修正し、編集モード中のみ映像ホットキーを無効化
- Rugby Basic のチームプレースホルダからリテラルの `Team1` と実チーム名のタグが重複作成される問題を修正
- ラベルモードの付与先がない場合のフィードバックと、選択中タイムライン項目へ付与済みのラベル表示を改善
- 既存コードウィンドウの上書き保存時に不要な保存ダイアログが表示される問題を修正

### Documentation

- リリース時の `develop` から `main` への統合を PR 必須の手順として明文化

## [0.6.0] - 2026-06-15

### Added

- クリップ書き出しの進捗を専用ウィンドウで表示し、書き出し中もメインウィンドウの操作を継続できるように改善
- タイムラインで選択中のイベントを `Cmd+Shift+P` でプレイリストへ追加できるショートカットを追加
- コードウィンドウの Rugby Labels プリセットを追加

### Fixed

- Electron package にローカル GGUF model files が混入し、ASAR 制限で package 生成に失敗する問題を修正
- Timeline のコンテキストメニュー「複製」が no-op になっていた問題を修正
- クロス集計表のヘッダ/フィルタ操作でレイアウトが崩れる問題を修正
- クロス集計のフィルタ編集を「適用」操作で確定し、「閉じる」では未適用の変更を反映しないように修正
- クロス集計の合計欄から該当映像へジャンプできるように修正
- プレイリスト描画の再生中に、描画位置へ到達した瞬間にクリップ冒頭へ戻る問題を修正
- プレイリスト描画モードが「完了」前に終了してしまう問題を修正
- 単一アングルの映像書き出しでオーバーレイ高さと文字サイズが不安定になる問題を修正
- オーバーレイなしの単一アングル書き出しで stream copy を使い、品質を変えずに処理を高速化

### Security

- Dependabot / `pnpm audit` の重要通知に対応し、Electron、Vite、uuid、electron-builder、video.js、wait-on と関連 transitive dependencies を patched version に更新
- patched version が提供されていない `xlsx` を削除し、Matrix XLSX export を dependency-free な最小 OOXML writer に置換

### Documentation

- OSS 向け community health files、Issue templates、docs 索引、ADR、ドキュメント運用ガイドを追加
- README、開発ガイド、AI contributor 向け規約導線を整理
- ディレクトリ構成と新規ファイル配置判断を `docs/project-structure.md` に明文化
- ADR と Docs Impact Matrix を追加し、実装変更時のドキュメント同期ルールを制定
- 音声同期、専用ウィンドウ、タイムライン相互運用、FFmpeg 書き出し、ダッシュボード統合の ADR を追加
- テスト/品質ゲート、AI 分析 setup、分析レポート export、privacy/data handling の docs を追加し、古い開発・release 記述を同期
- ADR の採番、命名、状態変更、supersede 関係の運用ルールを明文化
- ADR ファイル名の ID 必須ルールと `check:adr` による検査を追加
- LLM model artifact の配布境界 ADR を追加し、公式 package では GGUF model files を除外する方針を明文化

## [0.5.0] - 2026-02-02

### Added

- **AI分析機能**
  - ローカルLLM（llama.cpp）による映像分析パイプライン実装
  - ハイブリッド根拠検索（テキスト・ラベル・メモ・時間・レアラベル）
  - AI応答生成（要約、仮説、根拠ハイライト、推奨クリップ）
  - モデル自動検出（`public/llama/models/`配下の.ggufファイル）
  - AI分析からのプレイリスト自動生成機能
  - llama.cppバイナリとライブラリ（macOS対応、public/llama/darwin/）
  - スポーツ非依存の質問テンプレート

### Changed

- AI分析UIレイアウトを大幅改善
  - 2カラムグリッドレイアウト（1.6fr : 1fr）に変更
  - 右ペインにスクロール機能追加（maxHeight: 100vh）
  - テキスト簡素化（「AI分析」タイトル、「実行」「プレイリスト作成」ボタン）
  - 入力フィールドを2行表示（maxRows: 2）に変更
- AI根拠選択とトークン制限を改善
- AI分析の意図とコンテキスト要約を洗練
- AI分析のグラウンディングとチーム統計を改善
- AIフローを効率化し、llama.cpp進捗ログを追加
- llama.cpp統合とグラウンディング機能を改善
- AI Chat UIを洗練し、IPCリスナーを安定化
- llama出力の安定性とAI設定UIを改善

### Fixed

- AI分析からプレイリスト作成時に映像が反映されない問題を修正
  - PlaylistContextからElectron API（`window.electronAPI.playlist.addItemToAllWindows()`）に統一
  - 各PlaylistItemに`videoSource`/`videoSource2`を正しく設定
  - TypeScript型定義を改善（renderer.d.tsにチャネル別オーバーロード追加）

## [0.4.3] - 2026-01-27

### Changed

- 分析チャートとチーム集計を改善
- .stadパッケージ設定を他のアイコンと統一

## [0.4.2] - 2026-01-27

### Changed

- ダッシュボードファイルアイコンとチャートレイアウトを修正

## [0.4.1] - 2026-01-27

### Changed

- .stadパッケージ設定を他のアイコンと統一

## [0.4.0] - 2026-01-26

### Added

- **分析専用ウィンドウ機能**
  - 統計・分析を独立ウィンドウで表示
  - メインウィンドウとの双方向同期
- **ダッシュボード機能**
  - カスタマイズ可能なウィジェットシステム
  - デフォルトテンプレートダッシュボード
  - ダッシュボードテンプレート管理
  - シリーズ比較機能
  - .stadパッケージ形式のサポート
- **カスタムチャート機能**
  - カスタム軸制御
  - カスタムバーチャート
  - カスタム円グラフ
- **表示モード機能**
  - 表示モードホットキー追加
  - 単一アングル映像のフィット表示

### Changed

- 分析パネルコンポーネントをリネーム
- StatsModalをPanelにリネーム
- 分析ビューを簡素化
- ダッシュボード制約とテーマ付きツールチップを調整
- Momentumビューを復元

## [0.3.0] - 2026-01-18

### Changed

- Electron/React/MUIなど主要依存関係を更新
- CRA由来の構成整理（web-vitals、未使用設定、webpack設定の削除）
- ESLintフラット設定に移行
- GitHub ActionsのNode/pnpmを現行に合わせて統一

## [0.2.7] - 2026-01-18

### Added

- プレイリスト書き出し中の進捗をSnackbarで表示
- プレイリスト書き出しメニューを更新
- プレイリスト描画時のテキストボックススタイルを改善
- 既存プレイリストを開いた際に描画内容もロード
- 上書き保存に対応

### Fixed

- プレイリストの冒頭フレーム戻り問題を修正
- プレイリストウィンドウの閉じる確認ダイアログを修正

### Documentation

- 実装と乖離していたドキュメントを更新

## [0.2.6] - 2026-01-15

### Added

- ファイルアイコンを適用
- プレイリストで表示するアングル切替を追加

### Changed

- タイムラインからプレイリストに映像を追加する仕様を変更
- プレイリストのパッケージ形式を変更
- 映像出力時の通し番号設定を変更
- プレイリストの映像時間表示を削除

### Fixed

- アングル切替時に描画内容が反映されない問題を修正
- プレイリスト描画時の冒頭フレーム戻り問題を修正
- 複数選択時のプレイリストからの映像出力を修正
- electron-builderから不要なアイコン参照の記載を除去

### Documentation

- プロジェクトドキュメントをOSS標準に整備

## [0.2.5] - 2026-01-12

### Fixed

- 映像出力時のフォントを修正

## [0.2.4] - 2026-01-12

### Added

- ラベルモードを追加

### Changed

- 変数名qualifierをmemoに置換

### Fixed

- 日本語の文字化けを解消

## [0.2.3] - 2026-01-11

### Added

- entitlementsファイルをresource配下に移動
- Apple Developer署名・公証を実装

### Fixed

- entitlementsファイルをpublic/ディレクトリに移動（ベストプラクティス）
- 非推奨のnotarize.teamId設定を削除（electron-builder 25.x対応）

### Changed

- 古いresources/ディレクトリを削除

## [0.2.2] - 2026-01-08

### Added

- 個別映像全画面表示機能を追加

### Fixed

- 手動同期モードの動作を修正
- sync modeの修正

## [0.2.1] - 2026-01-06

### Added

- コードウィンドウのホットキー対応と設定スキーマ移行

### Changed

- helpとREADMEを最新の仕様に合わせて更新

## [0.2.0] - 2026-01-05

### Added

#### プレイリスト機能

- プレイリスト専用ウィンドウの実装
  - 連続/ループ再生機能
  - フリーズフレーム機能
  - 簡易描画機能（矩形/円/線/矢印/テキスト）
  - デュアルビュー切替
  - メモ編集
- クリップ書き出し機能（1ファイル/インスタンスごと/アクションごと）
- PlaylistContext によるプレイリスト管理
- メイン↔プレイリストウィンドウ間の双方向IPC通信

#### コーディングパネルの大幅改修

- 自由配置エディタ（FreeCanvasEditor）の実装
  - ドラッグ&ドロップによるボタン配置
  - 複数ボタンの同時選択（Shift/Cmd+クリック）
  - グリッドスナップ
  - ボタンリンク機能（exclusive/activate/deactivate/sequence）
  - Undo/Redo機能
- コーディングパネルのモード切替と設定管理
- ホットキー対応（Delete, Cmd+X, Cmd+Shift+D）

#### タイムライン機能強化

- 範囲選択機能
- ドラッグ&ドロップによるアクションインスタンス移動
- 右クリックでタイムラインメニュー表示
- タイムラインパネルでのホットキー対応（Delete, Undo/Redo）
- タイムライン行のアクション色付け
- ラベル配列構造への対応

#### 統計・分析機能

- 分析メニューの大幅改修
- マトリクスの軸選択UI変更
- 選択中インスタンスの合計/平均時間表示

#### UX改善

- パッケージ新規作成フローの改善
- 最近開いた項目をメニューバーから開けるように変更
- アクション選択切り替えをTabで実行可能に
- スペースキーによる映像の再生停止
- UIの統一

#### その他

- 映像出力機能の追加・改善
- 複数アクションを並行で記録できるように変更
- activateされたアクションを正常に終了できない問題を解消
- ラベル付与時のdeactivateしたアクションへの対応

### Changed

- actionType, actionResultを廃止しlabels配列を使用
- 不要なメニューをタイムラインから削除
- アクション編集ダイアログのサイズ変更
- componentを小さい単位に切り出し

### Fixed

- 各種バグ修正

---

## [2.2.0] - 2025-01-01

### Fixed

#### 2つ目の映像が表示されなくなる問題

**問題**: シーク操作中に2つ目の映像が表示されなくなる、または完全に消失する問題が発生していました。

**原因**:

- プレイヤーの頻繁な再初期化による不安定化
- 不適切なVideo.js状態管理
- 過度なシーク処理
- エラーハンドリング不足

**修正内容**:

- **SyncedVideoPlayer.tsx**:
  - 強制更新の最小化（初回同期時のみ）
  - プレイヤー健全性チェック強化
  - シーク閾値を2.0秒に調整
  - 詳細ログ追加
  - 非同期シーク処理の実装
  - 待機時間を500msに延長

- **SingleVideoPlayer.tsx**:
  - プレイヤー初期化の改善
  - 破棄処理の強化（`isDisposed()` チェック）
  - メタデータ処理の改善
  - 状態確認の厳密化
  - シーク処理の最適化（1.5秒閾値）
  - ソース変更の安全性向上
  - Promiseベースの再生制御

---

## [2.1.0] - 2024-12-01

### Fixed

#### 共通シークバーのNaN表示問題

**問題**: 共通シークバーで「NaN」が表示され、操作ができない問題が発生していました。

**原因**:

- Video.js プレイヤーの初期化前の値取得
- メタデータ読み込み前での処理
- NaN値に対する不十分なチェック

**修正内容**:

- Video.js の `ready()` と `loadedmetadata` イベントの適切な活用
- 厳密な型チェック（`typeof`, `!isNaN`, 範囲検証）の実装
- フォールバック機能の追加
- 多層防護（入力→表示→操作）
- デバッグログの強化

---

## Earlier Versions

## [0.1.0] - 2025-11-18

### Changed

- build後のファイルサイズを小さくするように変更

## [0.0.1] - 2023-09-15

### Added

- 初期のCIワークフローを追加

詳細な履歴は Git コミットログを参照してください。
