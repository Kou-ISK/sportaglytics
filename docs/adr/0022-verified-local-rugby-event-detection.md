# 0022 Verified Local Rugby Event Detection

## Status

Superseded

## Date

2026-08-15

## Related ADRs

- Extends: [0002 Typed Electron IPC and Renderer Gateways](0002-typed-electron-ipc-and-renderer-gateways.md)
- Extends: [0020 Verified Media Toolchain and Process Containment](0020-verified-media-toolchain-and-process-containment.md)
- Superseded by: [0023 External Rugby Event Model R&D Boundary](0023-external-rugby-event-model-rd-boundary.md)

## Context

ラグビー映像ではスクラム、ラインアウト、リスタートなどを自動検出できれば、分析者が試合全体を先頭から見てイベント位置を探す作業を減らせる。一方、低精度な自動タグ付けは誤検出修正を増やし、手動 Coding より遅い体験になり得る。特にモデルの学習・評価条件と製品実行時の confidence 閾値が異なると、評価値だけ高い未検証状態を製品へ持ち込む危険がある。

SporTagLytics の Coding では「リスタート」を、50m キックオフだけでなく 22m ドロップアウト、トライライン/ゴールラインドロップアウトなど試合をキックで再開する場面を含む上位概念として扱う。初期データ量ではこれらを細分化せず、canonical event type `restart` として共同学習する。過去データの `Kickoff` / `キックオフ` は `restart` の教師ラベルへ正規化し、canonical type として `kickoff` は使用しない。

既存のタイムライン、ダッシュボード、クロス集計、プレイリストは `TimelineData` を中心に連携している。自動検出専用の並行データモデルをユーザー操作へ持ち込むと、手動分析との境界が複雑になる。また、映像推論は CPU/GPU 負荷が大きく、Electron main/renderer のイベントループ内で直接実行すべきではない。

## Decision

- 自動イベント検出は「分析結果の自動生成」ではなく、通常の Timeline を初期作成する Coding assistance と位置付ける。
- 製品で利用可能なモデルは `verified` model pack のみとする。`experimental` model pack は一般ユーザーの実行候補へ出さない。
- event class ごとに少なくとも Precision >= 0.95、Recall >= 0.90、match 単位で分離した unseen evaluation match >= 5、正解時刻 ±2 秒以内の割合 >= 0.90 を満たすという初期 gate を採用する。
- runner executable は model pack 内に置き、platform/architecture ごとの相対 path と SHA-256 を manifest に保存する。main process は実行前に path traversal、存在、hash、品質ゲートを検証する。
- 推論は Electron renderer/main 内で実行せず、main process が有限 timeout の child process として runner を起動する。`shell: false` とし、request/result は一時 JSON file で交換する。cancel、result size 上限、stderr 上限、sender/payload validation を持つ。
- renderer は `window.electronAPI.eventDetection` の明示 API のみ使用する。IPC contract は `src/types/ipc/eventDetection.ts` を正本とする。
- detector result は Timeline へ追加する直前に confidence filter と重複除去を行う。追加後は通常の `TimelineData` として扱い、AI/モデル固有 field を `TimelineData` へ追加しない。
- 同一検出runの複数eventは1回の state update で一括追加し、1回の Undo で戻せるようにする。
- 手動 Coding と自動検出は同じ lead/lag range calculation を使用する。
- 初回研究学習はSporTagLytics repository内の `research/rugby-event-detection/` に隔離する。

## Consequences

- runtime と model pack の安全境界は確立された。
- 一方、モデル研究コード・dataset preparation・研究CIまでpublic application repositoryへ含めたことで、製品開発とモデル研究のrelease cycle、privacy boundary、依存関係が混在した。
- Precision優先の初期gateは、実際のCoding作業では「ほぼ全件を先に出し、不要候補を削除する」方が楽というworkflowに十分合っていなかった。
- これらの点は ADR 0023 で置き換える。
