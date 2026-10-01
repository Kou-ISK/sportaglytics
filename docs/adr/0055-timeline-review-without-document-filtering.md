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

目的の場面をノートやラベルから見つけて既存の編集・共有準備へ進める。検索結果と書き出し対象が混同されにくい。新しいIPCやデータmigrationは不要。検索結果は40件ずつ表示しDOMの増加を抑えるが、検索計算自体は文書全体に比例する。極端な件数での索引・仮想化や、検索結果の一括操作はこの判断に含まない。操作の正本は[Timeline review](../timeline-review.md)。
