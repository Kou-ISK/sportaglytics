# 0073 Verified playback cache foundation

## Status

Proposed

## Date

2026-10-23

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0020](0020-verified-media-toolchain-and-process-containment.md), [0046](0046-coalesced-playback-corrections.md)

## Context

デコーダーがハードウェア経路を継続できない素材では、UIのseek制御だけで再生待ちを解消できない。派生動画は有望だが、変換負荷・追加容量が大きく、時刻や音声対応を変えると既存タグと分析を壊す。

## Decision

まず本番へ未接続のjob/policy/View基盤で、原本選択を既定とする状態遷移、全時刻/音声の検証契約、容量上限、取消と片付けの直列化を実装する。次の段階としてMain用の全体hash/保存adapterを追加し、出力proofを全体SHA-256へ結合してからjob固有directoryをatomicに公開する。大きなhashは取消可能な検証段階で行い、公開中の取消不能区間を長くしない。既存cacheと中断jobの容量を含め、別jobの自動削除やmanifest成功値だけによる再利用は行わない。

所有processは停止要求とclose確認を分け、closeまでstaging所有を維持する。停止未確認を通常失敗として片付けず、busyと終了待ちを表示する。これは終了後だけ検証・公開へ進む契約を守るためであり、強制終了や未検証の再試行へ自動昇格しない。

本番採用は[再生用コピー設計のactivation gate](../playback-cache.md#cache-1-activation-gate)の後に判断する。

派生物をpackage保存形式へ混ぜず端末cacheへ隔離し、原本hash・recipe・runtimeと全列検証に合格した完成品だけを選ぶ。コピー完成で自動切替せず、停止中に明示選択し、原本へ戻れるようにする。タグ時計・同期補正・書き出し元は原本のまま維持する。

## Consequences

通常再生への安全な接続には信頼できるvalidator、所有process/容量監視、atomic公開、起動時照合、実再生と実音声の検証が必要である。基盤の合成テストをHW効果の証拠とは扱わず、全長変換や自動有効化をこの段階で開始しない。
