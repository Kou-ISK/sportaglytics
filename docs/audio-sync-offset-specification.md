# 音声同期オフセット仕様

## 概要

このドキュメントでは、SporTagLytics におけるアングル単位の音声同期オフセットの計算・適用・保存契約を説明します。

関連 ADR:

- [0016 Multi-angle Audio Sync Offset Persistence](adr/0016-multi-angle-audio-sync-offset-persistence.md)
- [0015 Clip Timeline Placement and Audio-assisted Sync](adr/0015-clip-timeline-placement-and-audio-assisted-sync.md)

## 共通タイムライン

- `video_0` / 第1アングルを共通タイムラインの基準とします。
- global time は常に `0` 以上です。
- 第1アングルの offset は常に `0` です。
- 直接メディアとして再生する第2アングル以降は、同じ global time に対応するメディア時刻を次式で求めます。

```typescript
mediaTime = globalTime + angleOffset;
```

逆変換は次式です。

```typescript
globalTime = mediaTime - angleOffset;
```

符号計算を UI や Controller が独自実装せず、同期ドメインの共通ヘルパーを使用します。

## オフセットの意味

`offset > 0` の場合、同一イベントは対象アングル上で基準アングルより大きいメディア時刻に存在します。

例: `offset = +0.159`

```text
global 10.000s -> target media 10.159s
```

`offset < 0` の場合、同一イベントは対象アングル上で基準アングルより小さいメディア時刻に存在します。

例: `offset = -0.200`

```text
global 10.000s -> target media 9.800s
```

対象メディア時刻が負になる区間では、そのアングルを再生せず待機します。global time 自体を負にしません。

## AudioSyncAnalyzer

`AudioSyncAnalyzer` は第1アングルと第2アングルの音声波形を比較し、上記の signed offset を返します。相関計算で使用する開始位置は次の契約です。

```typescript
const start1 = Math.max(0, -offset);
const start2 = Math.max(0, offset);
```

解析結果は第2アングルの `syncOffset` と、存在する場合は `angleOffsets[1]` へ同時に反映します。

## マルチアングル保存形式

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

- `angleOffsets[index]` は `.metadata/config.json` の `angles[index]` に対応します。
- `angleOffsets[0]` は常に `0` です。
- `angleOffsets[index]` が欠けた旧パッケージでは `syncOffset` を互換値として利用します。
- `angleOffsets[1]` が存在する最新状態では `syncOffset` と同値に正規化します。
- 既知の旧バージョンによる不整合はパッケージ読み込み境界で修復します。
- IPC 境界では最大8要素、有限値、絶対値24時間以内を検証します。

## クリップ単位シンクとの境界

`timelineStartSeconds` はクリップが**共通タイムライン上のどこに置かれるか**を表す絶対配置です。複数クリップ、または開始位置が0秒ではないクリップを持つアングルでは、これを再生位置の正本とします。

その場合は次の規則を適用します。

```text
virtual clip timeline
  -> timelineStartSeconds が配置の正本
  -> effective angle offset = 0
  -> angleOffsets を重ねて適用しない
```

したがって、クリップ配置済みの先頭2アングルに対して旧来のアングル単位音声同期・手動 offset 同期を追加適用しません。調整は「クリップ単位シンク」で行います。

YouTube の開始ギャップも `timelineStartSeconds` で表現します。同じギャップを派生 `playbackOffsetSeconds` として二重保持しません。

## 再生時計

通常の単一メディア再生では、第1アングルの Video.js 実メディア時刻が global time です。

virtual clip timeline では次のように扱います。

1. 映像クリップ再生中: `clip.timelineStartSeconds + video_0.currentTime()` を global time とする。
2. 黒ギャップ中: 実メディアが存在しないため、再生レートを考慮した経過時間で global time を進める。
3. バッファリング中: 実メディア時刻が進んでいない限り global time も進めない。
4. 次のクリップ開始位置を越えて壁時計で飛び越さず、開始位置へ正確に着地する。

## 再生責務

- `SingleVideoPlayer` / Player 層が Video.js の再生・停止を所有します。
- `VideoController` は再生状態や global time の操作要求を発行します。
- Controller が各アングルへ独自の offset 計算を行ったり、全 Video.js インスタンスを直接 `play/seek` したりしません。
- シーク、同期再適用、manual mode 遷移も同じ時刻変換契約を使います。

## 音声

- `video_0` のみ音声を再生します。
- `video_1` 以降はミュートし、重複音声を防ぎます。

## トラブルシューティング

### 映像の同期位置がずれる

確認事項:

1. `angleOffsets[1]` と `syncOffset` が同じ値に正規化されているか。
2. 直接メディアの再生計算が `globalTime + offset` になっているか。
3. virtual clip timeline に angle offset を重ねていないか。
4. 音声同期の信頼度が十分か。
5. 両動画に解析可能な音声トラックが存在するか。

### 複数クリップの途中で位置が飛ぶ

確認事項:

1. `timelineStartSeconds` が絶対配置として保存されているか。
2. クリップ切替時に旧ソースの Video.js 時刻を新クリップへ流用していないか。
3. 黒ギャップ以外で壁時計だけを進めていないか。

## 更新履歴

- 2025-11-23: 初版作成。
- 2026-07-26: マルチアングル `angleOffsets` と `syncOffset` 後方互換を追加。
- 2026-08-10: global/media 時刻変換を一本化し、virtual clip timeline との二重補正禁止、ロード時正規化、再生時計と責務境界を明文化。
