# AIモデルの公開範囲・配布台帳

配布状態の再確認日: 2026-10-18。基準は公開版 [v0.17.10](https://github.com/Kou-ISK/sportaglytics/releases/tag/v0.17.10)、commit `62277574190bd86b6de9bfb8c944ad0bf316b14b`と[同版の配布検証run](https://github.com/Kou-ISK/sportaglytics/actions/runs/39081921565)です。Paintの固定重みと許諾根拠は2026-10-14に照合済みで、下記の記録を維持します。sourceのstaging状態と実配布物を区別します。この文書は外部event packの公開宣言ではありません。個々の重みの許諾を、アプリのMIT Licenseから推定しないでください。

## 公開範囲

| 対象                     | 現在の公開・配布範囲                                                                                                                | ライセンスと取得先                                                                                                              |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| アプリ                   | UI、IPC、推論の呼出し、model pack検証、ビルド手順                                                                                   | [MIT](../LICENSE)、[ソースとRelease](https://github.com/Kou-ISK/sportaglytics)                                                  |
| イベント検出R&D          | データ準備・学習・評価・exportはprivate R&D。公開側はpack consumer                                                                  | [ADR 0023](adr/0023-external-rugby-event-model-rd-boundary.md)。アプリだけでは再学習できない                                    |
| イベント検出重み・runner | 外部packを利用。追跡対象は`.gitkeep`のみ。[v0.17.10の配布検証](provenance-review.md#現行配布と次版候補の確認状態)でもevent packなし | 公開配布元、現行packのhash、基盤checkpointと重みlicenseは未確認。取得可能な公式pack URLを現時点では案内できない                 |
| Paintの俯瞰配置          | 既製EfficientDet-Lite2 INT8 revision 1とMediaPipe Tasks Vision 0.10.21をビルド時に同梱                                              | Apache-2.0、[NOTICEとモデルURL](../resources/pitch-vision/NOTICE.md)、[hash固定の取得手順](../scripts/prepare-pitch-vision.mjs) |
| 文章AI                   | llama.cpp runtimeを配布し、GGUF重みは利用者が選択・配置                                                                             | runtimeはMIT。重みは配布元ごとの条件。[導入手順](ai-analysis.md)                                                                |
| CIの文章AI               | Qwen2.5-0.5B-Instruct-GGUFの固定revision/量子化をテストだけに取得                                                                   | [取得URL・revision・SHA-256](../scripts/prepare-test-model.mjs)。アプリ配布物へ含めない                                         |
| 学習動画・Coding・frames | アプリrepo・Releaseに学習用データセットとして公開しない                                                                             | 私的利用の許可を再配布許可へ読み替えない。[データ取り扱い](privacy-and-data-handling.md)                                        |

`resources/event-detection-models`は任意のローカルstaging先です。空でも通常buildは成立します。packの実行可否や`verified`表示はライセンス審査の代わりになりません。packを新規配布するときは、下記の未確認事項を解消して別途公開承認を得ます。新repo作成やデータ移動は現在の設計を説明するためには不要です。

## 利用者ができることと必要な準備

| 機能                             | 実際の入力と結果                                                                                  | 通常配布に含まれるもの / 別途必要なもの                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 手動タグ付け・統計・クリップ出力 | 利用者が記録したTimelineと映像                                                                    | AIモデル不要。[合成サンプル](quickstart.md)で試せる                                                            |
| 文章AI                           | Timeline・ラベル・メモ・統計から回答と推奨クリップを生成。映像フレームをLLMへ直接渡す機能ではない | llama.cpp runtimeは同梱。利用者が条件を確認したGGUFを配置する。[OS条件と設定](ai-analysis.md#runtime-boundary) |
| 自動イベント検出                 | ラグビー映像から候補区間を提案し、Timelineへ追加。人が映像と照合して確認・修正する                | OS/CPUに対応した外部model packが必要。公式の公開取得先は未提供。packなし表示は正常で、手動機能は使える         |
| Paintの俯瞰配置                  | 映像フレームから人物・ボールの配置候補を作り、利用者が調整する                                    | 下記の固定EfficientDetモデルを同梱。文章AI・イベント検出packとは別                                             |

`verified`というpackの表示や品質ゲート通過は、アプリが宣言済み指標を検査した結果です。第三者による独立評価、人が全候補を確認した証拠、モデルの権利審査と同じ意味ではありません。採用前に表示・メモ・区間を自分の用途に合わせて確認してください。

## イベント検出モデルカード（公開記録から分かる範囲）

### 用途と入出力

ラグビー映像からスクラム・ラインアウト・リスタートの候補区間を提示し、人がTimeline上で確認・修正する試験機能です。選手の同定や危険行為の自動判定を目的にしません。実行契約・対応環境・品質ゲートは[event-detection.md](event-detection.md)が正本です。

### モデルと学習概要

[ADR 0037](adr/0037-reviewed-model-refinement.md)は、既存の特徴抽出・イベント判定を保持し、確認済み例から補正を学習する設計を記録しています。`reviewed-temporal`は同じclip内の2秒間隔9地点（前後8秒）の特徴でリスタートとラインアウトを補正し、スクラムを基準packから保持します。

過去の公開R&D記録にはX3D-S / Kinetics-400と、非商用研究用VideoMAE checkpointの比較があります。これは現行配布packの系譜や許諾を確定する証拠ではありません。現在のbase model名・revision・checkpoint hash・重みlicense・補正重みとの関係は、R&D管理者による照合が必要です。

### データ概要とsplit

公開記録には過去のTrain映像・同期済み追加アングル・確認済み例の継承が記載されています。未確認区間を背景へ変更せず、AI確認は根拠付きの弱い教師データとして扱います。同一試合の別アングルを独立試合として数えず、Train / 選択用Validation / 未使用Testを分離する方針です。

実際のデータ件数・取得権限・期間・撮影条件・ラベル分布・匿名化済みsplit manifestとhashは公開資料では未確認です。実試合名や私的パスを開示せず、取得・選択・ラベル付け・前処理の説明と集計で補完する必要があります。

CodeProcessorの公開画像375枚は比較候補にのみ使われ、記録上の`0.6.0-experimental.1`では**画像なしの候補が採用**されています。この候補の学習データとして掲載しません。比較した素材の許諾確認と、採用モデルの学習データ台帳は分けます。

### Recipe・再現性

公開済みなのは製品側のrunner契約と上記設計です。学習codeの固定commit、依存lock、seed、optimizer、epochs、学習率、実コマンド、前処理・stride・threshold・区間判定設定、export設定の一式は未公開または未照合です。既存の説明を実行可能な完全recipeと表現しません。再現可能な公開モデルにする場合は、重み・データ情報とともにこれらの公開可否を確認します。

### 評価と限界

公開された開発比較では、別の2試合の同一57/59 Codingイベントを維持し、Codingと一致しない候補はリスタート31→19、ラインアウト111→90、スクラム18→18でした。目視確認したValidation負例9地点では8地点に誤検出が残ります。これは開発比較の記録で、独立Testでの一般化性能ではありません。未記録の実イベントを含み得るため、不一致候補数を誤検出数へ読み替えません。

公開資料だけでは独立Testの成績、試合別・クラス別の完全な結果、撮影条件ごとの偏り、処理時間、修正作業削減を確定できません。`experimental`を維持し、未知試合の精度や`verified` gate達成を宣伝しません。

## Paint・文章AIのカード補足

PaintのモデルはCOCO 2017で学習された既製モデルを無改変で使います。アプリ独自のtiling・投影は学習とは別です。人物・ボール検出はチーム・個人・ボール保持を同定せず、ラグビー専用の精度評価値はここでは主張しません。データセットの画像利用条件とモデル重みのApache-2.0を混同しないでください。

文章AIは利用者が選んだGGUFで動くため、アプリ共通の学習データ・精度・重みlicenseはありません。選択したモデルのカードで確認します。CIのQwen固定モデルは製品推奨モデルや同梱重みの指定ではありません。

### Paintの固定重みと上流許諾の照合

2026-10-14に、develop `40938dd887c26a6d6bddbc634a145d42021c5b76`の取得設定と既存Mac候補を次の公開根拠で照合しました。

- [GoogleのEfficientDet-Lite2案内](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector#efficientdet-lite2_model)から直接リンクされる[INT8 latest](https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/latest/efficientdet_lite2.tflite)は、固定[INT8 revision 1](https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/1/efficientdet_lite2.tflite)と同じ7,515,971 bytes、SHA-256 `b3f50554cb0ea559e90328845f7d9ba4d13c8bff372914d24e06bc8bb72fa896`でした。ビルドの取得先は引き続きrevision 1と固定hashを使用します。
- [公式repoの回答](https://github.com/google-ai-edge/mediapipe/issues/6355#issuecomment-5997480830)は2026-10-05 15:21:19 UTC、GitHub上の`COLLABORATOR`によるもので、別記がなければsourceとmodelsにApache-2.0を適用すると説明しています。Face Landmarkerに関するissueでの一般説明であり、このINT8ファイルだけへの個別保証とは扱いません。
- この一般説明と公式モデル案内からの配布物の一致を、固定重みのApache-2.0告知の根拠として記録します。確認した公式案内・配布導線には別条件を見つけていません。Kaggleの`lite2-metadata`等の別variantの表示を、このINT8 revision 1の直接の許諾根拠にはしません。
- [既存NOTICEとApache本文](../resources/pitch-vision/NOTICE.md)を維持し、最終配布物でも重みhash・告知本文・event pack/GGUF不在を検査します。案内ページの文章・サンプルコードのライセンスを重みへ転用した判断ではありません。学習データ全体の権利や個々の用途の法的安全性を保証するものでもありません。

## コードOSSと学習データ公開の違い

[OSIのソフトウェア定義](https://opensource.org/osd)はソフトウェアの利用・改変・再配布条件を扱います。アプリコードをMITで公開しても、学習映像すべてを公開したことにも、その再配布権を取得したことにもなりません。

[Open Source AI Definition 1.0](https://opensource.org/ai/open-source-ai-definition)を名乗る場合には、改変に必要なデータ情報・code・parametersを含めて確認します。同定義は共有できないデータについても由来・取得・選択・処理等の詳細な情報を求めています。現状のevent R&D一式について適合を宣言しません。

Hugging Faceではモデルrepoの`README.md`が[Model Card](https://huggingface.co/docs/hub/model-cards)になり、データrepoには[Dataset Card](https://huggingface.co/docs/hub/datasets-cards)を置けます。カードを書くこと、重みを公開すること、動画を公開することは別々の行為です。このrepo内で不足情報を整理してから、公開可能なものだけを検討できます。カードの`license`や`datasets`欄へ未確認値を入力しないでください。

## 配布前に残る確認

同梱packには[配布前レビューと由来記録](event-pack-provenance.md)を必須とし、署名前に出典・LICENSE/NOTICE・レビュー記録・全ファイルhashを検査します。このゲートは記録の整合確認であり、以下の私有packに関する未確認事項を解消した証拠ではありません。

1. 現行event packのID/version、全ファイルhash、base checkpoint・runner依存・重みの許諾と出典。
2. データの利用範囲、匿名化した集計・split固定記録、完全なrecipeと独立評価。
3. 配布用model card、license/NOTICE、取得先と公開承認。未承認の動画・重みを公開しない。

既存のアプリ/モデル分離を維持し、証拠が揃った項目からこの台帳を更新します。
