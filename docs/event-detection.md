# 自動イベント検出

## 目的

自動イベント検出は、ラグビー映像からイベント候補をローカルで検出し、通常のTimelineを初期作成するCoding assistanceです。分析判断そのものを自動化する機能ではありません。

初期対象:

1. `restart`
2. `scrum`
3. `lineout`

`restart` は50mキックオフ、22mドロップアウト、トライライン/ゴールラインドロップアウトなど、キックによる試合再開をまとめた上位クラスです。

## UX原則: 見逃しを減らし、余分を消す

この機能ではPrecisionを優先して一部だけ自動Codingするより、**実際のイベントをほぼすべて候補として出し、人間が不要候補を削除する**workflowを優先します。

したがってmodel qualificationでは、F1やPrecision単独ではなく次を重視します。

- Recall 95% / 98% / 99%近傍でのPrecision
- false positives per match
- missed events per match
- wall-clock inference time / video minute
- AI候補の削除と見逃し追加を含むmanual edit operations
- 通常の手Codingと比較した作業時間削減

処理時間と修正時間を合わせても作業効率化にならないmodelは、精度指標が改善していても`verified`へ昇格させません。

秒単位の厳密なevent onsetは主目的ではありません。分析者が「大体の区間」として扱える位置にイベント候補が作られることを優先します。

## Model status

製品runtimeは次の2状態を明示的に扱います。

### `verified`

production qualification済みのモデルです。event classごとにProduct runtime quality gateを満たしたclassだけが利用可能になります。

### `experimental`

検出するイベントはチームを区別しない共通イベントです。チーム情報はモデル選択・評価の前提条件にしません。

schema 2の比較用packは `evaluationBasis: reference-coding` を宣言します。UIは一般的なRecall/Precisionの代わりに「既存Codingとの比較」と表示し、「記録済みプレーの再検出」「Codingと一致した候補」の割合と比較試合数を示します。Codingと対応しない候補を、そのまま誤検出とはみなしません。このpackは `experimental` 専用で、数値が高くても `verified` にはできません。

schema 1は既存の報告値の表示を維持し、ロード時に `reported-metrics` として正規化します。schema 2は古いアプリで受理されないため、比較値が精度として誤表示されることを防ぎます。checkpoint/threshold/前処理/走査間隔の整合、試合・クラスごとの既存Codingの取りこぼし非増加、確認済み実プレーの保持はR&D側の出力条件です。全試合を確認済みへ書き換えて出力することは禁止します。

背景と互換性は [ADR 0034](adr/0034-reference-coding-model-evaluation.md) を参照してください。

品質評価中のモデルです。`verified`のquality gateを通過したことを意味しません。manifestの構造・metrics・platform runner・runner hashなどが正しく、verifiedと同じ実行セキュリティ境界を満たす場合のみ利用候補へ表示します。

experimental modelを選択した場合、UIは常に次を表示します。

- `試験` badge
- 誤検出・見逃しがあり、人間の確認が必要であること
- class別Recall
- class別Precision
- evaluated match数
- baseline confidence threshold

experimental候補は unattended な分析結果として扱わず、追加後にTimeline上で確認・修正します。

## ユーザーフロー

1. 映像パッケージを開く。
2. `分析 > 自動イベント検出…` を開く。
3. 利用可能なローカルモデルと解析対象アングルを選ぶ。
4. experimental modelの場合は警告と評価値を確認する。
5. 検出event、追加先Timeline名、confidence threshold、開始前/終了後の秒数を確認する。
6. 必要であればconfidence thresholdを0.00〜1.00で調整する。manifest値が初期値になる。
7. `検出してタイムラインへ追加` を実行する。
8. confidence filterと既存Timelineとの重複除去を適用する。
9. 候補を通常Timelineへ1回のhistory更新で追加する。
10. 不要候補を削除し、必要に応じて範囲修正、見逃し追加、ラベル付け、Dashboard / Matrix / Playlistを行う。

モデル一覧と初期設定はダイアログを開く時に読み込みます。開いている間の映像メタデータ・コードウィンドウ更新では再読み込みせず、編集中のしきい値や追加先を保持します。解析対象アングルがなくなった場合だけ、利用可能なアングルへ選択を更新します。

自動検出専用Timelineや専用永続データモデルは持ちません。confidence thresholdのUI変更もmodel manifestや評価metricsを書き換えません。

## R&D境界

SporTagLytics public repositoryは**完成したevent model packを利用する側**です。

次の責務はこのrepositoryには置きません。

