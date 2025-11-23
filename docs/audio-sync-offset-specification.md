# 音声同期オフセット仕様

## 概要

このドキュメントでは、SporTagLyticsにおける音声同期オフセット（`offsetSeconds`）の計算方法と適用方法について説明します。

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

### useVideoPlayerAppでの実装

```typescript
// 2番目以降の動画には同期オフセットを適用
if (index > 0 && syncData?.isAnalyzed) {
  const offset = syncData.syncOffset || 0;
  // offset > 0: video2が早い → video1を遅らせる（+offset）
  // offset < 0: video1が早い → video1を進める（+offset、負の値を加算）
  targetTime = Math.max(0, timeClamped + offset);
}
```

### 重要なポイント

1. **加算で適用**: `targetTime = timeClamped + offset`
   - 引き算ではなく**足し算**を使用

2. **video_0は基準**:
   - video_0（1番目の動画）は常に`timeClamped`をそのまま使用
   - video_1以降（2番目以降）にのみオフセットを適用

3. **音声ミュート**:
   - video_0のみ音声を再生
   - video_1以降は音声をミュートして再生（音の重複を防ぐ）

## デバッグ

オフセット適用時には以下のログが出力されます：

```
[OFFSET DEBUG] video_1: global=5.000s, offset=0.159s, target=5.159s (計算: 5.000 + 0.159 = 5.159)
```

- `global`: 現在のグローバル時間（基準時間）
- `offset`: AudioSyncAnalyzerが計算したオフセット
- `target`: 実際に適用される時間

## トラブルシューティング

### 症状: 音が2回鳴る（エコー）

- **原因**: オフセットの符号が逆（引き算で適用している）
- **解決**: `timeClamped + offset` を使用する

### 症状: 音声がずれている

- **確認事項**:
  1. AudioSyncAnalyzerの相関係数（`correlationPeak`）が0.3以上あるか
  2. デバッグログで実際に適用されているoffset値を確認
  3. 両方の動画の音声が有効かどうか（音声トラックが存在するか）

### 症状: 同期精度が低い

- **改善方法**:
  1. `analysisLengthSeconds` を増やす（現在20秒）
  2. より特徴的な音（笛、拍手など）がある区間を分析対象にする
  3. 音声の品質を確認（ノイズが多い場合は精度が下がる）

## 更新履歴

- 2025-11-23: 初版作成
  - オフセット計算と適用方法の仕様を明文化
  - 引き算→足し算への修正を反映
