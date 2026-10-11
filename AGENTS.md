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
5. `docs/adr/`:
   長期的な設計判断の記録（規約本文ではなく判断背景）。
6. `docs/README.md` / `docs/documentation-guide.md`:
   ドキュメント索引と運用ルール。

## 適用範囲と競合の扱い

- システム・ツール・ユーザーからの明示指示を前提に、このルート `AGENTS.md` をリポジトリ全体の共通規約とする。
- 変更対象の親ディレクトリに階層 `AGENTS.md` がある場合は、その配下の差分規約も読む。現時点ではルートのみで、`.agents/skills` は配置していない。
- 階層規約や `.github/instructions/*.instructions.md` は対象範囲の補足とする。`applyTo` が具体的という理由だけで共通規約を緩めない。意図した例外は「例外管理」に従って明示する。
- `.github/copilot-instructions.md` はCopilotの入口、`.github/technical-instructions.md` は背景説明であり、共通規約を上書きしない。
- ツールによって自動読込対象が異なるため、対象に適用される規約を明示的に確認する。矛盾を解消できない場合は該当箇所を報告し、実装判断を保留する。

## 規約の強度

- `MUST`: 必須。違反は修正対象。
- `SHOULD`: 推奨。明確な理由がある場合のみ逸脱可。
- `MAY`: 任意。

## 技術基準

