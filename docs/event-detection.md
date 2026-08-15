# 自動イベント検出

## 目的

自動イベント検出は、ラグビー映像からイベントをローカルで検出し、通常のTimelineを初期作成する機能です。分析判断そのものを自動化するのではなく、映像から対象場面を探す作業を減らし、その後の手動Coding / Labeling / Dashboard分析を速く始めることを目的とします。

初期対象:

1. `kickoff`
2. `scrum`
3. `lineout`

`maul` と `goalKick` はshared contractには定義しますが、class単位の品質ゲートを通過したmodel packでのみ利用可能にします。

## ユーザーフロー

1. 映像パッケージを開く。
2. `分析 > 自動イベント検出…` を開く。
3. 検証済みローカルモデルと解析対象アングルを選ぶ。
4. 検出event、追加先Timeline名、開始前/終了後の秒数を確認する。
5. `検出してタイムラインへ追加` を実行する。
6. confidence閾値未満と既存Timelineとの重複を除外する。
7. 残ったeventを通常Timelineへ1回のhistory更新で追加する。
8. 以降は手動eventと同様に範囲修正、削除、ラベル付け、Dashboard / Matrix / Playlistを利用する。

自動検出専用Timelineや専用レビューキューは持ちません。

## Code Windowの記録範囲

Action buttonには次を保存できます。

- `leadTimeSeconds`: ボタン押下時刻より前に含める秒数
- `lagTimeSeconds`: ボタン終了時刻より後に含める秒数

UIでは「開始前に含める秒数」「終了後に含める秒数」と表示します。未設定の既存 `.stcw` / settings は0秒として従来挙動を維持します。

共通range計算の正本は `src/features/videoPlayer/components/Controls/domain/recordingRange.ts` です。手動Codingと自動検出からのTimeline変換で同じrange resolverを利用します。

## Product quality gate

製品UIへ表示されるのは `verified` model packだけです。event class単位で以下をすべて満たす必要があります。

| 指標 | 最低基準 |
| --- | ---: |
| Precision | 0.95 |
| Recall | 0.90 |
| unseen test matches | 5 |
| TPのうち正解時刻±2秒以内 | 0.90 |

通常のevent matching toleranceは±5秒です。

評価時に確定した `confidenceThreshold` をmodel manifestへ保存し、production runtimeではその値未満へ下げません。これらは研究分野一般の標準値ではなく、SporTagLyticsで誤検出修正の負担が手動Codingの負担を上回らないための製品採用基準です。

## Dataset split policy

frame単位・clip単位のrandom splitは禁止します。同じ試合の隣接映像がtrain/validation/testへ混ざると過大評価になるため、match ID単位で完全分離します。

役割:

- `train`: gradient update
- `validation`: model family、fine-tuning strategy、NMS/stride、confidence thresholdの選定
- `test`: 凍結済み1モデルの最終production qualificationのみ

**Test splitを複数モデルの比較に使用してはいけません。** Test結果を見てmodel、strategy、threshold、stride、NMS等を変更した場合、そのTest setは次のproduction claimへ再利用せず、新しいheld-out Test setを用意します。

## Pretrained model research

巨大なvideo backboneをゼロから学習することは前提にしません。`research/rugby-event-detection/` でpretrained video modelを同一datasetへfine-tuneして比較します。

初期candidate:

| Candidate | 役割 | Production候補 |
| --- | --- | --- |
| VideoMAE Base Kinetics | representation比較用baseline | 公開checkpointがCC BY-NC 4.0のため不可 |
| X3D-S Kinetics-400 | lightweight candidate | Apache-2.0、品質ゲート通過時のみ |
| SlowFast R50 Kinetics-400 | temporal candidate | Apache-2.0、品質ゲート通過時のみ |

精度とlicenseは独立したgateです。`productionEligible: false` のcheckpointはvalidation/test精度にかかわらずverified production modelへ昇格させません。

### 1. Human Codingからdataset manifestを作る

```bash
pnpm run research:events:prepare -- \
  --spec /path/to/dataset-spec.json \
  --output research/rugby-event-detection/runs/rugby-v1/manifest.json
```

ExporterはSporTagLytics packageの:

- `.metadata/config.json`
- `timeline.json`
- selected local angle
- `timelineStartSeconds`

を利用します。YouTube映像は研究dataset対象外です。映像byteはコピーせずlocal pathを参照します。

Timeline action名は `research/rugby-event-detection/config/event-aliases.json` で `kickoff` / `scrum` / `lineout` へ正規化します。

### Lead付きTimelineからanchorを復元する

