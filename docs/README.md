# SporTagLytics Documentation

0.17.3は、配布なしとなった0.17.2の変更を含む修正版です。[変更履歴](../CHANGELOG.md#0173---2026-10-04)、[公開済みの配布物](https://github.com/Kou-ISK/sportaglytics/releases)、[Release手順](../.github/RELEASE.md)を参照してください。

- [compact density評価](reports/2026-10-compact-density.md): Timelineの下部検索ドック・共通フォームの変更と検証範囲。
- [Timelineの場面検索とレビュー](timeline-review.md): 検索、全文確認、編集・Playlistへの移動。
- [UX評価と改善の検証記録](reports/2026-10-ux-review.md): 実Electronの代表導線、before/after、測定と未評価範囲。

ライブ撮影中の分析は[ライブキャプチャとコーディング](live-coding.md)を参照してください。設計判断は[ADR 0053](adr/0053-live-capture-package-timeline.md) / [ADR 0054](adr/0054-continuous-capture-playback.md)です。

Sorterの再生順と旧ファイル移行は[ADR 0047](adr/0047-playlist-sorter-presentation-order.md)を参照してください。

このディレクトリは SporTagLytics のドキュメント入口です。実装規約の正本はリポジトリルートの `AGENTS.md` です。本ページは、利用者、開発者、AI contributor が必要な情報へ最短で辿れるように整理します。

再生時刻の補正方針は[ADR 0046](adr/0046-coalesced-playback-corrections.md)を参照してください。

ダッシュボードの固定テンプレートと複製・保存の契約は[ADR 0056](adr/0056-built-in-dashboard-editing-contract.md)を参照してください。

## Start Here

| 目的                           | 読むもの                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------ |
| アプリを使う                   | [ユーザーガイド](user-guide.md)                                                                  |
| 開発環境を作る                 | [開発ガイド](development.md)                                                                     |
| 現行アーキテクチャを把握する   | [システム概要](system-overview.md)                                                               |
| ファイル配置を判断する         | [プロジェクト構成](project-structure.md)                                                         |
| 設計判断の背景を見る           | [ADR](adr/README.md)                                                                             |
| ドキュメントを更新する         | [ドキュメント運用ガイド](documentation-guide.md)                                                 |
| 実装変更時の docs 更新先を見る | [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix)                                  |
| ADR の採番・命名を確認する     | [ADR Operations](documentation-guide.md#adr-operations)                                          |
| テスト/品質ゲートを確認する    | [Testing and Quality Gates](testing.md)                                                          |
| AI agent / Copilot で実装する  | [AGENTS.md](../AGENTS.md), [.github/copilot-instructions.md](../.github/copilot-instructions.md) |

## User Documentation

- [通常のCodingタイムラインでの同期](adr/0044-sync-in-coding-toolbar.md): 同期ボタンと設定済みホットキーの共用。
- [アングル同期](angle-synchronization.md): Sync Point、コマ送り、前後半、ウィンドウ比率、保存契約。

- [Windows版](windows.md): 導入、OS間の操作・文書互換、ランタイムと検証。

- [パッケージ互換・原本保護・Sportscode XML取り込み](package-compatibility.md): 対応形式、コピー移行、保存エラー復旧と検証限界。
- [起動画面とパッケージを開く操作](start-workspace.md): 履歴検索、ドロップ、読み込み状態と復旧。
- [Paint](tactics.md): 描画、追尾範囲、位置キー、ホットキー、芝色・平面・素材、保存と制約。

- [ユーザーガイド](user-guide.md): パッケージ作成、タグ付け、分析、プレイリスト、エクスポート。
- [Privacy and Data Handling](privacy-and-data-handling.md): ローカル保存、外部送信、AI 分析時のデータ境界。
- [Homebrew quickstart](homebrew-quickstart.md): Homebrew Cask での導入。
- [プレイリスト機能](playlist-features.md): プレイリスト画面と関連操作（関連 ADR: [0008](adr/0008-dedicated-sub-window-runtime-and-synchronization.md), [0010](adr/0010-ffmpeg-clip-export-execution-boundary.md), [0025](adr/0025-playlist-document-presentation-order.md)）。

## Product Research

- [市場価値を高める改善案（2026-09）](reports/2026-09-product-value.md): 現行競合との比較、改善の優先順位、検証指標。

- [AIモデルの公開範囲・配布台帳](model-distribution.md): モデルカード、学習・評価の公開記録、取得先と不足情報。

## Developer Documentation

- [第三者コンポーネントの配布](third-party-distribution.md): 告知inventory、FFmpeg対応ソースと既存Releaseの確認範囲。
- [公開履歴の限定点検](reports/2026-10-oss-audit.md): 対象範囲、修正と未確認事項。

- [ビルド用ダウンロードの依存境界](adr/0058-build-downloads-without-response-cache.md): HTTP response cacheを除去し、監査・checksum・ファイルキャッシュを維持する判断。
- [開発ガイド](development.md): セットアップ、品質ゲート、開発ワークフロー。
- [Testing and Quality Gates](testing.md): Vitest、品質ゲート、テスト追加判断。
- [システム概要](system-overview.md): Feature-First、Electron IPC、shared contracts の現行構造。
- [プロジェクト構成](project-structure.md): ディレクトリ構成と新規ファイルの配置判断。
- [デザインシステム](design-system.md): MUI theme と shared UI の運用。
- [Architecture exceptions](architecture-exceptions.md): `AGENTS.md` からの一時例外台帳。
- [ADR](adr/README.md): 長期的な設計判断。
- [起動時のパッケージ通知](adr/0045-buffer-startup-package-open.md): 画面の準備前に届いた通知の保持と一度だけの配送。
- [インスタンス単位の書き出し準備](adr/0050-instance-scoped-export-preparation.md): 不要区間と中間圧縮の削減、共通時計とコピー条件。
- [オーバーレイ付き書き出し性能](reports/2026-09-export-performance.md): Sportscode公式調査、再現可能な合成素材での比較と品質上の制約。
- [映像書き出しメニューの所有者と準備待ち](adr/0042-document-owned-export-menu.md): Package Sessionによる通知先とTimelineの購読準備。
- [Release artifactの不変性](adr/0032-immutable-release-artifacts.md): 公開済みタグとDMGを保持する配布契約。
- [Release手順](../.github/RELEASE.md): 作業ブランチからの候補準備、Windows/macOSの検証、タグによる公開と公開後の確認。
- [Docs Impact Matrix](documentation-guide.md#docs-impact-matrix): 実装変更時に同時更新する docs の対応表。
- [ADR Operations](documentation-guide.md#adr-operations): ADR の採番、命名、更新 lifecycle。

## Feature / Specification Notes

- [技術仕様書](requirement.md): 機能要件と仕様メモ。
- [AI Analysis and Local LLM Setup](ai-analysis.md): ローカル llama.cpp / GGUF model のセットアップと運用。
- [自動イベント検出](event-detection.md): 検証済みローカルモデル、品質ゲート、Timelineへの自動Coding、runner contract。
- [Analysis Report Export](analysis-report.md): 分析レポート PDF / PNG / summary export の境界。
- [音声同期オフセット仕様](audio-sync-offset-specification.md): 音声同期 offset の計算・適用とマルチアングル保存契約（関連 ADR: [0016](adr/0016-multi-angle-audio-sync-offset-persistence.md)）。
- [コードウィンドウ編集](code-window-settings.md): `.stcw` ドキュメントと独立編集ウィンドウ。
- [SCTimeline 実装](sctimeline-implementation.md): SCTimeline JSONと専用XML取り込みの区別（関連 ADR: [0009](adr/0009-timeline-import-export-interoperability.md)）。
- [タイムライン行モデル](adr/0017-row-owned-timeline-presentation.md): 行が名称・色・順序を所有する保存形式とSportscode準拠の編集操作。
- [カスタムファイルアイコン](custom-file-icons.md): 独自ファイル形式と icon / bundle 設定。
- [Homebrew distribution](homebrew-distribution.md): Homebrew Cask 配布手順。

LLM model artifact distribution is governed by ADR: [0012](adr/0012-llm-model-artifact-distribution-boundary.md).

## AI Contributor Map

AI agent は次の順で参照してください。

1. `AGENTS.md`: MUST / SHOULD / MAY の正本。
2. `.github/copilot-instructions.md`: AI / Copilot 向け入口と品質ゲート。
3. `.github/instructions/*.instructions.md`: 対象ファイル別の差分ルール。
4. [システム概要](system-overview.md): 現行実装のトレース。
5. [プロジェクト構成](project-structure.md): 新規ファイルの配置判断。
6. [ADR](adr/README.md): 変更してはいけない設計判断、変更する場合に更新すべき判断。
7. [ADR Operations](documentation-guide.md#adr-operations): ADR の採番、命名、更新 lifecycle。

設計・ユーザー影響・ドキュメント運用が変わる変更では、[Docs Impact Matrix](documentation-guide.md#docs-impact-matrix) に従って同期してください。

- [Playlist instance notes (ADR 0048)](adr/0048-playlist-instance-notes.md)
- [映像出力テキストの高さ・文字サイズ制限](adr/0049-bounded-export-text.md)
- [Playlist Studio annotation contract (ADR 0028)](adr/0028-playlist-studio-annotation-contract.md)

- [Paintの機能範囲と公式調査](tactics.md)
- [Tactics motion and plane contract (ADR 0029)](adr/0029-tactics-motion-and-plane-contract.md)

- [ADR 0034: 既存Codingとの比較用モデル](adr/0034-reference-coding-model-evaluation.md)

- [ADR 0035: 自動検出結果の再利用](adr/0035-event-detection-result-reuse.md)

- [ADR 0036: 持続するイベントの区間判定](adr/0036-event-episode-consolidation.md)
- [ADR 0037: 確認済み映像による補正モデル](adr/0037-reviewed-model-refinement.md)

- [ADR 0039: 端末内戦術盤とフレーム単位の較正](adr/0039-local-tactical-board.md) — 保存契約、モデル同梱、認識候補の確認。

- [複数クリップの共通時刻契約（ADR 0040）](adr/0040-shared-media-timeline-clock.md)

- [Portable playlist references (ADR 0051)](adr/0051-portable-playlist-references.md)
- [Playlist default angles (ADR 0052)](adr/0052-playlist-default-angles.md)

分析PNGのフレーム同期と画素境界の判断は[ADR 0057](adr/0057-verified-analysis-frame-capture.md)を参照してください。
