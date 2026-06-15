# 0001 Feature-First Boundaries

## Status

Accepted

## Date

2026-05-04

## Context

SporTagLytics は video player、playlist、settings、analysis report など複数の機能を持つ Electron + React アプリです。過去の実装では、page、shared hook、shared context、feature 内部実装の境界が曖昧になると、責務混在と deep import が増え、AI agent が変更範囲を誤認しやすくなります。

Atomic Design をアプリ全体のフォルダ規約にすると、画面固有の状態や外部依存まで UI 分類へ寄りやすく、Electron / persistence / domain logic の分離が弱くなります。

## Decision

Feature-First を維持します。

- 依存方向は `pages -> features -> shared` とする。
- `pages` は routing と feature composition に限定する。
- feature 外から feature を参照する場合は `src/features/<feature>/index.ts` の公開 API のみ使う。
- `shared -> features` と `features -> pages` を禁止する。
- 複雑な UI は `Screen / Controller(or Hook) / View / Gateway` で分割する。
- Atomic Design は `src/components/ui` の shared UI 設計メンタルモデルに限定し、feature フォルダ規約にはしない。

## Consequences

- feature ごとの変更範囲が明確になり、レビューと AI agent の探索が安定する。
- page wrapper は薄く保たれ、画面固有の副作用は feature 側へ閉じ込められる。
- shared 層は再利用可能な型、pure helper、shared UI に集中できる。
- feature 間で直接内部実装を共有したい場合は、公開 API に出すか shared へ抽出する判断が必要になる。
