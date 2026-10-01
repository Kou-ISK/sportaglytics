# 0055 Timeline review without document filtering

## Status

Accepted

## Date

2026-10-01

## Context

Timelineの行名や区間バーだけでは、数百件のノート・ラベルから目的の場面を見つけにくい。一方、検索で編集面の行や区間を除くと、範囲選択・全選択・書き出しが文書全体か検索結果か曖昧になる。映像とTimelineの独立ウィンドウ、集中Codingの既存面積を維持する必要がある。

## Decision

開閉できるレビュー欄へ検索結果と1件の詳細を表示する。検索は文書の読み取り専用の派生値とし、Timelineの表示対象と保存形式を変更しない。選択・映像移動・編集・Playlist追加は既存controllerへ渡す。検索UIはprops-only、検索語とページはhook内の一時状態とする。狭幅ではレビューと編集面を切り替え、既定は閉じる。

Tabを場面巡回に使わず、通常focus移動へ戻す。既存のOption/Alt+上下による同一行の巡回を残す。

## Consequences

目的の場面をノートやラベルから見つけて既存の編集・共有準備へ進める。検索結果と書き出し対象が混同されにくい。検索自体は新しいIPCやデータmigrationを必要としない。検索結果は40件ずつ表示しDOMの増加を抑えるが、検索計算自体は文書全体に比例する。極端な件数での索引・仮想化や、検索結果の一括操作はこの判断に含まない。操作の正本は[Timeline review](../timeline-review.md)。

## 2026-10-01 layout revision

検索を左へ固定すると時間軸の横幅を短くし、狭幅の切替では比較対象が消える。全幅を維持する下部dockを採用し、検索・件数・page・操作menuを1行へ、結果と全文詳細を左右へ配置する。表示行数は減るため、既定は閉じる。overlayでタグを覆う方法と、追加windowへfocusを移す方法を避け、closeで面積とfocusを戻す。最小高さは全文を同時に読める保証ではなくscrollのtradeoffとし、実pixel評価を技術gateと分ける。

Native最小外寸は720×300とする。Windowsでは旧260px外寸のclientが195pxとなり、軸・32px行・32px操作と検索の完全1行の空間予算が足りなかった。native最小を上げてresizeを制限し、最小時の検証では実client領域と外側scroll位置を使う。Storyの最小dockは32px結果1行を含む74px内寸相当を提示し、OSのframe付きwindowはElectron E2Eで別途確認する。260px要求のclampは成功時の実外寸/client寸法を記録する。

## 分析窓の受信準備と統合回帰

Window > 分析は所有Rendererへ配送する。Mainは所有sessionの最新分析payloadを保持し、分析Rendererがlistenerを登録した後のready requestだけへ再送する。open前に希望viewを含むsnapshotを確保し、did-finish-loadだけでReactの受信準備が完了したと扱わない。別session/未登録Windowからの要求を拒否し、Main終了時はcacheを除去する。reloadも同じ受信準備手順を使い、保存文書やTimeline検索条件を変更しない。

PR189/190の統合nativeで分析初回240件の受信が失敗したため、試験のtimeout/件数を緩めずこのhandshakeを追加した。重点unitは遅いlistenerとsession隔離、nativeは初回と実Renderer reload後の240件・編集済みノートを確認する。
