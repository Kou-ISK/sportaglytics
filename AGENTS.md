# SporTagLytics AGENTS Guide

このファイルは本リポジトリの AI 実装規約の正本です。

## 目的
最優先は次の 4 点です。

1. 保守性
2. 可読性
3. 責務分離
4. 安全性（型安全 / Electron セキュリティ）

## 指示ファイル設計（重要）
1. `AGENTS.md`:
   全エージェント共通の不変ルール（アーキテクチャ、品質ゲート、セキュリティ）。
2. `.github/copilot-instructions.md`:
   Copilot 向けの入口ガイド（正本参照 + 適用順序 + 実行手順）。
3. `.github/instructions/*.instructions.md`:
   `applyTo` の差分ルールのみ。
4. `.github/technical-instructions.md`:
   背景メモのみ（規約本文の重複禁止）。

## 規約の優先順位
1. `AGENTS.md`
2. `.github/copilot-instructions.md`
3. `.github/instructions/*.instructions.md`
4. `.github/technical-instructions.md`

## 規約の強度
- `MUST`: 必須。違反は修正対象。
- `SHOULD`: 推奨。明確な理由がある場合のみ逸脱可。
- `MAY`: 任意。

## 技術基準（固定）
- React 19（関数コンポーネントのみ）
- TypeScript 5.4（`strict: true`）
- Electron 40
- Material UI 7
- Video.js 8
- pnpm 9

## アーキテクチャ方針
- `MUST`: Feature-First を維持する（`pages -> features -> shared`）。
- `MUST`: feature 外から feature を参照する場合は `src/features/<feature>/index.ts` のみ使う。
- `MUST`: `shared -> features` と `features -> pages` を禁止する。
- `MUST`: `pages` はルーティングと feature 合成に限定する。
- `MUST`: `src/features/**` では機能責務で分割し、Atomic 分類で構成しない。
- `MUST`: 再利用対象または複雑な UI は `Screen / Controller(or Hook) / View` で責務を分離する。
- `MUST`: Electron・URL・永続化などの外部依存は `Gateway/Adapter` または `Controller/Hook` に閉じ込め、`View` から直接触れさせない。

## Atomic Design の扱い
- `MUST`: Atomic Design をアプリ全体のフォルダ規約として強制しない。
- `MUST`: Atomic Design は共通 UI 設計（design system）のメンタルモデルとしてのみ利用する。
- `MUST`: 共通 UI の採用範囲は `src/components/ui` に限定する。
- `SHOULD`: `src/components/ui` は `primitives / composites / patterns` で整理する。
- `MAY`: atoms/molecules/organisms の語彙を補助的に使用してもよい。

## TypeScript 実装規約
- `MUST`: `any` を禁止（不可避時は理由コメント必須）。
- `MUST`: exported 関数は戻り値型を明示する。
- `MUST`: 型 import は `import type` を使う。
- `MUST`: 根拠のない `as` 断定キャストを禁止する。
- `SHOULD`: `unknown` + 型ガードで絞り込む。
- `SHOULD`: 互換フィールドは型へ残さず、ロード時マイグレーションで吸収する。

## React 実装規約
- `MUST`: 空状態・エラー状態を明示する。
- `MUST`: `useEffect` は依存配列を省略せず、必要な cleanup を実装する。
- `MUST`: 状態源を最小化し、派生値は計算で表現する。
- `SHOULD`: 重い派生値は `useMemo`、イベントハンドラは `useCallback` で安定化する。

