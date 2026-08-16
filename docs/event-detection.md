# 自動イベント検出

## 目的

自動イベント検出は、ラグビー映像からイベントをローカルで検出し、通常のTimelineを初期作成する機能です。分析判断そのものを自動化するのではなく、映像から対象場面を探す作業を減らし、その後の手動Coding / Labeling / Dashboard分析を速く始めることを目的とします。

初期対象:

1. `restart`
2. `scrum`
3. `lineout`

`restart` は SporTagLytics 上の「リスタート」に対応し、50mキックオフ、22mドロップアウト、トライライン/ゴールラインドロップアウトなど、キックによる試合再開をまとめたクラスです。過去データの `Kickoff` / `キックオフ` も教師データ読込時に `restart` へ正規化します。

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

### 最短の学習開始

タグ付け済み試合を含む親ディレクトリを1つ指定します。

```bash
pnpm run research:events:train -- \
  --root "/path/to/coded-matches"
```

このコマンドは再帰的に現行/対応済み旧形式のpackageを探索し、`restart` / `scrum` / `lineout` がすべてCodingされている試合だけを安全な教師データとして採用します。その後、試合単位でTrain / Validation / Testへ決定論的に分割し、既定ではX3D-S Kinetics-400のclassifier headを5 epoch学習します。

この学習入口が使用するのはTrainとValidationだけです。Testはdecodeも評価もしません。

### Timeline Actionの正規化

`research/rugby-event-detection/config/event-aliases.json` を正本として、少なくとも次をcanonical eventへ正規化します。

- `リスタート`, `Restart`, `Kickoff`, `キックオフ`, 22m/try-line/goal-line dropout表記 -> `restart`
- `スクラム`, `Scrum` -> `scrum`
- `ラインアウト`, `Lineout` -> `lineout`

チーム/side prefix付きActionはevent aliasが末尾にある場合、そのprefixを`possessionLabel`として保持します。

### Lead付きTimelineからanchorを復元する

通常はTimeline `startTime` を教師anchorにします。ただしCode Windowでleadを設定して作成したTimelineでは `startTime` が実際のボタン押下/event onsetより早くなっています。

明示dataset specでは次を指定できます。

```json
{
  "eventAnchorOffsetsSeconds": {
    "restart": 5,
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

### Validation-only screening

手動で比較する場合はclassifier headから開始します。

```bash
pnpm run research:events:benchmark -- \
  --manifest /path/to/manifest.json \
  --output-dir /path/to/head-screen \
  --models x3d-s-kinetics400 \
  --strategy head
```

`benchmark` はTrainでfine-tuningし、Validation試合全体をsliding-window scanしてclass別NMSとconfidence threshold選択を行います。Test映像はdecodeも評価もしません。

### Frozen held-out qualification

Model family、training strategy、stride/NMS、checkpoint、validation-selected thresholdsを凍結した後、production-eligibleな**1モデルだけ**をTestへ通します。

```bash
pnpm run research:events:qualify -- \
  --manifest /path/to/manifest.json \
  --model-id x3d-s-kinetics400 \
  --checkpoint /path/to/checkpoint.pt \
  --thresholds /path/to/thresholds.json \
  --output-dir /path/to/qualification \
  --strategy head
```

Test結果を見てモデル設計を変更した場合、そのTest setは次のproduction claimへ再利用しません。

## Model pack

探索先:

- packaged: `Resources/event-detection-models/<model>/`
- development: `resources/event-detection-models/<model>/`
- user local: Electron `userData/event-detection-models/<model>/`

Manifestは少なくともschema/version/id/display name、`status: verified`、supported event classes、class別quality metrics、confidence thresholds、platform/architecture別runner path、runner SHA-256を持ちます。

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

## Timeline変換

`src/features/videoPlayer/eventDetection/domain/candidatesToTimeline.ts` はenabled event、verified confidence threshold、lead/lag、既存Timeline重複を処理した上で `NewTimelineData[]` へ変換し、`addTimelineDatas` で1回のstate updateとして追加します。

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
