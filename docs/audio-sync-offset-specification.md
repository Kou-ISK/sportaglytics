# 音声同期オフセット仕様

## 概要

SporTagLytics における音声同期オフセット（`offsetSeconds`）の符号、探索、confidence、適用、保存形式を定義します。

関連 ADR:
- [0015 Clip timeline placement and audio-assisted sync](adr/0015-clip-timeline-placement-and-audio-assisted-sync.md)
- [0016 Multi-angle audio sync offset persistence](adr/0016-multi-angle-audio-sync-offset-persistence.md)

## オフセットの定義

`video_0` を基準とし、対象映像は次の式で再生します。

```text
targetTime = globalTime + offsetSeconds
```

- `offsetSeconds > 0`: 対象映像が基準映像より早く収録開始しており、対象映像のより後ろの時刻を再生する。
- `offsetSeconds < 0`: 基準映像が対象映像より早く収録開始しており、対象映像のより前の時刻を再生する。

相関計算でも正の offset は `video1[i]` と `video2[i + offset]` を比較するため、この符号契約を維持します。

## 自動音声同期

ローカル映像の自動同期は固定 ±30秒を既定値にしません。

1. 音声を mono waveform として decode する。
2. raw PCM を約20Hzの RMS/energy feature へ縮約し、DC/level 差の影響を抑えるため正規化する。
3. 先頭固定ではなく、十分な energy と変化量を持つ複数 window を両映像から選ぶ。
4. 両 clip の duration から可能な overlap 全域を coarse search し、互いに離れた Top-K offset 候補を保持する。
5. 各候補を feature frame 単位で fine search する。
6. 最良候補の近傍だけ raw PCM で millisecond → sample 単位に refine する。
7. broad search は定期的に event loop へ制御を返し、UI を長時間占有しない。

`analyzeAudioSyncOffset(..., maxOffsetSeconds)` のように呼び出し側が明示的な上限を指定した場合だけ、その上限を探索制約として尊重します。

## Confidence

confidence は単純な `(correlation + 1) / 2` ではありません。以下を組み合わせて 0〜1 に正規化します。

- best candidate の feature correlation
- second-best candidate との差
- 複数 energy window が同じ候補を支持する consistency
- 利用できた window 数 / coverage
- raw PCM refine の correlation

`confidence < 0.35` または offset が非有限の場合、自動同期結果は **適用しません**。現在の `syncData` と手動配置を維持し、ユーザーへ手動確認を促します。

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

- `angleOffsets[0]` は基準アングルなので `0`。
- `angleOffsets[index]` がない旧パッケージは `syncOffset` を後方互換値として使う。
- IPC 境界では最大8要素、有限値、絶対値24時間以内を検証する。
- `timelineStartSeconds` はクリップ配置、`angleOffsets` はアングル再生補正であり、別の契約とする。

## トラブルシューティング

### confidence が低い

自動結果は適用されません。両映像に同じ笛・拍手・会場音などが含まれていることを確認し、必要なら手動同期を利用してください。無音や unrelated audio を無理に同期させないことを優先します。

### 大きく開始位置がずれている

通常は duration 全域を coarse search するため、45秒や数分の差も探索対象です。明示的な `maxOffsetSeconds` を指定した内部呼び出しでは、その範囲外は探索しません。

### 音声が二重に聞こえる

標準再生では `video_0` だけを有音とし、対象アングルはミュートします。offset 適用式が `globalTime + offset` であることも確認します。

## 更新履歴

- 2025-11-23: 初版作成
- 2026-07-26: `angleOffsets` と multi-angle persistence を追加
- 2026-08-19: broad multi-window search、composite confidence、low-confidence apply guard を追加
