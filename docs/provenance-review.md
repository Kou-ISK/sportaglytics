# コード・資産の由来と公開前の確認

現行配布の再確認日は2026-10-18です。基準は公開版 [v0.17.10](https://github.com/Kou-ISK/sportaglytics/releases/tag/v0.17.10)（commit `62277574190bd86b6de9bfb8c944ad0bf316b14b`）と[配布検証run 39081921565](https://github.com/Kou-ISK/sportaglytics/actions/runs/39081921565)です。過去のv0.17.4実査や2026-10-12の補足公開は、対象を明示して記録を保持します。sourceの変更と公開済みinstallerの状態を分けます。

アプリのMIT Licenseだけで、第三者コード・画像・データ・モデル・binaryの権利が確認済みになるわけではありません。法的な適法性の保証や、他社との提携・許諾の表明ではありません。

## 互換形式・参照資料・独自機能を区別する

- **形式名としてのSportscode**: [XML取り込みの対応subset](package-compatibility.md#sportscode-xmlから新規作成)は公開マニュアルを参照し、アプリ側のparserと合成fixtureで実装・検証しています。native `.scpkg` / `.sczip` の解析・生成や全機能の互換を意味しません。
- **SCTimeline JSON**: [converterの範囲](sctimeline-implementation.md)で扱うJSONです。外部Sportscode実機との往復は未検証で、完全なバックアップは `.stpkg` を使用します。
- **自アプリの操作説明**: 図形描画、ボタン間のリンク、記録前後の秒数、行の名称・色・順序は実際の操作と保存内容で説明します。「準拠」「完全互換」等の表現で検証範囲を広げません。
- **比較・参照の記録**: [design system](design-system.md)、[角度同期](angle-synchronization.md)、[Code Window](code-window-settings.md)、既存ADRの参照資料は設計の経緯として残します。用語を直しても過去の参照経緯や契約・権利の確認が済んだことにはなりません。

<a id="次版候補の確認状態"></a>

## 現行配布と次版候補の確認状態

公開Git、Release、配布検証の証跡から確認できる範囲です。2026-10-18の独自アイコンのAI生成申告は、申告であることを明記します。未提供の契約、生成ログ、アカウント状態を推測して補いません。

| 対象                               | 確認できる事実                                                                                                                                                                                                                                                       | 残る判断・完了条件                                                                                                                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 独自アイコン・画像・fixture        | [asset inventory](asset-inventory.json)の26ファイルはdevelop `ee66eb8`でも全hash一致。アイコンはAI生成との利用者申告あり。13画像は合成映像・架空データの自アプリ画面、動画fixtureも合成パターン                                                                      | [申告の範囲](asset-provenance.md#独自アイコンの申告と根拠の範囲)と原資料の照合を区別する。独自アイコンの生成サービス・入力・時期・条件と各派生物の対応、旧動画fixtureの原recipeは未確認。確認できなければ対象を限定した置換案をレビューする |
| 旧SCTimeline JSON exportと参照資料 | [2025-11-21の導入記録](https://github.com/Kou-ISK/sportaglytics/blob/d63f570a853dd008fa6093858e2d45ea8511fa61/docs/sctimeline-implementation.md#L188)に実ファイル構造を分析した記述がある。現行converterの対応範囲は[仕様](sctimeline-implementation.md)に限定される | 当時のsample・資料の取得経路と、実際に適用される条件の有無・版・主体を確認する。現時点のWeb規約を当時の契約と推定しない。必要な契約・複製/翻案・名称の判断は専門家へ確認する。古い識別情報を再掲載せず履歴は保持する                        |
| Paintの同梱重み                    | 2026-10-14に[公式INT8配布物と固定revision 1のbytes/hash、上流のモデル許諾説明](model-distribution.md#paintの固定重みと上流許諾の照合)を照合。v0.17.10の配布検証でも固定hashとNOTICEを確認                                                                            | Kaggleの別variantを根拠にした対応未確認は解消済み。Apache-2.0告知を維持する。上流の一般説明と個別保証、重みと学習画像の条件は区別する                                                                                                       |
| event pack・GGUF                   | v0.17.10の最終Mac DMGとWindows installed検証でevent pack/GGUFなしを確認。Paint重みは同梱                                                                                                                                                                             | 私有packの公開・Apple送信は、このアプリ配布とは別に由来・契約・送信対象を承認する。通常アプリの未許諾event pack混入と、未配布packの未確認事項を混同しない                                                                                   |
| native告知と対応source             | macOS llama告知とWindows compiler/runtime告知の修正はv0.17.10に含まれ、同版の配布runで本文・hash・manifestを検査。OS別の対応source archiveとSHA256SUMSを同Releaseで公開済み                                                                                          | 今後も最終配布物と同じ版・targetのsource/manifestを照合する。現版の修正を過去v0.17.4 installerへ遡及させない。codec/runtime exception・全推移依存の条件確認は[配布手順](third-party-distribution.md)の限界を維持する                        |
| OS別配布検証                       | v0.17.10のMacアプリは署名・公証済みで最終DMGを検査。Windows x64は未署名で同じcommitからのinstalled検証済み                                                                                                                                                           | 署名・公証は権利審査を代替しない。Windows N実機・実カメラ・全利用者環境の保証ではない。OS条件は[導入案内](../README.md#インストール)を参照                                                                                                  |

公開前の判断は、対象を上記のファイル・重み・形式・配布物へ限定して記録します。source/告知の整合確認、由来・適用条件の判断、対応OSのGUI/配布検証、署名・公証は別の確認です。未解決の対象について継続利用・置換・除外の判断が揃うまで、正式Releaseの起動へ進みません。署名や公証の成功も権利確認を代替しません。

## 資産台帳（過去実査を含む）

下表でv0.17.4を指定した値は当時の実査です。現行v0.17.10で解消した告知不足・署名検証を未確認へ戻すものではありません。現在の配布状態は上表を参照してください。

画像・アイコン・fixtureの対象ファイルと出典の追確認は[素材の由来記録](asset-provenance.md)を参照してください。公開Gitで確認できる事実と、未確認の取得条件を分けて記録しています。

| 対象                                       | 確認できる根拠                                                                                                                            | 未確認・次の対応                                                                                                                   |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| アプリコード                               | [MIT License](../LICENSE)、公開Gitの実装・変更履歴                                                                                        | 各寄与者の権原、第三者コード/資料の流用の有無を提出者が確認。AI生成という理由で独自性を認定しない                                  |
| renderer/preload npm依存・MUIアイコン      | [配布告知](../THIRD_PARTY_NOTICES.md)、build由来のlicense inventory。v0.17.4の3配布物でrenderer 76依存、preload 0依存の告知を確認         | npmの宣言と告知の存在を確認した範囲。全native依存を含むSBOMではない                                                                |
| アプリ・ファイルアイコン                   | `public/icon.png` / `.svg` / `.icns` / `.ico`、`public/icons/`、[変換手順](custom-file-icons.md)                                          | AI生成との利用者申告あり。生成サービス・時期・入力と適用条件、原生成物と各形式の対応は未照合。変換手順や申告だけで許諾済みとしない |
| Reactロゴ                                  | 旧 `src/logo.svg`（初期テンプレートの未使用ファイル）                                                                                     | source/configに参照がないことを確認して現行treeから除去。過去tagは保持し、過去の権利確認を済んだとは扱わない                       |
| 文書画像・fixture動画                      | 現行の[UX評価](reports/2026-10-ux-review.md)は合成映像・架空名を記録。`src/features/playlist/fixtures/tactics-motion.webm` は合成パターン | 全素材の作者・生成recipeを台帳化。画像全pixelや過去添付物の確認は未完了                                                            |
| 同梱フォント                               | [prepare-fonts.mjs](../scripts/prepare-fonts.mjs)のNoto Sans CJK JPとOFL。Windows配布のhashを照合                                         | OS提供フォントとは区別。追加フォントは個別に条件を確認                                                                             |
| Paint用モデル・MediaPipe                   | [NOTICE](../resources/pitch-vision/NOTICE.md)の固定版/hashとApache告知、v0.17.4の3配布物の重みhashが一致                                  | 上流モデルの条件と学習画像の条件を同一視しない。詳細は[モデル台帳](model-distribution.md)                                          |
| 外部event pack・学習データ                 | 現行Git・v0.17.4配布物にevent packや学習映像は含まれない                                                                                  | 私有packのcheckpoint、学習素材の権限、runner依存、評価recipeは管理者が別途確認。比較候補のlicenseを採用packのlicenseとみなさない   |
| GGUF                                       | 製品に重みを同梱しない。CI試験用の取得版は `scripts/prepare-test-model.mjs` に固定                                                        | 利用者が別途選ぶモデルの条件は個別確認                                                                                             |
| llama.cpp                                  | 現行b7849、3配布物にMIT本文。WindowsにはJSON依存の告知も存在                                                                              | macOSの選択的コピー、推移依存の告知対応、過去版は下記を確認                                                                        |
| FFmpeg・FreeType・HarfBuzz・OpenH264・zlib | v0.17.4の同版Releaseに固定source、recipe、3 targetのmanifest。配布物と照合済み。詳細は[配布手順](third-party-distribution.md)             | macOS署名差分・バイト再現build、compiler runtime、各codecの条件は未確認。別process呼出しとFFmpeg内部のstatic linkを区別            |
| Electron / Chromium                        | v0.17.4の各配布物に告知を確認                                                                                                             | 全内包依存の独立照合、OS上の署名・公証の再検証は別工程                                                                             |

## 改善の優先順位と完了条件

以下は作業の優先順位です。確認済みの事実と、対応を完了した状態を分けます。ゲートの追加だけで権利確認を完了扱いにしません。

| 優先 | 対象                    | 現状・実装済みの対策                                                                                        | 完了条件・次の判断                                                                                                                                 |
| ---- | ----------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0   | Event packの新規同梱    | 現行公開Git/v0.17.10にevent重みなし。[配布前ゲート](event-pack-provenance.md)で未記録・未承認・不整合を拒否 | 実packの基盤checkpoint→派生重み→runnerを照合し、利用条件・学習データ権限・依存告知を管理者が確認。公開可能な記録と最終配布hashが揃うまで同梱を保留 |
| P1   | 既存Release             | v0.17.3対応source/FTL、v0.8.0 llama.cpp MIT告知と各専用checksumを2026-10-12に追記公開済み                   | 公開downloadのSHA-256/bytesを照合済み。過去JS/native推移依存の告知、全旧installerの網羅性、法的充足性は未確認                                      |
| P1   | 画像・アイコン・fixture | 変換手順と一部の合成recipe、独自アイコンのAI生成申告を記録。生成サービス・入力素材・適用条件は未照合        | 各元素材の出典、取得/生成日・ツール条件、改変履歴、公開範囲を記録。確認できない素材は機能・外観への影響をレビューして置換等を判断                  |
| P1   | 互換形式・参照資料      | XML subset・SCTimeline変換と検証範囲を明記。全機能互換を表す文言を修正                                      | 使用資料・出力sampleの取得経路と適用契約を確認し、実在データを含まないfixtureで対応範囲を固定。契約解釈は専門家へ確認                              |
| P2   | コード・npm・native依存 | MIT、build由来npm告知、対応media source/manifestのゲートあり                                                | 新規寄与の出典レビューを継続。native推移依存・compiler runtime・macOS署名差分まで配布単位で対応付け。ライセンス宣言だけを完全SBOMと扱わない        |
| P2   | 再現性・AI変更レビュー  | AGENTSの優先関係、固定pnpm、共通ゲート、人の確認責任を整合                                                  | 公開cloneで通常build/合成試験が再現でき、OS別配布検証を完了。私有R&Dなしでは再学習不能である境界を維持                                             |

公開継続の技術的判断は、現在のアプリコード・event packを同梱しない配布と、新たな重み/素材の公開を分けて行います。新たな権利侵害・秘密混入等の具体的証拠が出た場合は、その対象と影響範囲を確認して対応します。ここで公開の法的安全を保証せず、未確認を理由なく「問題なし」へ変更しません。

## 過去配布物の補足状況

現在の告知生成を直しても、過去の配布物が自動的に補完されるわけではありません。対象commit、配布物のSHA-256、source版/hash、実際のbuild manifestを照合した補足物を2026-10-12に追記公開しました。元installer・元checksum・tagを保持し、Release本文末尾に範囲と制限を追記しています。本文はWeb UIによるLF→CRLF変換があり、改行正規化後に旧本文＋承認済み追記との一致を確認しました。

| 対象                                                                                                                                     | 確認した不足                                                                                                                                                                                              | 補完に必要な根拠・状態                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [v0.17.3](https://github.com/Kou-ISK/sportaglytics/releases/tag/v0.17.3) / `a2daca8efc6c2753018e0df397b5b9d52427504c`                    | 元配布時はmedia対応source attachmentとmedia専用告知のFreeType FTL本文が不足。2026-10-12に対応source/FTLと専用checksumを追加。元installer自体は変更なし                                                    | 3配布物をchecksum照合し、埋込manifestのsource版/hashをtagのrecipeと照合。Windows ffmpeg/ffprobeはmanifestのbinary hashにも一致。macOSは署名前hashと配布hashが異なり、署名差分・再現buildは未検証。v0.17.4のmanifestを旧版の代用にしない                                                                                   |
| 同v0.17.3のJS告知                                                                                                                        | [旧builder設定](https://github.com/Kou-ISK/sportaglytics/blob/a2daca8efc6c2753018e0df397b5b9d52427504c/electron-builder.json#L9)は `build/**/*.LICENSE.txt` を除外。現在のbundle由来inventory方式の導入前 | 当時のbundle・依存版・既存告知を個別照合する必要あり。現行inventoryをそのまま旧版の告知として公開しない                                                                                                                                                                                                                   |
| [v0.8.0](https://github.com/Kou-ISK/sportaglytics/tree/df1c551f685dd948b13a2e71a1c07d4bd4740373/public/llama/darwin) のGit内llama binary | CLI・dylibに添える独立したllama由来のLICENSE/NOTICEファイルを同tagのtreeに確認できない。CLI内の埋込告知とは区別する                                                                                       | 26 path（10種のblob）が、SHA-256固定の公式b7849 macOS arm64 archive内の実ファイルと全件一致。同archiveのMIT本文と照合記録・専用checksumを2026-10-12に追記公開済み。同archiveに独立した依存別LICENSEファイルはないが、CLIにはJSON・cpp-httplib・BoringSSLの告知全文を確認。全推移依存の完全性と全旧installerの実査は未確認 |

公開補足は [v0.17.3 media source/FTL](https://github.com/Kou-ISK/sportaglytics/releases/download/v0.17.3/media-tools-sources-0.17.3-supplement-2026-10-12.tar.gz)（[専用SHA256SUMS](https://github.com/Kou-ISK/sportaglytics/releases/download/v0.17.3/SUPPLEMENT-SHA256SUMS-v0.17.3-2026-10-12.txt)）と [v0.8.0 llama.cpp MIT/照合記録](https://github.com/Kou-ISK/sportaglytics/releases/download/v0.8.0/llama-v0.8.0-notice-supplement-2026-10-12.tar.gz)（[専用SHA256SUMS](https://github.com/Kou-ISK/sportaglytics/releases/download/v0.8.0/SUPPLEMENT-SHA256SUMS-v0.8.0-2026-10-12.txt)）です。新4ファイルのdownload bytes/hash、旧6 assetのID・名前・size・digest、元v0.17.3 checksumのbytes、両tagのobject/commitを照合しました。

この補足は、過去の全JS/native依存の告知、macOSのバイト再現build、compiler runtime/codec条件や法的な遡及充足性を確認したものではありません。v0.8.0の照合対象はGit内26 path（10 blob）で、全installerを代表しません。古い版はcomponent・recipe・artifact hashの変更単位で対象を絞って確認します。

## 管理者が非公開で確認する事項

1. Hudl/Sportscodeを参照した人、アカウントの利用有無、契約主体、同意した条項の版・時期、学校/所属組織の契約範囲は何か。公開Web資料だけの参照か、契約内の画面・機能・資料も使ったか。
2. [design systemの参照資料](https://github.com/Kou-ISK/sportaglytics/blob/ab89af2a50721acf1a4183a3cf3d7a8de270f8fc/docs/design-system.md#L257)、[同期仕様](https://github.com/Kou-ISK/sportaglytics/blob/ab89af2a50721acf1a4183a3cf3d7a8de270f8fc/docs/angle-synchronization.md#L65)、[Code Window](https://github.com/Kou-ISK/sportaglytics/blob/ab89af2a50721acf1a4183a3cf3d7a8de270f8fc/docs/code-window-settings.md#L84)の閲覧・取得元は何か。ソース、画像、動画、ヘルプ本文、独自デザイン資産をコピーまたはAIへ入力したか。
3. AI生成と申告されたアプリ/ファイルアイコンについて、原画像、生成サービス・版・時期、入力素材、当時の利用条件と各派生ファイルの対応を示す記録はあるか。第三者商標との関係を確認するための資料はあるか。
4. 未公開event packの重み/学習素材/runnerとモデル契約を管理者側で照合できるか。公開できるメタデータと私有情報の境界はどこか。

契約原本、会話ログ、秘密、実試合名、ローカル絶対パス、私有モデルの内部台帳を公開Issue/PRへ貼りません。必要な公開再現例は架空のチーム名・相対パス・合成映像で作成します。脆弱性は [SECURITY.md](../SECURITY.md)、データ取扱いは [privacy guide](privacy-and-data-handling.md#sharing-and-issue-reports) に従います。

弁護士へ確認する具体事項は、実際に適用される契約と参照行為の関係、表現・画面・資料の複製や翻案、名称の使い方、素材の許諾、native依存/codecと過去配布への是正方法です。この台帳はそのための技術的根拠を整理するもので、契約の適用や権利侵害の有無を判定しません。

v0.17.10のWindows H.264は[Media Foundationへ移行済み](adr/0062-windows-media-foundation-h264.md)です。上表のv0.17.4でのOpenH264照合は過去配布物についての記録です。自前buildにCisco提供binaryの特許料カバーが適用されるという確認ではありません。現版は更新したsource/recipe/noticeを配布し、[Windows Nの追加要件](windows.md#対象と導入)を明示しています。Windows N実機の未導入/導入後の検証は未完了です。

### 未公開native playback helper

macOS arm64限定候補のhelper/IOSurface receiverは本作業で作成したsourceを必要依存だけ移植し、MIT本文と全sourceを保持します。固定FFmpeg 8.1.2（LGPL 2.1 or later構成）をhelperへstatic linkし、Node 22.12.0 N-API headerと公式LICENSEを使用します。上流URL/hash、全source/header/recipe、compiler/SDK、成果物、NOTICEを専用manifestで対応づけます。[対応ソースと再link手順](third-party-distribution.md#native-playback-previewの対応ソース)。通常配布への有効化・署名後artifact・可聴品質・全ライセンス/codec条件は別確認であり、未公開候補のbuild成功で完了扱いにしません。
