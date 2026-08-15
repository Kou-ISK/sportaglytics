# 自動イベント検出

## 目的

自動イベント検出は、ラグビー映像からイベント候補をローカルで検出し、通常の Timeline を初期作成するための機能です。目的は分析判断を自動化することではなく、試合映像から対象場面を探す作業を減らし、その後の手動 Coding / Labeling / Dashboard 分析を速く始めることです。

現時点の優先イベントは次の3つです。

1. `kickoff`
2. `scrum`
3. `lineout`

`maul` と `goalKick` は共通型へ定義済みですが、各classが品質ゲートを通過したmodel packでのみ利用できます。

## ユーザーフロー

1. 映像パッケージを開く。
2. `分析 > 自動イベント検出…` を開く。
3. 検証済みローカルモデルと解析対象アングルを選ぶ。
4. 検出するイベント、追加先Timeline名、開始前/終了後の秒数を確認する。
5. `検出してタイムラインへ追加` を実行する。
6. confidence閾値未満と既存Timelineとの重複は除外される。
7. 残ったイベントが通常のTimelineへ1回のhistory更新で追加される。
8. 以降は手動で範囲修正、削除、ラベル付け、Dashboard/Matrix/Playlist利用を行う。

自動検出専用のレビュー画面やAI専用Timelineは持ちません。

## Code Window の記録範囲

Action buttonには次を保存できます。

- `leadTimeSeconds`: ボタンを押した時刻より前に含める秒数
- `lagTimeSeconds`: ボタンを終了した時刻より後に含める秒数

UIでは「開始前に含める秒数」「終了後に含める秒数」と表示します。未設定の既存 `.stcw` / settings は両方0秒として従来挙動を維持します。

記録範囲の計算は `src/features/videoPlayer/components/Controls/domain/recordingRange.ts` を正本とします。手動 Coding と自動検出からの Timeline 変換で同じ関数を利用します。

Code Windowに `Kickoff` / `Scrum` / `Lineout` と同名のAction buttonがある場合、自動検出ダイアログはそのbuttonのlead/lagを初期値として使用します。該当buttonがない場合はダイアログ側の初期値を表示し、実行前に変更できます。

## 品質ゲート

製品UIへ表示されるのは `verified` model packだけです。event class単位で以下をすべて満たす必要があります。

| 指標 | 最低基準 |
| --- | ---: |
| Precision | 0.95 |
| Recall | 0.90 |
| unseen evaluation matches | 5 |
| 正解時刻 ±2秒以内 | 0.90 |

加えて、評価時に使った `confidenceThreshold` をmanifestに記録します。製品runtimeはその値より低いthresholdでは実行しません。

これらは研究分野一般の閾値ではなく、SporTagLyticsで「誤検出修正が手動Codingの負担を上回らない」ための製品採用基準です。

## 評価データ分割

frame単位のrandom splitは禁止します。同じ試合の隣接frame/clipがtrainとtestへ混ざると過大評価になるため、match ID単位で完全分離します。

評価JSONのground truthには必要に応じて `trainingMatchIds` を含めます。`scripts/evaluate-event-detection.mjs` はtest `matches[].matchId`との重複を検出すると失敗します。

評価コマンド:

```bash
pnpm run research:events:evaluate -- \
  research/rugby-event-detection/ground-truth.json \
  research/rugby-event-detection/predictions.json \
  research/rugby-event-detection/thresholds.json
```

出力にはevent classごとのPrecision / Recall / evaluated matches / confidence threshold / ±2秒率と、品質ゲート通過可否を含みます。すべての指定eventが基準を満たさない場合、process exit codeは1になります。

### Ground truth例

```json
{
  "datasetId": "rugby-events-test-v1",
  "trainingMatchIds": ["train-001", "train-002"],
  "matches": [
    {
      "matchId": "test-001",
      "events": [
        { "eventType": "kickoff", "anchorTime": 3.4 },
        { "eventType": "scrum", "anchorTime": 315.2 }
      ]
    }
  ]
}
```

### Prediction例

```json
{
  "matches": [
    {
      "matchId": "test-001",
      "events": [
        { "eventType": "kickoff", "anchorTime": 3.8, "confidence": 0.98 },
        { "eventType": "scrum", "anchorTime": 314.9, "confidence": 0.97 }
      ]
    }
  ]
}
```

### Threshold例

```json
{
  "kickoff": 0.94,
  "scrum": 0.95,
  "lineout": 0.95
}
```

## Pretrained model research / promotion

Production modelをゼロから学習することを前提にしません。`research/rugby-event-detection/` で既存pretrained video backboneを共通datasetへfine-tuneし、event spotting精度とlocal runtimeを比較します。

初期比較:

| Candidate | 用途 | Production候補 |
| --- | --- | --- |
| VideoMAE Base Kinetics | representation精度のresearch baseline | 公開checkpointがCC BY-NC 4.0のため不可 |
| X3D-S Kinetics-400 | lightweight production candidate | Apache-2.0、品質ゲート通過時のみ |
| SlowFast R50 Kinetics-400 | temporal production candidate | Apache-2.0、品質ゲート通過時のみ |

Research modelのlicenseは精度とは別のgateです。`productionEligible: false` のcheckpointは、test精度が高くてもverified model packへ昇格させません。

### Dataset preparation

既に手動CodingしたSporTagLytics packageを教師データとして再利用します。

