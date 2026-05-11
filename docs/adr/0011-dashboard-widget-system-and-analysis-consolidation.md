# 0011 Dashboard Widget System and Analysis Consolidation

## Status

Accepted

## Date

2026-05-06

## Context

SporTagLytics の分析機能は、ポゼッション、アクション結果、アクション種別、クロス集計、AI 分析など複数の見方を提供します。v0.4.0 以降、旧来の固定タブの一部はダッシュボードの widget / custom chart で表現できるようになりました。

分析表示を個別タブとして増やし続けると、集計ロジック、フィルタ、print/report 出力、dashboard template の保存形式が重複します。ダッシュボードは `.stad` document format として保存・共有されるため、単なる UI 配置ではなく分析 surface の拡張単位として扱う必要があります。

## Decision

分析機能の拡張可能な統計 surface は dashboard widget system を中心にします。

- 固定タブは、モメンタム、クロス集計、AI 分析のように dashboard widget では代替しにくい分析体験に限定する。
- ポゼッション、アクション結果、アクション種別など widget / custom chart で表現できるものは、独立タブとして復活させない。
- dashboard configuration は settings / `.stad` package / report generation の共有 contract として扱う。
- dashboard import/export は gateway と pure service に分離し、controller に JSON parse、file dialog、read/write を同居させない。
- widget type、metric、axis、filter、template の追加は settings defaults、normalizer、import/export、user docs、必要な report 出力を同じ変更で更新する。
- `.stad` の document format と OS file association は ADR 0006 の public contract に従う。

## Consequences

- 分析 UI の増加を dashboard widget system に集約でき、固定タブの重複を避けられる。
- dashboard template、settings migration、report 出力の互換性をレビュー対象にできる。
- 新しい分析表現を追加するときは、固定タブにする理由があるか、widget で表現すべきかを先に判断する必要がある。
- dashboard configuration は保存・共有されるため、破壊的変更には migration と docs 更新が必要になる。