依存の指定範囲と実行コマンドは `package.json`、解決済みの正確な版は `pnpm-lock.yaml` を正本とする。セットアップは [開発環境](docs/development.md#開発環境) に従う。

- React 19（関数コンポーネントのみ）
- TypeScript 5（`strict: true`。解決版はlockfile参照）
- Electron 43
- Material UI 7
- Video.js 8
- pnpm 9.1.0（`packageManager` とCIに合わせる）

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

- `MUST`: UI変更時は `docs/design-system.md` と `src/design-system` のsemantic tokenを正本として扱い、feature内にUI chrome用の色・z-index・elevationを直接追加しない。
- `MUST`: UI変更時は `pnpm run check:design-system` とStorybook buildを確認する。

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

## ADR / ドキュメント運用

- `MUST`: 仕様・設計・ユーザー影響・開発手順・配置判断が変わる場合は、同一 PR で該当ドキュメントを更新する。
- `MUST`: 長期的な設計判断を追加・変更する場合は `docs/adr/` に ADR を追加または更新する。
- `MUST`: ADR の採番・命名・状態変更は `docs/documentation-guide.md` の ADR Operations に従う。
- `MUST`: ADR ファイル名には 4 桁ゼロ埋め ID を含め、ADR 変更時は `pnpm run check:adr` を実行する。
- `MUST`: 新規ドキュメントを追加する場合は `docs/README.md` から辿れるようにする。
- `MUST`: ドキュメント運用は `docs/documentation-guide.md` に従う。
- `MUST`: Docs Impact Matrixで更新先を判断し、ユーザー影響・設計変更時は `docs/system-overview.md` と `docs/development.md` も確認する。配置判断の変更は `docs/project-structure.md` へ反映する。
- `MUST`: ドキュメント更新不要と判断する場合は、PR で理由を明示する。
- `SHOULD`: ADR には `Context / Decision / Consequences` を含め、実装差分の羅列ではなく判断背景を残す。

## 旧実装の扱い

- `MUST`: deprecated 経路・未使用コード・`.old` ファイルは削除対象。
- `MUST`: 既存データ互換はロード時マイグレーションで担保する。
- `MUST`: 保存形式は最新モデルへ統一する。

## Git / ブランチ / コミット運用

- `MUST`: 作業ブランチは `develop` 最新から作成する。ただし release / hotfix など明示された場合はその指示を優先する。
- `MUST`: ブランチ名は `<prefix>/<short-kebab-description>` とし、英小文字・数字・ハイフンを使う。
- `MUST`: 通常作業のブランチ `prefix` は `feature`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf` のいずれかを使う。
- `MUST`: `release` / `hotfix` prefix は release / 緊急修正作業として明示された場合のみ使う。
- `MUST`: 新機能ブランチの prefix は既存運用に合わせて `feature` とする。Conventional Commits の `feat` をブランチ prefix として使わない。
- `MUST`: 通常作業は作業ブランチから `develop` への PR で統合する。
- `MUST`: リリース時は release 準備コミットを `develop` に統合した後、`develop` から `main` への PR を作成し、PR マージ後の `main` にリリースタグを作成する。
- `MUST`: `main` へ直接 merge / push しない。ただし緊急 hotfix で明示承認がある場合のみ例外とし、理由を PR または release note に残す。
- `MUST`: コミットメッセージは Conventional Commits 形式の `<type>(<scope>): <subject>` または `<type>: <subject>` を使う。
- `MUST`: コミット `type` は変更内容に合わせて `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `build`, `ci`, `revert` から選ぶ。
- `SHOULD`: `scope` は feature / domain / tooling 名を短く指定する（例: `fix(timeline): enable duplicate action`）。
- `SHOULD`: 1 コミットはレビュー可能な意味単位にし、無関係な変更を混ぜない。

## 公開情報とプライバシー

- `MUST`: 本リポジトリは公開OSSとして扱い、[公開時のデータ取り扱い](docs/privacy-and-data-handling.md#sharing-and-issue-reports)に従う。コード・docs・fixture・PR・Issue・ログ・画像・コミット情報を公開前に確認する。
- `MUST`: ローカルデータの調査・学習・検証への利用許可を公開許可と解釈しない。個人情報、実試合を特定する情報、私的なアカウント状態は含めず、再現例には架空の名前と相対パスを使う。
- `MUST`: 公開済みの問題は通常の修正で対応し、履歴の書換え・force-pushは別途明示的な承認なしに行わない。

## 品質ゲートと変更の検証

- `MUST`: [Testing and Quality Gates](docs/testing.md#required-quality-gate) の共通ゲートと変更対象ごとの追加検証を実行する。`pnpm run verify` は型・lint・境界・design-system・ADR・unit・アプリbuild・Storybookをまとめて実行するが、OS別E2Eや配布検証は含まない。
- `MUST`: PRに実行環境、実行したコマンド、結果、未実施範囲と理由を残す。実行できなかった検査を合格と扱わず、必要なCI/対応OSの検証をmerge前に確認する。
- `MUST`: AI生成部分も提出者が差分・根拠・失敗経路をレビューする。コマンド成功だけで正しさ、権利、機密情報の不在を保証しない。
- `MUST`: 追加・流用するコード、画像、フォント、fixture、モデル、binaryは出典・版/hash・license/NOTICE・配布範囲を確認する。未確認事項は [由来の確認台帳](docs/provenance-review.md) に従って明示し、権利確認済みと記載しない。

## レポート運用

- `SHOULD`: 月次で巨大ファイル残件レポートを生成し、優先順位を更新する。
- `SHOULD`: `pnpm run report:large-files` の結果をリファクタ計画へ反映する。

## PR チェックリスト

- [ ] 公開内容とコミット情報に、公開許可のない個人情報・実データ由来の識別情報を含めていない。
- [ ] 依存方向違反がない（`pages -> features -> shared`）。
- [ ] feature 公開面（`src/features/<feature>/index.ts`）経由 import に統一されている。
- [ ] Renderer の Electron 呼び出しが `window.electronAPI` 経由のみ。
- [ ] Electron セキュリティ基準を満たしている。
- [ ] 変更ファイルの責務分離（`Screen / Controller(or Hook) / View / Gateway` または同等）を説明できる。
- [ ] Story 対象 UI が `View` として分離され、`window.electronAPI` / URL / 永続化へ直接依存していない。
- [ ] `src/components/ui` に feature 固有依存または Electron 依存を持ち込んでいない。
- [ ] 例外がある場合は `docs/architecture-exceptions.md` に記録した。
- [ ] 設計判断がある場合は `docs/adr/` に記録した。
- [ ] ADR を追加・更新した場合は ADR Operations に従い、`docs/adr/README.md` を更新した。
- [ ] 新規ドキュメントがある場合は `docs/README.md` に追加した。
- [ ] ディレクトリ構成・配置判断が変わる場合は `docs/project-structure.md` を更新した。
- [ ] ドキュメント更新不要の場合は PR に理由を記載した。
- [ ] 共通ゲートと変更対象ごとの追加検証を実行し、結果・未実施範囲をPRに記載した。
- [ ] AI生成部分を含めて人がレビューできる差分と検証根拠を用意した。
- [ ] 追加資産の出典・license・配布範囲を確認し、未確認項目を明示した。