- dataset discovery / preparation
- training / fine-tuning
- hard-negative mining
- model family比較
- threshold / NMS / stride探索
- validation / held-out qualification
- private source diagnostics
- model export

これらは別のprivate R&D repositoryで管理します。元動画、`.stpkg`、Timeline Coding、frames、checkpoints、runsはGitへcommitしません。

一般ユーザーのPCで自動fine-tuningする仕組みも初期製品には入れません。SporTagLyticsは共通の配布model packを利用します。ユーザーデータをモデル改善へ利用する場合は、将来の明示的opt-in設計とします。

設計判断の正本は [ADR 0023](adr/0023-external-rugby-event-model-rd-boundary.md) と [ADR 0024](adr/0024-experimental-event-detection-production-lane.md) です。

## Product runtime quality gate

`verified`へ昇格するevent classは最低限次を満たします。この基準はexperimental対応によって緩和しません。

| 指標                      |        Runtime minimum |
| ------------------------- | ---------------------: |
| Recall                    |                   0.95 |
| unseen evaluation matches |                      5 |
| Precision                 | 0〜1の有限値として記録 |
| confidence threshold      |           0〜1の有限値 |

Precisionの固定最低値はruntime gateにしません。高Recallでのfalse positives per matchや処理時間、実作業削減はprivate qualification側で確認し、実用的でないmodelを`verified`へ昇格させない前提です。

`experimental`はこのquality gateを通過扱いにしません。宣言eventごとのmetricsが構造的に有効であることと、runnerの安全性・完全性が確認できることを別条件として利用可能にします。

## Code Windowの記録範囲

Action buttonには次を保存できます。

- `leadTimeSeconds`: ボタン押下時刻より前に含める秒数
- `lagTimeSeconds`: ボタン終了時刻より後に含める秒数

UIでは「開始前に含める秒数」「終了後に含める秒数」と表示します。未設定の既存 `.stcw` / settings は0秒として従来挙動を維持します。

共通range計算の正本は `src/features/videoPlayer/components/Controls/domain/recordingRange.ts` です。手動Codingと自動検出からのTimeline変換で同じrange resolverを利用します。

## Model pack

探索先:

- packaged: `Resources/event-detection-models/<model>/`
- development: `resources/event-detection-models/<model>/`
- user local: Electron `userData/event-detection-models/<model>/`

Manifestは少なくともschema/version/id/display name、`status: verified | experimental`、supported event classes、class別quality metrics、confidence thresholds、platform/architecture別runner path、runner SHA-256を持ちます。

共通のruntime検証:

- manifest schema / status / event type / metric range
- current platform/architecture runnerの存在
- model directory外へ出ないrelative runner path
- runner SHA-256一致
- request/result payload validation

`verified`は上記に加えてclass別quality gateを再検証します。`experimental`はquality gateを回避して`verified`扱いになるのではなく、別statusのままUIへ伝播します。

### 配布model packのstaging

deployable model packはsource artifactではありません。

- local/release CI staging: `resources/event-detection-models/<model>/`
- `.gitignore`でmodel pack本体を除外する
- `electron-builder`がstaged model packを`event-detection-models`として`extraResources`へ含める
- stagingが空でも通常build・model discovery・他機能は成立する

raw videos、`.stpkg`、frames、research runs、checkpoints、private source metadataはここへ置かず、Gitにもcommitしません。

## Runner protocol

### 映像パスと実行前検証

新規作成直後のパッケージルートは、mainが返した`metaDataConfigFilePath`の保存先を正とします。入力名から組み立て直しません。mainが補う`.stpkg`、日本語・空白・`#`・`%`を含むパスを保ったまま、各クリップの`relativePath`を解決します。履歴にも同じパッケージルートを保存します。

mainはランナー起動前に、要求された全クリップが読み取り可能な通常ファイルであることを確認します。欠落したクリップを黙って除外して部分的な検出結果を返しません。見つからないファイルやアクセスできないファイルは、対象パスと復旧方法を表示します。この検査はモデルの精度評価とは独立しています。

### 実行契約

Electron main processはrunnerを次の形で起動します。

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

Production境界:

- network API不要のlocal execution
- `shell: false`
- finite timeout
- cancel可能
- stderr/result size制限
- request/result一時ファイルを完了後削除
- executable SHA-256必須
- RendererはPyTorch / ONNX Runtime等へ直接依存しない

verified/experimentalのどちらもこの境界を共有します。Runner内部のML runtimeはmodel packの実装詳細です。

## Timeline変換

