# Architecture Exceptions

このドキュメントは、AGENTS 規約からの一時的な例外を記録する台帳です。

## 記録ルール

1. 例外は必ず issue / ticket に紐づける。
2. `理由 / 影響範囲 / 解消期限 / 担当` を必須記載する。
3. 解消済みになったら `状態` を `Closed` に更新する。
4. 同一例外を恒久化しない。期限延長時は理由を追記する。

## 例外一覧

| ID               | 作成日     | 規約               | 例外内容                                              | 理由                             | 影響範囲               | 解消期限   | 担当   | チケット | 状態 |
| ---------------- | ---------- | ------------------ | ----------------------------------------------------- | -------------------------------- | ---------------------- | ---------- | ------ | -------- | ---- |
| (例) ARCH-EX-001 | 2026-03-01 | Feature Public API | `src/pages/X.tsx` から feature deep import を一時許容 | 緊急障害対応で公開面準備が未完了 | `src/pages/X.tsx` のみ | 2026-03-15 | @owner | #1234    | Open |

| ARCH-EX-002 | 2026-10-18 | Feature Public API | `scripts/benchmark-synthetic-timeline.mjs`の専用loaderから純粋関数`timelineReviewSearch.ts`を推移的compileして読込 | 実際の検索処理を計測し、計測専用の本番公開APIや検索実装の複製を増やさないため | Node計測ツール1本のみ。アプリの実行時import・UI・保存形式は変更しない | 2026-11-18までにfeature内benchへの移動または限定した正式な計測入口を判断 | maintainers | [PR #237](https://github.com/Kou-ISK/sportaglytics/pull/237) / [F10受入](synthetic-workloads.md#次の受入条件) | Open |

| ARCH-EX-003 | 2026-10-20 | Release branch routing | v0.17.13準備以降の限定再生修正版について、mainを基点とするrelease branchからmainへPRを作る | developで進行中の未公開モデル配布方針を、今回の再生修正へ混在させないため | v0.17.19は逆方向キー解放時の要求消失の退行修正・回帰・告知だけを選ぶ。修正とrelease準備は先にdevelopへ統合し、CI・レビュー・署名・公証・公開検証を保持する | v0.17.19公開後の記録同期でClose。期限2026-11-03 | maintainers | [PR #260](https://github.com/Kou-ISK/sportaglytics/pull/260) | Open |

## 月次レビュー

- 毎月 1 回、Open の例外を見直して優先順位を更新する。
- 期限超過の例外は次スプリントで必ず解消計画を確定する。

| ARCH-EX-004 | 2026-10-23 | 未使用経路の削除 | 再生用コピーを短尺qualificationの段階接続として置く | 長尺採用前に原本・全時刻・取消・実機効果を検証するため | `electron/src/playbackCache`の検証基盤。v0.17.15でコピー操作のView/Controller/Storyは撤去。原本の識別・復帰に使う共通関数は保持 | 2026-10-30、merge/release前にqualification結果と長尺対応・撤去を判断 | maintainers | [CACHE-1](playback-cache.md#cache-1-activation-gate) | Open |
