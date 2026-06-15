# Shared UI Design System

このディレクトリは共通 UI のみを対象にした design-system 層です。

## 方針
- アプリ全体は Feature-First を維持する。
- Atomic Design はメンタルモデルとしてのみ利用する。
- 実装分類は `primitives / composites / patterns` を推奨する。

## 例
- `primitives`: Button, Chip, Dialog など最小単位
- `composites`: 複数 primitives の組み合わせ
- `patterns`: 画面横断で再利用する構造化 UI