`src/features/videoPlayer/eventDetection/domain/candidatesToTimeline.ts` はenabled event、現在のconfidence threshold、lead/lag、既存Timeline重複を処理した上で `NewTimelineData[]` へ変換し、`addTimelineDatas` で1回のstate updateとして追加します。

同一runの候補が重複する場合は、confidenceが最も高い候補を残します。同点なら早い時刻を採用し、採用後の一覧は時刻順にします。Runnerが返した配列順や早い低confidence候補によって、より強い候補の位置が失われないようにします。既存Timelineの手動編集済みイベントは新しい候補で置き換えません。

Runnerが検出区間 (`detectedStartTime` / `detectedEndTime`) を返せる場合はそのrangeを基準にし、返さないpoint detectorではanchorを基準にAction mappingのlead/lagを適用します。

Timelineへ追加された後は自動検出由来かどうかを特別扱いせず、通常の手動eventとして編集できます。

## 検出精度の改善と評価

精度はモデルの重みだけで決まりません。映像の前処理、走査間隔、時間方向の重複抑制、クラス別confidence thresholdまで含めた同じ処理を評価・実行する必要があります。Model packの製作者は、評価したモデル定義と走査設定を評価レポートへ固定し、export時の別設定への変更を拒否します。設定記録のない古い評価は再評価が必要です。

既存manifestに網羅性の記録がないことは、Codingの不足を意味しません。利用者が意図した完成版のTimeline、イベント名の対応、映像の時間軸を確認し、既存Codingの対象範囲が確認できればその根拠を記録します。完成済みの試合を一律に再Codingする運用にはしません。Validationの一例をTrain全体の不足へ一般化することもしません。

改善は次の順序で行います。

1. Codingが両チーム・全対象イベントを網羅している区間を確認する。未記録の実イベントを「誤検出」や学習用の「背景」と扱わない。元映像とCodingのアングル・時間の対応も確認する。
2. 同じValidation試合・同じcheckpointで、改善前後の候補を比較する。
3. 同じ場面の重複を抑え、クラス別thresholdを再調整する。クラス別・試合別の見逃しが増える設定は採用しない。
4. なお残る誤検出の場面をTrainデータの背景例として追加し、イベントの記録範囲・ラベルの揺れを確認して再学習する。
5. 学習に使わない試合で、Recall、Precision、1試合当たりの誤検出・見逃し、実際の修正操作・処理時間を測定する。

Validationで調整した後の改善率は未知試合への精度保証ではありません。5試合以上のheld-out評価と作業時間削減を確認するまでは`experimental`を維持します。Train/Validation/Testの分割を変更して評価値を良く見せることもしません。

正解データの網羅性が未確認の場合、Precision/Recallは既存Codingとの一致度にすぎません。その数値だけでモデル更新を判断せず、R&D側で確認済み区間を記録してから負例学習・モデル配布へ進みます。

R&D側の再学習比較では、短い映像クリップが可能な限りCoding区間の内側へ収まるようにし、時間の対応を確認した引き映像をTrainの追加例として使用します。寄り映像だけの学習と、同じ寄り映像の学習例へ引き映像を追加した学習を比較し、重複抑制だけの効果と区別します。追加カメラは独立した試合数には数えません。

評価Codingの外でも映像確認で実イベントと判断できた地点は、元のCodingとは別の見逃しチェックとして保持できます。再学習後にその地点を検出できなくなる設定は採用せず、少数地点の確認を試合全体の網羅性確認とは扱いません。比較用checkpointの作成、本体へのmodel packの反映、配布は別々に記録します。

製品は完成したmodel packを使う構成を維持し、映像・Codingを暗黙にアップロードしません。学習とモデル比較の実装はprivate R&D側で管理します。

## 対象外

現時点でproduction roadmapから外すもの:

- ユーザー端末ごとの自動fine-tuning
- 暗黙のtraining data upload
- player tracking前提のheatmap / width / depth
- ball tracking
- jersey/player identity
- contact内pose推定
- tackle quality / dangerous tackle自動判定
- LLM/VLMによる映像イベント判定

将来追加する場合も、独立したdataset、評価、license確認、product quality gateを必要とします。

## 同じ入力での再実行

同じ映像・モデル・イベントで再実行すると、アプリ起動中は検証済みの解析結果を最大30分再利用します。しきい値、前後秒数、追加先の変更は通常どおり最新の設定で候補へ適用します。映像やモデルの変更・削除、clipの配置変更では再解析します。詳細は[ADR 0035](adr/0035-event-detection-result-reuse.md)を参照してください。
