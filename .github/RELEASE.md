# Release Process

デスクトップReleaseの正本です。配布方針は[ADR 0063](../docs/adr/0063-independent-macos-release.md)、Homebrewは[配布手順](../docs/homebrew-distribution.md)を参照してください。

## アプリのバージョニング

[Semantic Versioning 2.0.0](https://semver.org/lang/ja/) を基に、これからのリリースに適用します。SemVerの0.xは初期開発段階であり、以下はこのプロジェクトの0.x向け運用です。過去の番号は再分類・振り直ししません。

| 変更 | 0.xの付け方 | v0.17.46を基準にした例 |
| --- | --- | --- |
| 既存の文書、操作、入出力に互換性がある不具合修正のみ | パッチを1つ進める | 0.17.47 |
| 互換性を保つ新機能、または対応する取り込み形式の追加 | マイナーを1つ進め、パッチを0にする | 0.18.0 |
| 互換性を壊す変更がどうしても必要 | 0.xの間はマイナーを進める。互換維持を先に検討し、破壊的変更、影響する版・文書、移行・バックアップ・旧版へ戻す条件をリリースノートに明記する | 0.18.0（互換性の注意を明記） |

修正と新機能が混在する場合は最も影響が大きい変更で決めます。直前の公開版からの全変更を見て分類し、リリースPRに基準版、変更の分類、文書・入出力への影響、移行と検証結果を書きます。番号の例は予約ではありません。タグや成果物が既にある番号は、未公開候補であっても使い回しません。公開済みタグ、DMG、ハッシュを差し替えず、失敗候補の修正には未使用の上位版を使います。文書の更新のみでは番号を上げず、タグや配布を作らないことができます。

アプリの版番号、[自製文書のスキーマ](../docs/package-compatibility.md)、Sportscode取り込み対応範囲は独立です。取り込める入力を増やすことやアプリのファイル名が変わることだけで、自製文書のスキーマを進めません。製品の版はタグ・`package.json`・配布物・Homebrew Caskで一致させます。既存の署名・公証・検証・公開手順は変更しません。

### 1.0.0の判断

1.0.0は互換性を壊すリリースの名前ではなく、安定版で守る契約を初めて明示する節目です。すべてのSportscode形式への対応は条件ではありません。次を満たした時点で候補にします。

1. 開く・保存・再読込を保証する自製文書の形式と既存版の範囲、対応OS、取り込み・出力の範囲、未対応を公開文書へ明記する。内部JSONの全フィールドや未文書化の挙動を一律に保証しない。
2. 直前の公開版と代表的な旧版で作った `.stpkg`・`.stpl` を署名済み候補で開き、映像参照、同期、行・ラベル・ノート・順序・描画など文書に含まれる情報を再保存／再起動で検証する。移行が必要なら原本の退避と復元を確認。古いアプリで新しい形式を読み書きできるとは仮定せず、切り戻し条件を明記する。
3. 安定サポートと表明するSportscodeの組合せは、明記したSportscode版で書き出した、再配布可能な合成素材の実ファイルで検証する。検証範囲外は実験的または未対応と明示し、製品の安定版とは区別する。
4. 通常の署名・公証・同一DMGでの検証と、直前のTap配布版からの隔離更新を通す。

1.0.0以降は、公開した互換契約に対し、後方互換の修正はパッチ、後方互換の追加や非推奨化はマイナー、後方互換のない変更はメジャーを進めます。メジャーではマイナーとパッチを、マイナーではパッチを0へ戻します。

## 0.17.44 の版準備

公開 v0.17.43 の main に、develop 統合済みの [#335](https://github.com/Kou-ISK/sportaglytics/pull/335) と版準備だけを反映する限定 PR です（ARCH-EX-028）。macOS arm64・Intel を対象とします。

署名候補の同一 DMG で、公開 .43 の隔離プロファイルからの更新と、.43 の再生・プレイリストを含む8項目の配信前検査を既存基準で実行します。Sportscode XML の検査では別フォルダに同名の合成映像を置き、選択した相対パスと本数の表示、コピーした映像のバイト一致、両原本の保持、再起動後のタグ時刻・ラベル・編集ノートを確認します。Hudl 製 .scpkg 実物は未検証です。

## 0.17.43 の版準備

公開中は v0.17.39。v0.17.42 は逆向きドラッグ直後の等速再生が3秒±0.2秒を満たさず未配信です。既存タグは変更しません。#331 のローカル映像の時計補正、#333 のプレイリスト再生速度と再開順序の修正、片側のファイル切替時の同期補正・各回帰試験と版準備のみ、レビューとCI後に main 基点の限定PRで扱います。Windows新規配布は行いません。

署名済み候補で従来の7ゲートを維持します。往復ドラッグの終端は操作で指定した位置を基準とし、終端シーク要求、各映像の提示フレーム、共通時計、タイムライン表示を同じ8秒以内で確認します。各角度が逆方向ドラッグ直後の3秒で±0.2秒以内に進む条件、フレーム数・更新間隔・ズレを緩和しません。プレイリストは同一の合成入力で、片側ファイル切替前後の0.5倍・1倍・2倍、倍率維持、解放、両アングルの実フレーム番号と最長提示間隔を署名候補で確認します。

## 0.17.46 の版準備

v0.17.45 は署名前の音声同期E2Eの合成素材生成で、出力の終了時にFFmpegの標準入力が閉じる EPIPE が起きたため未配信です。既存タグは保持します。対象を音声同期試験のPCM一時ファイル化と版準備に限り、同期検査条件、製品コード、未配信モデル方針は変更しません。通常CIと署名・公証、同一DMG E2E、公開後照合を再実施します。

## 0.17.45 の版準備

[#337](https://github.com/Kou-ISK/sportaglytics/pull/337) の develop 統合後、ARCH-EX-029 に沿って同差分と版準備だけを main 基点の PR に反映します。0.17.44 のタグ・配布物や develop のモデル配布方針は変更しません。通常 CI と署名済み DMG の回帰、旧版文書の維持、両 DMG と Homebrew の公開後照合を省略しません。

## 0.17.42 の版準備

公開中は v0.17.39。v0.17.41 は署名済み初回シナリオで、ファイル選択の前にテストの Electron Main 評価が失敗した（[候補実行](https://github.com/Kou-ISK/sportaglytics/actions/runs/45667406524)）。原因をアプリのクラッシュまたは単なるページ遷移と断定しない。署名済み候補の成果物は保存されていない。旧タグは変更せず、次候補では実際の初回導線でチュートリアルを閉じ、同一サンプルの保存・再起動・書き出しを通す。既存の .41 署名・遅延・2角度のフレーム・公開照合基準を全て継承し、失敗したものを配布しない。Windows新規配布なし。

## 0.17.41 の版準備

公開更新元は v0.17.39。未配信 v0.17.40 の署名成果物・タグは変更しない。旧候補は2映像の60地点で最長1.25秒、変更前の上限700ms超。通常の署名・公証・自動更新検証に加え、隔離した署名候補で次を満たした場合のみ既存の手順でmacOSを配信する。Windows版は追加しない。

- 合成3分・1080p59.94 H.264/GOP120の2アングルで、実フレーム60/60地点一致、p95 <160ms、最大 <700ms。往復それぞれ90入力で各アングル25フレーム以上、最長更新間隔 <400ms。通常3秒再生は各角度で±0.2秒。リリース・取消・オフセットも確認。
- 2本目だけの読み込みを意図的に900ms遅延。1本目は350ms以内、古い2本目を表示せず、正しい2本目の実フレーム提示後にだけマスク解除・時刻確定。人工待機の900msを通常検査の上限判定に使わない。
- 2画面の通常のドラッグ着地／キャンセル／4秒→2秒クリックの検査は緩めない。同じ合成映像で、JavaScriptの時刻代入後に28msの負荷を与えた場合にも代入中に提出された実フレームと記録時刻を確認する（`E2E_VERIFY_SLOW_REWIND_SETTER=1 node scripts/e2e-multi-clip-playback.mjs`）。
- ARCH-EX-025 の対象以外の develop 変更を混ぜない。旧公開版からの隔離更新・パッケージ・音声同期の回帰と公開後の両CPUの成果物照合を維持する。Hudl純正作成ファイルの互換性は未確認。

## 0.17.40 の版準備

v0.17.39 のタイムラインで、マイクロ秒単位に丸められたDOMの時刻が次のドラッグをブロックする問題のみを対象とします。#322 の動作修正とテスト、#320 の利用案内、#321 の回帰検証、版情報だけを現在の main に載せ、develop の未配信モデル配布ポリシーは含めません。v0.17.39 タグ・既存の公開成果物は変更しません。既存手順で候補の署名・配信前検査と公開版の照合を行い、Windows新規配布は行いません。

## 0.17.39 の版準備

公開版 v0.17.36 から旧形式移行・Sportscode XML 取り込みを含む v0.17.39 に更新します。未配信の v0.17.37、v0.17.38 タグは保持します。配信前検査の変更は [#317](https://github.com/Kou-ISK/sportaglytics/pull/317) にあります。模擬カメラが停止した原因は未特定です。ARCH-EX-023 の範囲で版とノートを develop に統合した後、main 基点の PR を検証します。

配信担当は確定した main SHA と新規タグを照合し、既存の Release desktop を macOS 用に実行します。候補の run ID・artifact ID・アーカイブと両 DMG の SHA-256 を記録し、arm64 と Intel それぞれの署名・公証・staple・Gatekeeper と同梱物を確認します。署名済み arm64 DMG で全 E2E を実行し、編集直後の終了・再起動とライブ録画・保存・再オープンも確認します。

隔離した更新先で、公開版 v0.17.36 で合成の .stpkg と動画のみの .stpl を作成・保存し、同じプロファイルを使う署名済み v0.17.39 に入れ替えます。起動版、映像参照、タグの開始・終了、プレイリストの順序と再保存後の読み戻しを確認します。[前回の更新試験](https://github.com/Kou-ISK/sportaglytics/actions/runs/45404584989) の対象は v0.17.38 です。公開後は GitHub Release と Homebrew Cask の両アーキテクチャの SHA-256 を公開 DMG に照合します。

## 0.17.38 の版準備

公開済み v0.17.36 から更新します。未配信の v0.17.37 タグは保持します。旧形式移行と Sportscode XML 取り込み（[#311](https://github.com/Kou-ISK/sportaglytics/pull/311)）、署名前に検出した検査競合の修正（[#313](https://github.com/Kou-ISK/sportaglytics/pull/313)）は既に main にあります。ARCH-EX-022 の対象はこの main に対する版と配信ノートの準備に限ります。両 PR のレビュー・CI 後、配信担当が確定した main SHA を使い、macOS の署名・公証、同一 DMG での受入、v0.17.36 からの隔離更新、GitHub と Homebrew の両 DMG ハッシュ照合を行います。

## 0.17.37 の旧プロジェクト移行とSportscode取り込み

[PR #310](https://github.com/Kou-ISK/sportaglytics/pull/310) と版準備を develop に統合後、ARCH-EX-021 の限定案をレビューし、main 基点の PR に今回の差分だけを適用します。未公開のモデル配布方針・catalog・lock、再生のDraftは含めません。両PRの品質・macOS・Windows試験とレビュー、署名・公証、同一DMGの隔離インストールと保存後の再起動、v0.17.36からの更新、公開後の両DMGとHomebrewのSHA-256照合を行います。Sportscodeの試験範囲は書き出したXMLと連続映像です。

## 0.17.36 のスライド文書互換修正

未公開の v0.17.35 タグと署名候補は保持します。v0.17.34 で新しいスライド文書を開き保存すると新版で再読込できないため、スライドのある文書に限り旧版が読み込み時に拒否する形式に切り替えます。ARCH-EX-020 の対象に限り develop 統合後に main 基点の限定 PR を作成します。両 PR の品質・デスクトップ CI とレビューを確認し、新規 v0.17.36 タグの署名・公証・同一 DMG の E2E、更新と Homebrew の照合を行います。

## 0.17.35 の Organizer と会議用スライド

対象は [PR #306](https://github.com/Kou-ISK/sportaglytics/pull/306) のプレイリスト操作と必要な版準備です。develop 側のモデル方針・catalog・lock、別 PR の逆再生は配布対象外です。ARCH-EX-019 の限定範囲を両 PR でレビューします。

タグと main の SHA・版を照合し、既存の Release desktop を macOS のみで実行します。署名・公証・arm64 同一 DMG の実 Electron 試験、保存済み文書と直前版からの更新検査、Intel 同梱物検証を維持します。公開後は両アーキテクチャの DMG の SHA-256 を SHA256SUMS と Homebrew Cask に照合します。

## 0.17.34 の音声同期修正（公開準備）

対象は [PR #303](https://github.com/Kou-ISK/sportaglytics/pull/303) と版準備です。公開版は現在 0.17.31、main は未公開の 0.17.33 です。0.17.31 に音声同期修正のみを適用できても、そのコミットは現行の署名ワークフローの対象外です。タグ・checkout・workflow・origin/main の照合は維持します。

1. 既存の 0.17.33 タグが main の先端にある間に、同一の署名済み DMG で単画面・2画面・プレイリストの押下中の表示、離した位置、再生復帰とスピーカー出音を確認します。受入結果を記録します。0.17.33 自体を公開する場合は main を進める前に公開・配布照合まで終えます。受入済みの内容を次版でまとめて配布する場合は、その判断を release PR に明記します。
2. develop に統合した #303 と本版準備のみを対象に、ARCH-EX-018 の限定ルートをレビューします。main 向けの差分で #302、#288、モデル選定方針・catalog・lock が入らないことを確認します。develop のモデル lock は appVersion の整合のみであり、main へ転記しません。
3. 両 PR のチェックとレビュー後、main の版・SHA・未使用タグを再確認します。署名候補は既存の Release desktop を main で明示実行し、`include_windows=false` と `publish=false` を指定します。同一 DMG の署名・公証・staple・Gatekeeper・配布物ハッシュ・インストールを確認します。合成2映像を用い、作成直後と再起動後にともに 1.25 秒の補正が計算され、4 秒へのシークにも反映されることを同梱アプリで確認します。スクラブを含む最終配布物では、画面・出音を含む既存の受入も同一 DMG で実施します。
4. 隔離した更新先で、直前の公開版からのアプリ差し替えと保存済みパッケージの再オープンを確認します。公開実行でも同じゲートを通し、Release の DMG・SHA256SUMS・検証要約と Homebrew Cask の両 architecture のハッシュを照合します。

## 0.17.33 のライブスクラブ候補

0.17.32 は署名前の複数クリップ受入で停止しました。既存タグを保持し、[PR #298](https://github.com/Kou-ISK/sportaglytics/pull/298) と [PR #301](https://github.com/Kou-ISK/sportaglytics/pull/301) の停止中シーク修正と同じシナリオのmacOS PR検査をdevelopに先行統合します。[ARCH-EX-017](../docs/architecture-exceptions.md)に従いmainの0.17.32から今回の修正・回帰と版準備だけを取り込みます。実験用PR #297、逆再生PR #288、未公開モデル方針・catalog・lockは対象外です。

両PRのCIを確認し、mainの最終SHAと新規タグを照合します。まず `publish=false` で署名・公証・配布物E2Eを行い、同一DMGを隔離したMacでドラッグ中の画像、解放時の原本フレーム、2画面・プレイリスト、再生復帰と実出音まで確認してから公開します。

## 0.17.32 のライブスクラブ候補

[PR #294](https://github.com/Kou-ISK/sportaglytics/pull/294)のドラッグ操作と版準備を対象とする。配布範囲の限定案は[ARCH-EX-016](../docs/architecture-exceptions.md)でレビューする。developへの先行統合、main向けPRのレビューと全CI、署名・公証と同一DMGの検査を維持する。未公開モデル関連の変更とPR #288は含めない。

レビュー・CIの完了後、対象のmain SHAと未使用の版タグを照合する。まず `Release desktop` を `publish=false` で実行し、候補のハッシュを記録する。候補を隔離したMacでドラッグ中の画像、解放後の原本フレーム、通常再生への復帰、実出音、2画面とプレイリストの原本再生を検査し、合格時のみ既存の公開手順へ進む。

## 0.17.31の保存完了確認を含む修正候補

0.17.30候補は通常E2Eの保存後Quitで停止し、署名・公証・公開には進んでいません。既存のv0.17.30 tagを保持し、file更新に加えてMainのclean通知を待つ検証修正と必要な版準備をdevelopへ先行統合します。[ARCH-EX-015](../docs/architecture-exceptions.md)に従いmainへ限定した変更を取り込み、PR #288と未公開モデル方針/catalog/lockを除外します。製品コード・終了ガード・15秒期限・全30シナリオを維持します。元runのdirty traceは未採取であり、Linuxの制御診断をそのMac failureの再現とは扱いません。

両PRの全CI後にmain SHAと未使用version/tagを再照合し、既存workflowを`include_windows=false,publish=false`で実行します。署名・公証・同一DMGの全E2Eとhash検査が成功してから、`publish=true`でも同じゲートを繰り返します。公開済み0.17.29、未公開0.17.30 tag、既存Windows配布物を保持します。

## 0.17.30のオーバーレイ折り返し修正候補

公開済み0.17.29を保持し、PR #289の文字幅実測・出力寸法/改行整合と必要な版準備だけを配布します。PR #288は未完成のDraftであり今回に含めません。準備はdevelopへ先行統合し、[ARCH-EX-014](../docs/architecture-exceptions.md)に従うmain基点の限定release PRで未公開モデル方針/catalog/lockを除外します。版0.17.30と公開順を準備PRで共有し、tag/dispatch直前にも他のrelease候補・進行中run・main SHAを再確認します。競合runを取消したり並行起動したりしません。

共通E2Eに登録した`export-text-geometry`は実MainからそのアプリのFFmpegを解決し、単一・回転・SAR結合のpreview/exportを比較します。既存の全ゲート、署名・公証、同一DMGのE2E/hash検査を維持します。まず`include_windows=false,publish=false`で署名済み候補を検査し、成功後の`publish=true`でも同じ検査を再実行します。Windowsの通常/インストール版CIは維持し、既存Windows公開物は変更しません。物理画面・実聴取・重い原本での再生受入は今回のCI成功と混同しません。

## 0.17.29のpublicationテスト準備修正候補

0.17.28の署名済み候補は全ゲートと丸め区間検査を通過しましたが、公開実行は公証通信切断、続く実行はC++テストの外側hook期限で停止し未公開です。既存tagと候補を保持します。PR #286はテストコンパイルを非同期・30秒上限、hookを35秒に整合し、準備中止後の新規起動を抑止して終了未確認の一時物を保持します。6件のpublication安全条件と製品budgetは維持します。develop先行統合後、[ARCH-EX-013](../docs/architecture-exceptions.md)の限定main PRでモデル方針/catalog/lockを除外し、CI・署名・公証・同一配布物E2E/丸め区間検査を再実行します。

## 0.17.28の行メニューfocus修正候補

0.17.27の候補runは通過しましたが、公開runの通常Electron E2Eで4件選択の待機が失敗し、未公開です。tagと候補を保持します。PR #284は実MUI/Controllerのjsdom回帰で再現した行メニュー閉鎖時のfocus競合を修正し、既存の行操作E2EをmacOS PR CIにも追加します。実Electronでの原因と改善はイベント記録/実行結果を別途確認します。develop先行統合後、[ARCH-EX-012](../docs/architecture-exceptions.md)の限定main PRに進み、モデル方針/catalog/lockを除外します。CI、署名・公証、同一配布物E2E/丸め区間検査を維持し、失敗した候補は公開しません。

## 0.17.27の選択同期修正候補

0.17.26の署名済み候補は全ゲートを通過しましたが、公開実行でタイムラインの複数選択/コンテキスト削除E2Eが失敗し、未公開です。tagと成果物を保持します。PR #282の選択同期競合修正・正確なIDでの選択/Undo検証・版準備を先にdevelopへ統合し、[ARCH-EX-011](../docs/architecture-exceptions.md)の限定main PRへ進めます。モデル方針/catalog/lockは除外します。所有者hook/IPC合成回帰を実Electron合格と混同せず、CI・署名・公証・同一配布物E2E/丸め区間の検査を保持します。既存0.17.24の配布物やユーザー映像は変更しません。

## 0.17.26の配布検査修正候補

0.17.25は署名・公証を通過しましたが署名済みアプリE2Eが未達のため未公開です。既存tagを保持し、PR #280のフェーズ別計測と必要な版準備をdevelopへ統合します。[ARCH-EX-010](../docs/architecture-exceptions.md)に従い未公開モデル方針を含めず限定main PRで取り込みます。バッファ復帰の上限2件を維持し、明示停止・再開は各動画最大1件、停止後の安定と再開後の進行・同期を別に確認します。従来の3件目の原因は実測traceで判定し、正常だったと推測しません。既存workflowをinclude_windows=false/publish=falseで実行し、署名済み候補で丸め区間とフェーズ別E2Eを受け入れた後、許可済みpublish=trueで同じ必須ゲートを再実行します。検査失敗・不明の候補は公開しません。

## 0.17.25の時間丸め修正候補

PR #277のnative v2時間丸め修正と必要な版準備のみをdevelopへ先行統合します。[ARCH-EX-009](../docs/architecture-exceptions.md)に従う限定main PRは未公開モデル方針を含めません。既存v0.17.24 tag/配布物は保持します。mainの最終SHA・version0.17.25・未使用tagを照合し、既存workflowをまずinclude_windows=false/publish=falseで実行し、署名済み候補で今回の時間丸めケースを受け入れます。その後、公開が許可された実行をpublish=trueで行い、同じ品質ゲートを再実行します。署名・公証・同一runの配布物検査/E2E/hashを維持し、失敗なら公開しません。ローカル未署名helperの診断を署名済み配布の合格とは扱いません。

## 0.17.24の書き出し・逆再生修正候補

PR #273と必要な版準備をdevelopへ先行統合し、PR #274のARCH-EX-008に従ってmain基点の限定release PRへ取り込みます。未公開event model方針・catalog・lockはmainへ含めません。0.17.24、最終main SHA、未使用tagを照合し、既存workflowを`include_windows=false`で実行します。Windows互換CIは維持し、既存Windows配布物を置換しません。明示的な本人の既存PR統合・リリース指示に基づく準備であり、未実施の実機検査を合格扱いしません。

今回の署名済みrevision 9 hostとdescriptor publicationは同一配布物で検査します。publish=falseでもAppleへの署名アプリ送信を含みます。署名・公証・登録済み配布物E2E・hashの必須ゲートを省略せず、失敗なら公開しません。実機の二画面境界・重い原本の滑らかさ・短尺VideoToolbox・実聴取の残件はRelease noteへ明記します。過去候補の成功を今回の受入へ流用しません。

## 0.17.23の限定修正候補

署名済み0.17.22のIntel runnerでは、ハードウェア必須のVideoToolbox encoderが利用できず書き出しが失敗しました。オフライン書き出しでソフトウェアを許可する修正を0.17.23に含め、[ARCH-EX-007](../docs/architecture-exceptions.md)に従い未公開モデル方針を混ぜずに準備します。既存tagを変更せず、Intel・arm64の署名済み候補の検証と未確認範囲を確認します。

## 0.17.22の限定検証候補

署名・公証済みの0.17.21は未公開のまま保持します。署名済みDMGのCI実行検証を加えた候補は既存tagを変更せず0.17.22とし、[ARCH-EX-006](../docs/architecture-exceptions.md)に従い未公開モデル方針を混ぜずに準備します。CI上の検証と実聴取・実機受入を区別し、必要な受入が未完了なら公開しません。

## 0.17.21の限定修正候補

`v0.17.20` tagは監査停止前に作成されましたが、署名・公証と公開は完了していません。このtagは変更せず保持します。監査修正とrelease準備を先にdevelopへ統合し、[ARCH-EX-005](../docs/architecture-exceptions.md)に従って必要な変更のみをmain基点のrelease branchからmainへPRで取り込みます。未公開event model方針は含めません。修正済み候補の全CI、署名・公証済み配布物の実機受入、依存の由来・ライセンスと配布構成を確認し、未達なら公開しません。

## 0.17.20の限定修正候補

再生・保存修正とrelease準備を先にdevelopへ通常PRで統合し、[ARCH-EX-005](../docs/architecture-exceptions.md)に従ってmain基点のrelease branchへ必要な変更だけを適用してmainへPRを作ります。未公開event model方針は含めず、別のdevelop作業も保持します。mainへ直接pushせず、各PRのレビュー・CIと署名済みアプリの再生・保存・書き出し受入を省略しません。重い素材の逆再生開始待ちは未解決として明記します。公開済み0.17.19・原本・既存プロジェクトを保持します。

main統合後に`v0.17.20` tagを作成しましたが、署名workflowの依存監査で停止しました。署名・公証や公開は行っておらず、このtagを保持したまま上記0.17.21候補で再検証します。

## 0.17.19の限定修正

逆方向キーを離すと要求が消えて開始位置へ戻る退行の修正だけをMacへ配布します。最後に要求した位置への移動を復元します。押下中の画像更新不足、解放後に最大約2.64秒を要した限定実測、未公開Playlist候補の画像更新問題は未解決としてRelease noteへ明記します。公開済み0.17.18とそれ以前の配布物を復旧用に保持しますが、0.17.18には要求消失の退行があるため早戻しの正常版とは扱いません。

修正と0.17.19準備をdevelopへ通常PRで統合した後、[ARCH-EX-003](../docs/architecture-exceptions.md)に従いmain基点の`release/reverse-target-0.17.19`へ該当commitだけを適用し、mainへPRを作ります。未公開event model方針は含めません。以下の既存全ゲートを維持し、main統合後のSHAと未使用`v0.17.19` tagを照合して`version=0.17.19`、`include_windows=false`で既存workflowを実行します。追加credential・料金・権限・セキュリティ設定変更は行いません。

## 0.17.15と公開済み版

0.17.15は再生中核をAVPlayerへ是正し、通常画面の不要なコピー操作・方式表示を撤去するMac向け修正版です。公開済みv0.17.14とv0.17.12のtag・配布物を保持します。公開状態は[GitHub Releases](https://github.com/Kou-ISK/sportaglytics/releases)を確認してください。

修正とrelease準備は先にdevelopへ通常PRで統合します。未公開モデル配布方針を混在させないため、今回もmainを基点とする`release/apple-player-0.17.15`からmainへPRを作り、今回の修正commitだけを適用します。モデル固有lock更新はdevelopに保持し、mainへ持ち込みません。[ARCH-EX-003](../docs/architecture-exceptions.md)に範囲と期限を記録します。mainへの直接push、公開tagの付け替え、同じ公開版への後付けartifactは禁止です。

## MacとWindowsの実行境界

`.github/workflows/release.yml`（**Release desktop**）は既定でMacだけを生成します。`include_windows=true`では同じdispatchのcommitから[`windows.yml`](workflows/windows.yml)を再利用し、Windowsの通常runner・インストール後runnerの全登録シナリオ・CPU MP4 5条件と同梱物の検査を通します。成功した同一runのartifactだけを取得し、source commit/tree、version、実installer hash、同梱media manifestを再照合して両OSを一度に公開します。0.17.15はMacのみの配布として`include_windows=false`を指定します。Windowsの既存配布物は維持し、PR上の既存Windows互換検査は省略しません。以前のCI候補や別versionのinstallerは流用せず、公開済みReleaseへ後付けしません。

Native標準化候補は既存公開versionを再使用せず、main統合後に未使用version/tagを確定します。arm64は`native:build`とmanifestに列挙したAVPlayer資源の検証、Host・Receiver・CommandLeftのDeveloper ID署名、外側app署名、公証、実起動を要求します。署名後も元unsigned manifestと対応sourceを保持します。新defaultの機能・品質受入が未完了なら公開しません。

Macの署名・公証後は、同じrunのarm64 DMGを読み取り専用で開き、隔離したprofileで署名済みアプリの登録済みElectron E2Eを実行します。失敗やDMGのhash不一致は公開を止めます。x64は署名・公証・同梱物の検査のみであり、このCI検査は実聴取や実機・実原本の受入に代わりません。

Macの必須assets:

- `SporTagLytics-<version>-arm64.dmg`
- `SporTagLytics-<version>-x64.dmg`
- `media-tools-sources-<version>-macos.tar.gz`
- `native-playback-sources-<version>-darwin-arm64-<manifest-hash-prefix>.tar.gz`
- `SHA256SUMS.txt`
- `release-verification.json`（この手順の改修以降の新規Release）

`include_windows=true`では`SporTagLytics-Setup-<version>-x64.exe`と`media-tools-sources-<version>-windows.tar.gz`も含め、全配布物を同じSHA256SUMSに記録します。

Mac source bundleは2 targetのmanifestとFFmpeg / FreeType / HarfBuzzの固定sourceを要求します。Windows source bundleは同じrunのインストール済みmedia manifestと、zlibを含む4 sourceを要求します。Macだけを選択した場合はWindows jobとWindows用sourceの取得を省略します。署名後のnative hashと署名前build manifestのhashは別の値です。source bundleは規定のファイルだけを列挙し、uid/gid/mtimeを正規化し、既存出力を上書きしません。生成にはPython 3が必要です。

## 起動方法

tag pushやmain pushでは起動しません。**GitHub Actionsの明示的なworkflow_dispatchだけ**を使います。実行前に、そのversionのReleaseがまだなく、同じworkflowが進行中でないことを確認します。

1. 準備PRとmain向けPRをレビューし、必要なCIを通して統合します。通常は`develop`→`main`、限定release branchを使う場合は、対象版に対して承認された例外の範囲に従います。
2. `main`の40文字SHAと`package.json`のversionを確認し、そのcommitへ`v<version>` tagを作成します。tag作成だけでは署名・Apple送信・公開を開始しません。
3. [Release desktop](https://github.com/Kou-ISK/sportaglytics/actions/workflows/release.yml) → **Run workflow** → branch **main**を選びます。
4. `version`に対象版（今回の候補は`0.17.33`）、`expected_sha`に最終レビュー済みmainの40文字SHAを入力し、`include_windows=false`を指定します。現在の作業branchのSHAを入力しません。
5. `publish=false`（既定）は署名・公証・最終DMG検証まで行い、Actions artifactとして90日間保存します。GitHub ReleaseとHomebrewは更新しません。**これは未署名dry-runではなく、Appleへのアプリ送信を含みます。**
6. 最終公開が承認された実行は`publish=true`を指定します。同じ品質・署名・公証・DMG検証を再実行し、その実行で検査したbytesだけを公開します。先行runのartifactを無検査で流用しません。

CLIでも同じ入力を使います。`REVIEWED_MAIN_SHA` にレビュー済み main の40文字SHAを設定してから実行してください。

```bash
gh workflow run release.yml --ref main \
  -f version=0.17.33 -f expected_sha="$REVIEWED_MAIN_SHA" -F include_windows=false -F publish=false
```

workflowは入力version、package version、tag commit、checkout、workflow commit、現在のorigin/mainを照合します。省略・食い違い・既存Release・API読み取り失敗は停止条件です。公開直前にも再確認します。並行runは直列化し、実行中の署名・公証を新しいdispatchでcancelしません。

## 既存認証の利用

| Secret                                                     | 用途                                                             |
| ---------------------------------------------------------- | ---------------------------------------------------------------- |
| `GITHUB_TOKEN`                                             | Release存在確認と公開。Actionsが提供                             |
| `CSC_LINK`, `CSC_KEY_PASSWORD`                             | 既存Developer ID証明書をCIの一時keychainへ読み込み、アプリを署名 |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | builderからAppleのnotary serviceへ送信                           |
| `HOMEBREW_TAP_TOKEN`                                       | 公開成功後の既存Tap更新                                          |

Windowsは既存CIと同じ認証なしのbuildを使用し、実Authenticode状態を検査reportとRelease noteへ記載します。`NotSigned`を署名済みと表現しません。新しいWindows署名証明書や契約はこの手順では取得しません。

公開本文は`scripts/desktop-release-notes.mjs`が再照合済みの`windows-release.json`から生成し、`NotSigned`は「未署名」、`Valid`は「Authenticode署名を検証済み」と明記します。未知の状態では公開を停止します。E2E件数は本文へ固定せず、成功した同一runの全シナリオとログを根拠にします。日本語に隣接したshell変数のロケール依存解釈を避け、UTF-8ファイルを`gh release create --notes-file`へ渡します。

Macは既存`release.yml`と同じ認証方式です。正規の本番実行権限がある担当者は既存Secretsをworkflow内で消費できます。秘密の値をチャット・ローカルMacへ抽出したり、新しく入力・送信したりする手順は不要です。秘密の有効性は実行結果で確認し、値をログへ出しません。Tapのtokenはcheckout actionへ渡し、clone URLへ埋め込みません。

既存Secretsが不足・失効している場合は失敗したstepとsecret名だけを報告します。新規credential、証明書発行、権限拡張、Apple契約への同意、ローカルkeychain ACL変更をこのworkflow準備の一部として追加しません。既存credentialを利用するCIの一時keychain操作と、利用者Macのcredential/security変更を混同しません。

署名は`forceCodeSigning=true`、公証は`mac.notarize=true`を必須にします。`--publish never`はbuilder自身の公開を抑止しますが、Apple送信を抑止しません。署名する対象はhardened runtimeと既存entitlementsを使うアプリです。builderは署名済み`.app`をZIPとしてAppleへ送信し、成功したticketをアプリへstapleしてからDMGを作ります。既存設定の`dmg.sign`は未設定（既定false）なので、DMG container自体が署名済みとは表現しません。

## 公開前のゲート

1. lockfile固定install、full / production audit、型、lint、境界、design-system、ADR、unit、Storybookをすべて通します。
2. renderer / Electron / preloadをbuildし、Mac 2 targetのmedia toolsとllama runtimeを準備します。
3. `E2E_LLAMA_MODEL`と検証済みテストモデルを使ってMacの全Electron E2Eを通します。変数なしのローカル検査はnative AIまで通った扱いにしません。テスト用GGUFは配布物へ含めません。
4. Release専用の`afterPack`が署名前に、ASAR全fileと生成buildの同一性、モデル2配置の固定SHA、WASM、アプリ/JS/nativeの告知、media/llamaのmanifestとnative hashを検査します。通常の`afterPack`検査も引き続き実行します。
5. 現行Mac Releaseはevent packなしです。ASAR/ResourcesのGGUF・私有pack・未知の重みを拒否します。Paintの既製EfficientDet-Lite2は含まれるため、「モデルを含まない」とは表現しません。素材の権利確認は[由来の確認台帳](../docs/provenance-review.md)で別途レビューします。
6. `scripts/macos/verify-dmg.mjs`が最終DMGをread-onlyでmountします。全Mach-Oのarchitecture / Developer ID / hardened runtime / timestamp、strict署名、stapler、Gatekeeperの`Notarized Developer ID`判定、バージョン、実Resources/ASARの告知・モデル・hashを確認します。署名前reportと同梱payloadの一致も確認します。
7. 対応source archive、公開用検証要約、SHA256SUMSを生成してActions artifactに保存します。`publish=true`のときだけ、新規Release作成とHomebrew更新へ進みます。

`scripts/release-verification-summary.mjs`は最終DMG reportの両architecture・version・source SHA・署名検査件数・公証・staple・Gatekeeper・payload一致を要求し、実際のDMG bytesのSHA256と照合します。Windowsを含むときは検証済みinstallerのsource commit/tree、実bytes、署名状態も照合します。`release-verification.json`には許可した検証値、配布物hash、source commit/tree、Actions run URLだけを保存し、raw log、署名者の個人名、runnerの絶対path、環境変数を転記しません。要約自体もSHA256SUMSに含め、新規Releaseのassetとして残します。

このJSONは配布reportの要約であり、独立したattestationやunit/E2Eの再実行ではありません。品質・E2Eの結果はリンク先の同一workflowで確認します。詳細reportを含むActions artifactの保持は90日、公開要約はReleaseのassetとして保持します。既存v0.17.10以前へ後付けしません。GitHubのRelease immutabilityやbranch protectionを設定する処理は含めず、これらの管理者設定は別途確認・判断します。

どれか失敗した候補、未公証候補、検証省略のDMGを一般利用者向け完成Releaseとして扱いません。署名・公証の成功は法的な権利安全性や実機での全操作を保証しません。初回のこのworkflow変更は、本番署名・公証と最終DMGのCI成功が得られるまで「手順準備済み」と「配布検証済み」を区別します。

## 未署名のローカル候補

未署名検査ではworkflowを起動せず、別checkoutとfresh出力を使用します。source外の候補設定に`publish: null`、`mac.identity: null`、`mac.notarize: false`、`forceCodeSigning: false`を明示します。署名自動検出とcredential import用環境変数を無効にし、`--publish never`を指定します。`verify-dmg.mjs`は未署名/未公証アプリを意図的に拒否します。

## 公開後と復旧

0.17.23から戻す場合は、公開済みv0.17.19の同じarchitectureのDMGとSHA256SUMSを取得・照合し、未保存作業を保護してアプリを通常終了した後、既存のインストール管理方法でアプリ本体だけを差し替えます。project・原本・preferencesと公開済み配布物は削除しません。

0.17.18へ戻すと早戻し要求が消える退行も戻るため、早戻しの復旧策とは扱いません。ほかの問題で0.17.19から戻す場合は、公開済みv0.17.18の同じarchitectureのDMGとSHA256SUMSを取得・照合し、未保存作業を保護してアプリを通常終了した後、既存のインストール管理方法でアプリ本体だけを差し替えます。project・原本・preferencesは削除/初期化しません。Homebrew管理のインストールはCaskroomと二重配置にならないよう既存管理と整合させ、公開tagやassetを変更しません。

- GitHub Releaseの全配布物とSHA256SUMSを取得し、公開bytesとActionsの検証reportのhashを照合します。両OS公開ではWindows installerとWindows source archiveも対象です。
- Homebrew Caskのarm64/x64のhashを照合し、clean macOSでインストール・起動・`.stpkg`/`.stpl`/`.stcw`/`.stad`関連付けを確認します。
- Homebrew livecheckは、draft/prereleaseを除き、両Mac DMGのassetがあるReleaseだけを選びます。後のWindows専用ReleaseをMacの最新版として選びません。
- Homebrew更新だけ失敗した場合は、公開済みDMGと確認済みhashからTapを復旧します。workflow全体を再実行して既存Releaseを作り直しません。
- version変更やsource修正が必要なら、新しい版を準備します。初回E2E/署名/公証の失敗を回避するための省略フラグは設けません。

builderの一時keychain unlock失敗では、既存の証明書パスワードと一時keychainのパスワードを取り違えないよう実行ログと固定builder版を確認します。electron-builder 26.16.1は[upstream #10172](https://github.com/electron-userland/electron-builder/pull/10172)の修正版です。secret値を露出させたり、署名を省略したりして回避しません。

Macのelectron-builder publisherは`mac.publish: null`で明示的に無効化する。`--publish never`だけでは既存GH_TOKENから更新用`app-update.yml`が自動生成されるため、DMG出力そのもので署名前の同梱物検査を実行する。公開は検証後の既存`gh release create`工程だけで行い、同梱物の許可リストは緩めない。