通常はTimeline `startTime` を教師anchorにします。ただしCode Windowでleadを設定して作成したTimelineでは `startTime` が実際のボタン押下/event onsetより早くなっています。

Dataset specで次を指定できます。

```json
{
  "eventAnchorOffsetsSeconds": {
    "kickoff": 5,
    "scrum": 8,
    "lineout": 5
  }
}
```

教師anchorは次で算出します。

```text
anchor = Timeline startTime + eventAnchorOffsetsSeconds[eventType]
```

元Codingで使用したlead秒数を指定してください。既にevent onsetへtrim済みなら0秒です。Packageごとのoverrideも可能です。

### 2. Validation-only screening

最初はclassifier headだけをfine-tuneします。

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/head-screen \
  --strategy head
```

`benchmark` は:

1. `train` matchでfine-tuning
2. `validation` match全体をsliding-window scan
3. class別temporal NMS
4. validationだけでconfidence thresholdを選択
5. validationのPrecision / Recall / timestamp accuracy / local runtimeでranking

まで行います。

**このcommandはTest映像をdecodeも評価もしません。**

`benchmark-report.json` には:

- `researchRanking`
- license適格modelだけの `productionRanking`
- `screeningWinner`
- validation metrics
- scan runtime
- checkpoint / threshold SHA-256

を記録します。`screeningWinner` はproduction-qualified modelではありません。

必要に応じて有望なproduction-eligible modelだけをfull fine-tuningします。

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/full-finetune \
  --models x3d-s-kinetics400 \
  --strategy full
```

Head/fullの比較もValidationだけで行います。

### 3. Frozen held-out qualification

Model family、training strategy、stride/NMS、checkpoint、validation-selected thresholdsを凍結した後、production-eligibleな**1モデルだけ**をTestへ通します。

```bash
pnpm run research:events:qualify -- \
  --manifest /path/to/manifest.json \
  --model-id x3d-s-kinetics400 \
  --checkpoint /path/to/checkpoint.pt \
  --thresholds /path/to/thresholds.json \
  --output-dir /path/to/qualification \
  --strategy full
```

`qualify` はresearch-only modelを拒否し、checkpointのmodel ID / strategy / label schemaを検証してからTestをscanします。

出力:

```text
qualification/
├── qualification-report.json
├── test-predictions.json
├── test-ground-truth.json
└── thresholds.json
```

`qualification-report.json` には:

- checkpoint SHA-256
- source thresholds SHA-256
- locked thresholds
- unseen-test metrics
- `productGatePassed`

を記録します。

独立Node evaluatorでも同じ成果物を再検証できます。

```bash
pnpm run research:events:evaluate -- \
  qualification/test-ground-truth.json \
  qualification/test-predictions.json \
  qualification/thresholds.json
```

## Model pack

探索先:

- packaged: `Resources/event-detection-models/<model>/`
- development: `resources/event-detection-models/<model>/`
- user local: Electron `userData/event-detection-models/<model>/`

最低構成:

```text
event-detection-models/
└── rugby-events-v1/
    ├── manifest.json
    ├── bin/
    │   └── runner
    └── model files ...
```

Manifestは少なくとも:

- schema/version/id/display name
- `status: verified`
- supported event classes
- class別quality metrics
- evaluated confidence thresholds
- platform/architecture別runner path
- runner SHA-256

を持ちます。

`status: verified` だけでは利用可能になりません。アプリはclass別metrics、platform runner、path traversal、runner SHA-256を再検証します。

## Runner protocol

Electron main processはrunnerを次の形式で起動します。

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

Runner resultの時刻はpackage全体のglobal timeline秒です。複数clipではrequestの `timelineStartSeconds` を用いてlocal clip timeからglobal timeへ変換します。

## Timeline変換

`src/features/videoPlayer/eventDetection/domain/candidatesToTimeline.ts` は:

1. enabled eventだけを残す
2. verified confidence threshold未満を除外
3. detector rangeまたはanchorを取得
4. lead/lagを共通range resolverで適用
5. existing Timeline / same-runとのduplicateを除外
6. `NewTimelineData[]` へ変換
7. `addTimelineDatas` で1回のstate updateとして追加

します。

Timelineへ追加された後は自動検出由来かどうかを特別扱いせず、通常の手動eventとして編集できます。

## 対象外

現時点でproduction roadmapから外すもの:

- player tracking前提のheatmap / width / depth
- ball tracking
- jersey/player identity
- contact内pose推定
- tackle quality / dangerous tackle自動判定
- LLM/VLMによる映像イベント判定

将来追加する場合も、独立したdataset、評価、license確認、product quality gateを必要とします。
