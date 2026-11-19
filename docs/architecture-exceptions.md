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

| ARCH-EX-003 | 2026-10-20 | Release branch routing | v0.17.13準備以降の限定再生修正版について、mainを基点とするrelease branchからmainへPRを作る | developで進行中の未公開モデル配布方針を、今回の再生修正へ混在させないため | v0.17.19は逆方向キー解放時の要求消失の退行修正・回帰・告知だけを選ぶ。修正とrelease準備は先にdevelopへ統合し、CI・レビュー・署名・公証・公開検証を保持する | v0.17.19公開後の記録同期でClose。期限2026-11-03 | maintainers | [PR #258](https://github.com/Kou-ISK/sportaglytics/pull/258) | Open |

| ARCH-EX-005 | 2026-11-05 | Release branch routing | v0.17.20の限定修正と、その監査停止を解消するv0.17.21の限定修正をmain基点のrelease branchからmainへPRで取り込む | developの未公開モデル配布方針を公開済み版に混ぜず、既存v0.17.20 tagを変更しないため | [PR #262](https://github.com/Kou-ISK/sportaglytics/pull/262)の再生・保存修正、[PR #264](https://github.com/Kou-ISK/sportaglytics/pull/264)の依存監査修正と必要なrelease準備のみ。develop先行統合、両PRのCI・レビュー、署名・公証と実機受入を維持する | v0.17.21公開後の記録同期でClose。期限2026-11-19 | maintainers | [PR #262](https://github.com/Kou-ISK/sportaglytics/pull/262), [PR #264](https://github.com/Kou-ISK/sportaglytics/pull/264) | Open |

| ARCH-EX-006 | 2026-11-06 | Release branch routing | v0.17.22の検証改善とrelease準備のみをmain基点のrelease branchからmainへPRで取り込む | 未公開モデル配布方針を混ぜず、既存v0.17.21 tagを変更しないため | [PR #267](https://github.com/Kou-ISK/sportaglytics/pull/267)と必要なrelease準備のみ。develop先行統合、CI・レビュー・署名・公証と実機受入を維持する | v0.17.22公開後の記録同期でClose。期限2026-11-20 | maintainers | [PR #267](https://github.com/Kou-ISK/sportaglytics/pull/267) | Open |

| ARCH-EX-007 | 2026-11-06 | Release branch routing | v0.17.23のmacOS書き出し修正とrelease準備のみをmain基点のrelease branchからmainへPRで取り込む | 未公開モデル配布方針を混ぜず、既存v0.17.22 tagを変更しないため | [PR #270](https://github.com/Kou-ISK/sportaglytics/pull/270)と必要なrelease準備のみ。develop先行統合、CI・レビュー、署名・公証および配布版検証を維持する | v0.17.23公開後の記録同期でClose。期限2026-11-20 | maintainers | [PR #270](https://github.com/Kou-ISK/sportaglytics/pull/270) | Open |

| ARCH-EX-008 | 2026-11-14 | Release branch routing | v0.17.24 / PR #273 の最終レビュー済みcommitの書き出し・取消・逆再生修正と必要な版準備のみをmain基点のrelease branchからmainへPRで取り込む | developで進行中の未公開モデル選定方針を今回の修正に混在させないため | [PR #273](https://github.com/Kou-ISK/sportaglytics/pull/273)と必要なrelease準備のみ。モデル選定方針・catalog・lockの差分は除外し、develop先行統合、双方のPRのレビュー・CI、署名・公証・実機および配布物検証を維持する | 公開・配布照合後の記録同期でClose。期限2026-11-28、超過時は解消計画を確定 | maintainers | [PR #273](https://github.com/Kou-ISK/sportaglytics/pull/273) | Open |

| ARCH-EX-009 | 2026-11-15 | Release branch routing | v0.17.25のnative v2時間丸め修正と必要な版準備のみをmain基点release PRで取り込む | developの未公開モデル選定方針を既存配布へ混在させないため | [PR #277](https://github.com/Kou-ISK/sportaglytics/pull/277)と版準備のみ。develop先行統合、両PRのレビュー/CI、署名・公証・配布物検査を維持し、モデル方針/catalog/lockを除外する | 公開・配布確認後Close。期限2026-11-29 | maintainers | [PR #277](https://github.com/Kou-ISK/sportaglytics/pull/277) | Open |

| ARCH-EX-010 | 2026-11-15 | Release branch routing | v0.17.26の配布E2E計測修正と必要な版準備のみをmain基点release PRで取り込む | developの未公開モデル選定方針を今回の配布に混在させないため | [PR #280](https://github.com/Kou-ISK/sportaglytics/pull/280)と必要な版準備のみ。develop先行統合、両PRレビュー/CI、署名・公証と同一配布物検査・修正された丸め区間の受入を保持。モデル方針/catalog/lockをmainから除外する | 公開・配布確認後Close。期限2026-11-29 | maintainers | [PR #280](https://github.com/Kou-ISK/sportaglytics/pull/280) | Open |

| ARCH-EX-011 | 2026-11-15 | Release branch routing | v0.17.27の独立タイムライン選択同期修正と必要な版準備だけをmain基点のrelease PRで取り込む | developの未公開モデル選定方針を既存配布に混在させず、未公開v0.17.26 tagを保持するため | [PR #282](https://github.com/Kou-ISK/sportaglytics/pull/282)と必要な版準備のみ。develop先行統合、両PRのレビュー/CI、署名・公証・同一配布物E2E/丸め区間検査を維持し、モデル方針/catalog/lockを除外する | 公開・配布確認後Close。期限2026-11-29 | maintainers | [PR #282](https://github.com/Kou-ISK/sportaglytics/pull/282) | Open |

| ARCH-EX-012 | 2026-11-15 | Release branch routing | v0.17.28の行メニューfocus修正と必要な版準備のみをmain基点release PRで取り込む | developの未公開モデル選定方針を混在させず、未公開v0.17.27 tagを保持するため | [PR #284](https://github.com/Kou-ISK/sportaglytics/pull/284)と必要な版準備のみ。develop先行統合、両PRレビュー/CI、署名・公証・同一配布物E2E/丸め区間検査を維持。モデル方針/catalog/lockをmainから除外する | 公開・配布確認後Close。期限2026-11-29 | maintainers | [PR #284](https://github.com/Kou-ISK/sportaglytics/pull/284) | Open |

| ARCH-EX-013 | 2026-11-15 | Release branch routing | v0.17.29のpublicationテスト準備修正と必要な版準備のみをmain基点release PRで取り込む | developの未公開モデル選定方針を混在させず、未公開v0.17.28 tagを保持するため | [PR #286](https://github.com/Kou-ISK/sportaglytics/pull/286)と必要な版準備のみ。develop先行統合、両PRレビュー/CI、署名・公証・同一配布物E2E/丸め区間検査を維持。モデル方針/catalog/lockをmainから除外する | 公開・配布確認後Close。期限2026-11-29 | maintainers | [PR #286](https://github.com/Kou-ISK/sportaglytics/pull/286) | Open |

| ARCH-EX-014 | 2026-11-16 | Release branch routing | v0.17.30のオーバーレイ折り返し修正と必要な版準備のみをmain基点release PRで取り込む | developの未公開モデル方針とPR #288の未完成な再生を混在させず公開済み0.17.29を保持するため | [PR #289](https://github.com/Kou-ISK/sportaglytics/pull/289)と版準備・同一配布物の出力比較E2Eのみ。develop先行統合、両PRのレビュー/全CI、署名・公証・同一配布物E2E/hashを維持し、モデル方針/catalog/lockを除外する | 公開・配布確認後Close。期限2026-11-30 | maintainers | [PR #289](https://github.com/Kou-ISK/sportaglytics/pull/289) | Open |

| ARCH-EX-015 | 2026-11-16 | Release branch routing | v0.17.31の保存後終了E2E同期と必要な版準備のみをmain基点release PRで取り込む | 未公開v0.17.30 tagを保持し、developの未公開モデル方針とPR #288を混在させないため | 実Mainの保存完了を待つE2E修正と版準備のみ。develop先行統合、両PRの全CI、製品の保存/終了ガード、署名・公証・同一DMG E2E/hashを維持し、モデル方針/catalog/lockを除外する | 公開・配布確認後Close。期限2026-11-30 | maintainers | [PR #291](https://github.com/Kou-ISK/sportaglytics/pull/291)の未公開候補を継承 | Open |
| ARCH-EX-016 | 2026-11-19 | Git / release | 0.17.32 に限り develop 先行統合後、main 基点の限定 release PR を使用する提案 | 未公開モデル方針・catalog・lock の混入を防ぐ | PR #294 と必要な版・配布文書だけ。PR #288 を除外し両PRの品質ゲート、署名・公証・実機受入を維持 | 0.17.32 の配布確認または 2026-12-03 の早い方 | maintainers | [#294](https://github.com/Kou-ISK/sportaglytics/pull/294) | Proposed |

| ARCH-EX-017 | 2026-11-19 | Git / release | 0.17.33のみdevelop先行統合後にmain基点の限定release PRを使用 | 未公開0.17.32タグを保持し、モデル配布方針の混入を防ぐ | PR #298の修正・検査と必要な版準備のみ。両PRのレビューとCI、署名・公証・同一DMGの実機受入を維持 | 0.17.33の配布確認または2026-12-03の早い方 | maintainers | [#298](https://github.com/Kou-ISK/sportaglytics/pull/298) | Open |

## 月次レビュー

- 毎月 1 回、Open の例外を見直して優先順位を更新する。
- 期限超過の例外は次スプリントで必ず解消計画を確定する。

| ARCH-EX-004 | 2026-10-23 | 未使用経路の削除 | 再生用コピーを短尺qualificationの段階接続として置く | 長尺採用前に原本・全時刻・取消・実機効果を検証するため | `electron/src/playbackCache`の検証基盤。v0.17.15でコピー操作のView/Controller/Storyは撤去。原本の識別・復帰に使う共通関数は保持 | 2026-10-30、merge/release前にqualification結果と長尺対応・撤去を判断 | maintainers | [CACHE-1](playback-cache.md#cache-1-activation-gate) | Open |
