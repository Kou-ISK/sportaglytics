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

処理時間と修正時間を合わせても作業効率化にならないmodelは、精度指標が改善していても製品へ採用しません。

秒単位の厳密なevent onsetは主目的ではありません。分析者が「大体の区間」として扱える位置にイベント候補が作られることを優先します。

## ユーザーフロー

1. 映像パッケージを開く。
2. `分析 > 自動イベント検出…` を開く。
3. 検証済みローカルモデルと解析対象アングルを選ぶ。
4. 検出event、追加先Timeline名、開始前/終了後の秒数を確認する。
5. `検出してタイムラインへ追加` を実行する。
6. model packで検証済みのconfidence thresholdと既存Timelineとの重複を適用する。
7. 候補を通常Timelineへ1回のhistory更新で追加する。
8. 不要候補を削除し、必要に応じて範囲修正、見逃し追加、ラベル付け、Dashboard / Matrix / Playlistを行う。

自動検出専用Timelineや専用永続データモデルは持ちません。

## R&D境界

SporTagLytics public repositoryは**完成したevent modelを利用する側**です。

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

一般ユーザーのPCで自動fine-tuningする仕組みも初期製品には入れません。SporTagLyticsは共通のverified model packを利用します。ユーザーデータをモデル改善へ利用する場合は、将来の明示的opt-in設計とします。

設計判断の正本は [ADR 0023](adr/0023-external-rugby-event-model-rd-boundary.md) です。

## Product runtime quality gate

Public app側は、event classごとに最低限次を確認します。

| 指標 | Runtime minimum |
| --- | ---: |
| Recall | 0.95 |
| unseen evaluation matches | 5 |
| Precision | 0〜1の有限値として記録 |
| confidence threshold | 0〜1の有限値 |

Precisionの固定最低値はruntime gateにしません。高Recallでのfalse positives per matchや処理時間、実作業削減はprivate qualification側で確認し、実用的でないmodelを`verified`へ昇格させない前提です。

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

Manifestは少なくともschema/version/id/display name、`status: verified`、supported event classes、class別quality metrics、confidence thresholds、platform/architecture別runner path、runner SHA-256を持ちます。

`status: verified` だけでは利用可能になりません。アプリはclass別Recall、unseen evaluation match数、confidence threshold、platform runner、path traversal、runner SHA-256を再検証します。

Model packはアプリreleaseと独立して更新できます。SporTagLytics側はモデルの学習元やtraining frameworkを知る必要がありません。

## Runner protocol

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

Runner内部のML runtimeはmodel packの実装詳細です。

## Timeline変換

`src/features/videoPlayer/eventDetection/domain/candidatesToTimeline.ts` はenabled event、verified confidence threshold、lead/lag、既存Timeline重複を処理した上で `NewTimelineData[]` へ変換し、`addTimelineDatas` で1回のstate updateとして追加します。

Runnerが検出区間 (`detectedStartTime` / `detectedEndTime`) を返せる場合はそのrangeを基準にし、返さないpoint detectorではanchorを基準にAction mappingのlead/lagを適用します。

Timelineへ追加された後は自動検出由来かどうかを特別扱いせず、通常の手動eventとして編集できます。

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
