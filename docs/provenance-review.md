# コード・資産の由来と公開前の確認

この台帳は2026-10-11時点の確認状態です。基準は公開版 [v0.17.4](https://github.com/Kou-ISK/sportaglytics/releases/tag/v0.17.4)（commit `ab89af2a50721acf1a4183a3cf3d7a8de270f8fc`）。アプリのMIT Licenseだけで、第三者コード・画像・データ・モデル・binaryの権利が確認済みになるわけではありません。法的な適法性の保証や、他社との提携・許諾の表明ではありません。

## 互換形式・参照資料・独自機能を区別する

- **形式名としてのSportscode**: [XML取り込みの対応subset](package-compatibility.md#sportscode-xmlから新規作成)は公開マニュアルを参照し、アプリ側のparserと合成fixtureで実装・検証しています。native `.scpkg` / `.sczip` の解析・生成や全機能の互換を意味しません。
- **SCTimeline JSON**: [converterの範囲](sctimeline-implementation.md)で扱うJSONです。外部Sportscode実機との往復は未検証で、完全なバックアップは `.stpkg` を使用します。
- **自アプリの操作説明**: 図形描画、ボタン間のリンク、記録前後の秒数、行の名称・色・順序は実際の操作と保存内容で説明します。「準拠」「完全互換」等の表現で検証範囲を広げません。
- **比較・参照の記録**: [design system](design-system.md)、[角度同期](angle-synchronization.md)、[Code Window](code-window-settings.md)、既存ADRの参照資料は設計の経緯として残します。用語を直しても過去の参照経緯や契約・権利の確認が済んだことにはなりません。

## 資産台帳

| 対象                                       | 確認できる根拠                                                                                                                            | 未確認・次の対応                                                                                                                 |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| アプリコード                               | [MIT License](../LICENSE)、公開Gitの実装・変更履歴                                                                                        | 各寄与者の権原、第三者コード/資料の流用の有無を提出者が確認。AI生成という理由で独自性を認定しない                                |
| renderer/preload npm依存・MUIアイコン      | [配布告知](../THIRD_PARTY_NOTICES.md)、build由来のlicense inventory。v0.17.4の3配布物でrenderer 76依存、preload 0依存の告知を確認         | npmの宣言と告知の存在を確認した範囲。全native依存を含むSBOMではない                                                              |
| アプリ・ファイルアイコン                   | `public/icon.png` / `.svg` / `.icns` / `.ico`、`public/icons/`、[変換手順](custom-file-icons.md)                                          | 原作者、元素材、取得/生成ツール、適用条件、改変履歴は未確認。変換手順や見た目だけで許諾済みとしない                              |
| Reactロゴ                                  | `src/logo.svg`                                                                                                                            | 正確な取得元・版・権利表示を確認。利用の必要性も別途判断                                                                         |
| 文書画像・fixture動画                      | 現行の[UX評価](reports/2026-10-ux-review.md)は合成映像・架空名を記録。`src/features/playlist/fixtures/tactics-motion.webm` は合成パターン | 全素材の作者・生成recipeを台帳化。画像全pixelや過去添付物の確認は未完了                                                          |
| 同梱フォント                               | [prepare-fonts.mjs](../scripts/prepare-fonts.mjs)のNoto Sans CJK JPとOFL。Windows配布のhashを照合                                         | OS提供フォントとは区別。追加フォントは個別に条件を確認                                                                           |
| Paint用モデル・MediaPipe                   | [NOTICE](../resources/pitch-vision/NOTICE.md)の固定版/hashとApache告知、v0.17.4の3配布物の重みhashが一致                                  | 上流モデルの条件と学習画像の条件を同一視しない。詳細は[モデル台帳](model-distribution.md)                                        |
| 外部event pack・学習データ                 | 現行Git・v0.17.4配布物にevent packや学習映像は含まれない                                                                                  | 私有packのcheckpoint、学習素材の権限、runner依存、評価recipeは管理者が別途確認。比較候補のlicenseを採用packのlicenseとみなさない |
| GGUF                                       | 製品に重みを同梱しない。CI試験用の取得版は `scripts/prepare-test-model.mjs` に固定                                                        | 利用者が別途選ぶモデルの条件は個別確認                                                                                           |
| llama.cpp                                  | 現行b7849、3配布物にMIT本文。WindowsにはJSON依存の告知も存在                                                                              | macOSの選択的コピー、推移依存の告知対応、過去版は下記を確認                                                                      |
| FFmpeg・FreeType・HarfBuzz・OpenH264・zlib | v0.17.4の同版Releaseに固定source、recipe、3 targetのmanifest。配布物と照合済み。詳細は[配布手順](third-party-distribution.md)             | macOS署名差分・バイト再現build、compiler runtime、各codecの条件は未確認。別process呼出しとFFmpeg内部のstatic linkを区別          |
| Electron / Chromium                        | v0.17.4の各配布物に告知を確認                                                                                                             | 全内包依存の独立照合、OS上の署名・公証の再検証は別工程                                                                           |

## 過去配布物の補足状況

現在の告知生成を直しても、過去の配布物が自動的に補完されるわけではありません。既存Releaseやtagを書き換えず、対象commit、配布物のSHA-256、source版/hash、実際のbuild manifestを照合した補足物を準備します。公開前に対象・不足・補完範囲と残る制限をレビューします。

| 対象                                                                                                                                     | 確認した不足                                                                                                                                                                                              | 補完に必要な根拠・状態                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [v0.17.3](https://github.com/Kou-ISK/sportaglytics/releases/tag/v0.17.3) / `a2daca8efc6c2753018e0df397b5b9d52427504c`                    | 公開assetはDMG 2本、NSIS 1本、SHA256SUMSのみ。media対応source attachmentなし。3配布物のmedia告知にFreeType FTL本文なし                                                                                    | 3配布物をchecksum照合し、埋込manifestのsource版/hashをtagのrecipeと照合。Windows ffmpeg/ffprobeはmanifestのbinary hashにも一致。macOSは署名前hashと配布hashが異なり、署名差分・再現buildは未検証。v0.17.4のmanifestを旧版の代用にしない |
| 同v0.17.3のJS告知                                                                                                                        | [旧builder設定](https://github.com/Kou-ISK/sportaglytics/blob/a2daca8efc6c2753018e0df397b5b9d52427504c/electron-builder.json#L9)は `build/**/*.LICENSE.txt` を除外。現在のbundle由来inventory方式の導入前 | 当時のbundle・依存版・既存告知を個別照合する必要あり。現行inventoryをそのまま旧版の告知として公開しない                                                                                                                                 |
| [v0.8.0](https://github.com/Kou-ISK/sportaglytics/tree/df1c551f685dd948b13a2e71a1c07d4bd4740373/public/llama/darwin) のGit内llama binary | CLI・dylibに対するllama由来のlicense/NOTICEを同tagのtreeに確認できない。アプリLICENSEとは別問題                                                                                                           | 26 path（10種のblob）が、SHA-256固定の公式b7849 macOS arm64 archive内の実ファイルと全件一致。同archiveからMIT本文を補足候補として準備。同archiveに依存別の告知はなく、推移依存の対応確認と補足公開は未実施                              |

この文書の追加は旧Releaseへのsource/NOTICE添付、配布物の差替え、法的な対応完了を意味しません。

## 管理者が非公開で確認する事項

1. Hudl/Sportscodeを参照した人、アカウントの利用有無、契約主体、同意した条項の版・時期、学校/所属組織の契約範囲は何か。公開Web資料だけの参照か、契約内の画面・機能・資料も使ったか。
2. [design systemの参照資料](https://github.com/Kou-ISK/sportaglytics/blob/ab89af2a50721acf1a4183a3cf3d7a8de270f8fc/docs/design-system.md#L257)、[同期仕様](https://github.com/Kou-ISK/sportaglytics/blob/ab89af2a50721acf1a4183a3cf3d7a8de270f8fc/docs/angle-synchronization.md#L65)、[Code Window](https://github.com/Kou-ISK/sportaglytics/blob/ab89af2a50721acf1a4183a3cf3d7a8de270f8fc/docs/code-window-settings.md#L84)の閲覧・取得元は何か。ソース、画像、動画、ヘルプ本文、独自デザイン資産をコピーまたはAIへ入力したか。
3. アプリ/ファイルアイコンの原作者・元画像・生成/取得ツール・当時の利用条件・第三者商標との関係を示す記録はあるか。
4. 未公開event packの重み/学習素材/runnerとモデル契約を管理者側で照合できるか。公開できるメタデータと私有情報の境界はどこか。

契約原本、会話ログ、秘密、実試合名、ローカル絶対パス、私有モデルの内部台帳を公開Issue/PRへ貼りません。必要な公開再現例は架空のチーム名・相対パス・合成映像で作成します。脆弱性は [SECURITY.md](../SECURITY.md)、データ取扱いは [privacy guide](privacy-and-data-handling.md#sharing-and-issue-reports) に従います。

弁護士へ確認する具体事項は、実際に適用される契約と参照行為の関係、表現・画面・資料の複製や翻案、名称の使い方、素材の許諾、native依存/codecと過去配布への是正方法です。この台帳はそのための技術的根拠を整理するもので、契約の適用や権利侵害の有無を判定しません。
