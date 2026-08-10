# 0016 Multi-angle audio sync offset persistence

## Status

Accepted

## Date

2026-07-26

## Related ADRs

- Supersedes: [0007 Audio sync offset contract](0007-audio-sync-offset-contract.md)
- Related: [0015 Clip timeline placement and audio-assisted sync](0015-clip-timeline-placement-and-audio-assisted-sync.md)
- Superseded by: N/A

## Context

ADR 0007 は `video_0` を基準とする signed offset と加算による適用式を定めたが、保存値は単一の `syncOffset` を前提としていた。最大8アングルへ拡張した後も単一値を全対象へ適用すると、アングルごとに異なる同期位置を保持できない。一方、既存パッケージの `syncData.syncOffset` は引き続き読み込む必要がある。

ADR 0015 では `timelineStartSeconds` をクリップの共通タイムライン上の絶対配置として定義した。したがって、同じ再生時刻に対して `timelineStartSeconds` とアングル単位の offset を重ねて適用すると二重補正になる。再生制御・シーク・手動同期・自動音声同期・パッケージ読み込みで同じ時刻変換契約を使う必要がある。

## Decision

- 共通タイムラインの基準は常に第1アングル (`video_0`) とし、global time は `0` 以上とする。
- `VideoSyncData.angleOffsets` をアングル index に対応する任意の配列として保存し、`angleOffsets[0]` は基準アングルのため `0` とする。
- **直接メディアとして再生するアングル**の再生時刻は `mediaTime = globalTime + angleOffsets[index]` で求める。正負の意味は ADR 0007 の `syncOffset` と同じとする。
- `angleOffsets[index]` が存在しない旧データは、`syncOffset` を後方互換値として対象アングルへ適用する。
- `syncOffset` は必須の互換フィールドとして維持し、従来の2アングル音声解析と手動同期では第2アングルの値を表す。新しい保存状態では `angleOffsets[1]` が存在する場合、`syncOffset` と同値に正規化する。
- 既知の旧データ不整合はパッケージ読み込み境界で修復し、renderer の再生ロジックへ互換分岐を持ち込まない。
- IPC境界では最大8要素、有限値、絶対値24時間以内を検証する。
- `timelineStartSeconds` はクリップの**共通タイムライン上の絶対配置**、`angleOffsets` は**直接メディアのアングル単位再生補正**として扱う。
- `usesVirtualClipTimeline(...)` が真となるアングルでは `timelineStartSeconds` を唯一の配置基準とし、再生時の実効 angle offset は `0` とする。`timelineStartSeconds` と `angleOffsets` を重ねて適用してはならない。
- クリップ配置済みの先頭2アングルに対して、旧来のアングル単位自動音声同期・手動offset同期を新たに適用しない。位置調整はクリップ単位シンクで行う。
- 再生/停止の副作用は Player 層が所有し、VideoController は共通時刻・再生状態の操作要求のみを行う。Controller が独自に offset の符号計算や各プレイヤーの直接 `play/seek` を行わない。
- virtual clip timeline の共通時計は、映像クリップ再生中は第1アングルの実メディア時刻から算出し、意図的な黒ギャップ区間だけ経過時間で進める。バッファリング中に壁時計だけを進めない。

## Consequences

- 3アングル以上で個別 offset を保持しながら、`syncOffset` だけを持つ旧パッケージを読み込める。
- 配列の index は `.metadata/config.json` の `angles[]` と同じ順序を維持する必要がある。
- 一部 index だけが欠けた場合は互換値へフォールバックするため、新形式を書き出す処理は可能な限り全アングル分の配列を保持する。
- `syncOffset` と `angleOffsets[1]` の既知の不整合はロード時に正規化される。
- YouTube/ローカルを問わず、クリップの開始ギャップは `timelineStartSeconds` で表現し、別の派生 playback offset として二重保持しない。
- 再生、シーク、強制再同期、manual mode への遷移は同一の時刻変換ヘルパーを使用するため、符号契約を各UI層が独自実装しない。
- offset の符号または適用式を変更する場合は、保存データ migration、IPC guard、再生計算、仕様書、テストを同じ変更で更新する必要がある。
