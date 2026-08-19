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

| 指標 | Runtime minimum |
| --- | ---: |
| Recall | 0.95 |
| unseen evaluation matches | 5 |
| Precision | 0〜1の有限値として記録 |
| confidence threshold | 0〜1の有限値 |

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