## UI / Storybook 対応規約
- `MUST`: Storybook の対象となる UI は `View` とし、props だけで描画可能にする。
- `MUST`: `pages` と `Screen` は story の主対象にしない。story の主対象は `src/components/ui` と feature 配下の `View` コンポーネントに限定する。
- `MUST`: `View` は `window.electronAPI`、IPC 呼び出し、URL/hash 読み取り、直接永続化、`BrowserWindow` 前提の分岐に依存しない。
- `MUST`: `View` はアプリ全体の状態源を内包しない。必要な状態と操作は `Controller/Hook` から props と callback で受け取る。
- `MUST`: `src/components/ui` は shared UI に限定し、feature 固有 hook・feature 固有 state・Electron 依存を持ち込まない。
- `SHOULD`: Provider が必要な UI は `Screen` または decorator で注入できる構造にし、`View` 自体を provider 必須にしない。
- `SHOULD`: Story 用の fixture / mock data は `shared/testing` または各 feature 配下の `testing` / `fixtures` に置き、`View` が本番 IPC に依存しなくても表示できるようにする。

## Electron / IPC 規約
- `MUST`: Renderer からの Electron 呼び出しは `window.electronAPI` のみ。
- `MUST`: `src` 側で `electron` / `ipcRenderer` を直接 import しない。
- `MUST`: preload は最小公開面のみを公開し、汎用イベントバス API（汎用 `on/off/send`）を増やさない。
- `MUST`: IPC payload と sender を検証する。
- `MUST`: IPC 型定義の正本は `src/renderer.d.ts`。
- `MUST`: `window.electronAPI` の使用箇所は `Screen` / `Controller/Hook` / `Gateway` に限定し、`View` と `src/components/ui` から直接呼ばない。

## Electron セキュリティ基準
全 BrowserWindow で以下を適用する。
- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- `webSecurity: true`
- 不要なナビゲーション / `window.open` を拒否

## ファイル分割方針（Soft Budget）
- `MUST`: 行数に関係なく、`UI描画` と `IPC/永続化` と `ドメイン計算` の同居を禁止する。
- `MUST`: Story 化対象の UI を追加・変更する場合、描画専用 `View` と外部依存を持つ層を同一ファイルに同居させない。
- `MUST`: 変更対象ファイルが巨大かつ責務混在している場合は、同PRで最低1段の分割を行う。
- `SHOULD`: 目安として `TSX <= 300行`, `TS <= 450行` を維持する。
- `MAY`: 既存巨大ファイルは、触る範囲で段階分割する（全面一括移行しない）。
- `MUST`: 行数は Warn Only とし、CI fail 条件にはしない。

## 例外管理
- `MUST`: 例外は `docs/architecture-exceptions.md` に記録する。
- `MUST`: 例外には `理由 / 影響範囲 / 解消期限 / 担当` を含める。

## 旧実装の扱い
- `MUST`: deprecated 経路・未使用コード・`.old` ファイルは削除対象。
- `MUST`: 既存データ互換はロード時マイグレーションで担保する。
- `MUST`: 保存形式は最新モデルへ統一する。

## 品質ゲート（CI fail 条件）
```bash
pnpm exec tsc --noEmit
pnpm exec tsc -p electron/tsconfig.json
pnpm run lint
pnpm run check:architecture
pnpm run test:run
```

## レポート運用
- `SHOULD`: 月次で巨大ファイル残件レポートを生成し、優先順位を更新する。
- `SHOULD`: `pnpm run report:large-files` の結果をリファクタ計画へ反映する。

## ドキュメント同期
- `MUST`: ユーザー影響・設計変更がある場合は `docs/system-overview.md` と `docs/development.md` を更新する。

## PR チェックリスト
- [ ] 依存方向違反がない（`pages -> features -> shared`）。
- [ ] feature 公開面（`src/features/<feature>/index.ts`）経由 import に統一されている。
- [ ] Renderer の Electron 呼び出しが `window.electronAPI` 経由のみ。
- [ ] Electron セキュリティ基準を満たしている。
- [ ] 変更ファイルの責務分離（`Screen / Controller(or Hook) / View / Gateway` または同等）を説明できる。
- [ ] Story 対象 UI が `View` として分離され、`window.electronAPI` / URL / 永続化へ直接依存していない。
- [ ] `src/components/ui` に feature 固有依存または Electron 依存を持ち込んでいない。
- [ ] 例外がある場合は `docs/architecture-exceptions.md` に記録した。
- [ ] 品質ゲート 5 コマンドを全通過。
