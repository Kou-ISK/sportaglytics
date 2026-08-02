# 音声同期オフセット仕様

## 概要

このドキュメントでは、SporTagLyticsにおける音声同期オフセット（`offsetSeconds`）の計算・適用と、マルチアングル用の保存形式を説明します。

関連 ADR: [0016 Multi-angle Audio Sync Offset Persistence](adr/0016-multi-angle-audio-sync-offset-persistence.md)

## オフセットの定義

### AudioSyncAnalyzerでの計算

`AudioSyncAnalyzer`クラスは、2つの動画（video1とvideo2）の音声波形を比較し、同期に必要なオフセットを計算します。

```typescript
// 返されるoffsetSecondsの意味:
// offsetSeconds > 0: video2がvideo1より早く始まっている → video1に+offsetSecondsを加える
// offsetSeconds < 0: video1がvideo2より早く始まっている → video1に-|offsetSeconds|を加える
```

#### 例

- `offsetSeconds = 0.159` の場合
  - video2がvideo1より0.159秒**早く**始まっている
  - video1を0.159秒**遅らせる**（進める）必要がある

- `offsetSeconds = -0.200` の場合
  - video1がvideo2より0.200秒**早く**始まっている
  - video1を0.200秒**戻す**必要がある

### 相関計算の実装

```typescript
const start1 = Math.max(0, -offset);
const start2 = Math.max(0, offset);
```

- `offset > 0` の場合: `start1=0`, `start2=offset`
  - video1[0]とvideo2[offset]を比較
  - video2が先に始まっている状況

- `offset < 0` の場合: `start1=|offset|`, `start2=0`
  - video1[|offset|]とvideo2[0]を比較
  - video1が先に始まっている状況

## オフセットの適用

### useSyncPlaybackでの実装

```typescript
const legacyOffset = syncData?.syncOffset ?? 0;
const offsets = videoList.map((_, index) =>
  index === 0 ? 0 : (syncData?.angleOffsets?.[index] ?? legacyOffset),
);

const targetTime = Math.max(0, globalTime + offsets[index]);
```

### 重要なポイント

1. **加算で適用**: `targetTime = globalTime + offset`
   - 引き算ではなく**足し算**を使用

2. **video_0は基準**:
   - `angleOffsets[0]` は常に `0`
   - `video_1` 以降は同じindexの `angleOffsets[index]` を適用

3. **後方互換**:
   - `angleOffsets[index]` がない旧パッケージは `syncOffset` を使用
   - `syncOffset` は従来の2アングル同期における第2アングルの値として維持

4. **音声ミュート**:
   - video_0のみ音声を再生
   - video_1以降は音声をミュートして再生（音の重複を防ぐ）

## 保存形式

同期データは `.metadata/config.json` の `syncData` に保存します。

```json
{
  "syncData": {
    "syncOffset": 0.159,
    "angleOffsets": [0, 0.159, -0.2],
    "isAnalyzed": true,
    "confidenceScore": 0.82
  }
}
```

- `angleOffsets` は `.metadata/config.json` の `angles[]` と同じindexを使います。
- IPC境界では最大8要素、有限値、絶対値24時間以内を検証します。
- クリップ単位の `timelineStartSeconds` はアングル内の断片配置であり、アングル単位の `angleOffsets` とは別の契約です。

## デバッグ

オフセット適用時には以下のログが出力されます：

```
[OFFSET DEBUG] video_2: global=5.000s, offset=-0.200s, target=4.800s (計算: 5.000 + -0.200 = 4.800)
```

- `global`: 現在のグローバル時間（基準時間）
- `offset`: 対象アングルに適用する `angleOffsets[index]`、または旧形式の `syncOffset`
- `target`: 実際に適用される時間

## トラブルシューティング

### 症状: 音が2回鳴る（エコー）

- **原因**: オフセットの符号が逆（引き算で適用している）
- **解決**: `timeClamped + offset` を使用する

### 症状: 音声がずれている

- **確認事項**:
  1. 音声同期の信頼度が0.35以上あるか
  2. デバッグログで実際に適用されているoffset値を確認
  3. 両方の動画の音声が有効かどうか（音声トラックが存在するか）

### 症状: 同期精度が低い

- **改善方法**:
  1. 笛、拍手、インパクト音など特徴のある位置へ双方の映像をシークして再試行する
  2. より特徴的な音（笛、拍手など）がある区間を分析対象にする
  3. 音声の品質を確認（ノイズが多い場合は精度が下がる）

## 更新履歴

- 2025-11-23: 初版作成
  - オフセット計算と適用方法の仕様を明文化
  - 引き算→足し算への修正を反映
- 2026-07-26: マルチアングル対応
  - `angleOffsets`、`syncOffset`の後方互換、保存場所を反映