```bash
pnpm run research:events:prepare -- \
  --spec /path/to/dataset-spec.json \
  --output research/rugby-event-detection/runs/rugby-v1/manifest.json
```

Exporterはselected local angle、clipの `timelineStartSeconds`、duration、Timeline actionの `startTime` を保持し、`event-aliases.json` を通じて `kickoff` / `scrum` / `lineout` へ正規化します。映像自体はコピーしません。

### Benchmark

最初はbackboneを固定してclassifier headだけをfine-tuneします。

```bash
pnpm run research:events:benchmark -- \
  --manifest research/rugby-event-detection/runs/rugby-v1/manifest.json \
  --output-dir research/rugby-event-detection/runs/rugby-v1/head-screen \
  --strategy head
```

必要なproduction-eligible candidateだけ `--strategy full` でfull fine-tuningします。

Benchmarkの評価順序:

1. `train` matchでfine-tuningする。
2. `validation` match全体をsliding windowでspottingする。
3. temporal NMS後、validationだけでevent class別confidence thresholdを選ぶ。
4. thresholdを固定する。
5. 完全未見の`test` match全体をscanする。
6. 既存の±5秒matching / ±2秒precision評価とproduct gateを適用する。
7. license適格性と処理時間を含めproduction winnerを判定する。

Test結果を見て同じtest setのthresholdを再調整しません。Test結果を根拠にmodel設計を変更した場合、そのtest setは次のproduction claimではvalidation相当とみなし、新しいheld-out test setを用意します。

Benchmark outputはmodelごとにcheckpoint、validation/test prediction、locked thresholds、independent evaluator互換ground truthを保存し、run rootに `benchmark-report.json` を生成します。品質とlicenseの両方を満たすmodelがない場合、`productionWinner` は `null` のままです。

詳細手順は [`research/rugby-event-detection/README.md`](../research/rugby-event-detection/README.md) を参照してください。

## Model pack

探索先:

- packaged: `Resources/event-detection-models/<model>/`
- development: `resources/event-detection-models/<model>/`
- user local: Electron `userData/event-detection-models/<model>/`

model packは最低限次を持ちます。

```text
event-detection-models/
└── rugby-events-v1/
    ├── manifest.json
    ├── runner
    └── model files ...
```

manifest例:

```json
{
  "schemaVersion": 1,
  "id": "rugby-events-v1",
  "version": "1.0.0",
  "displayName": "Rugby Events v1",
  "status": "verified",
  "events": ["kickoff", "scrum", "lineout"],
  "metrics": {
    "kickoff": {
      "precision": 0.97,
      "recall": 0.93,
      "evaluatedMatches": 8,
      "confidenceThreshold": 0.94,
      "timestampWithinTwoSecondsRate": 0.96
    }
  },
  "runners": {
    "darwin-arm64": {
      "path": "bin/runner",
      "sha256": "<64 hex chars>"
    }
  }
}
```

`status: "verified"` だけでは利用可能になりません。アプリはevent classのmetrics、platform runnerの存在、path traversal、runner SHA-256を再検証します。基準未達classは利用可能event一覧から除外されます。

## Runner protocol

Electron main processはrunnerを次の形式で起動します。

```text
runner --request <request.json> --output <result.json> --model-dir <model-directory>
```

制約:

- network APIを前提にしないローカル推論
- `shell: false`
- finite timeout
- cancel可能
- stderr size制限
- result JSON size制限
- request/resultは一時ファイルで受け渡し、完了後削除
- runner executableはmanifest SHA-256と一致する必要がある

ML runtimeはこのrunner内部の実装詳細です。アプリrendererをONNX/PyTorch等へ直接依存させません。

## Runner result contract

```json
{
  "requestId": "...",
  "modelId": "rugby-events-v1",
  "modelVersion": "1.0.0",
  "durationMs": 12345,
  "candidates": [
    {
      "id": "event-1",
      "eventType": "scrum",
      "confidence": 0.98,
      "anchorTime": 315.2,
      "detectedStartTime": 311.0,
      "detectedEndTime": 327.0,
      "clipId": "clip-1"
    }
  ]
}
```

時刻はpackage全体のglobal timeline秒です。複数clipを扱うrunnerはrequestの `timelineStartSeconds` を使ってlocal clip timeからglobal timeへ変換します。

## Timeline変換

`src/features/videoPlayer/eventDetection/domain/candidatesToTimeline.ts` が次を行います。

1. enabled eventだけを残す。
2. manifest由来の検証済みconfidence threshold未満を除外する。
3. detectorのrangeがあればそれを利用し、なければanchor timeを基準にする。
4. lead/lagを共通range resolverで適用する。
5. 同じactionNameで中心時刻が近い、または区間IoUが高い既存eventを重複として除外する。
6. `NewTimelineData[]` へ変換する。
7. `addTimelineDatas` で1回のstate updateとして追加する。

自動検出由来かどうかを `TimelineData` に保存しません。Timelineへ入った後は手動作成eventと同じ扱いです。

## 対象外

現時点で製品ロードマップから外すもの:

- player trackingを前提にした自動heatmap/width/depth
- ball tracking
- jersey/player identity
- contact内pose推定
- tackle quality / dangerous tackleの自動判定
- LLM/VLMによる映像イベント判定

これらを将来追加する場合も、本ADRと同等の独立した精度検証と製品採用基準が必要です。
