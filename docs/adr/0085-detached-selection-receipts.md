# 0085 Detached Selection Receipts

## Status

Accepted

## Date

2026-11-15

## Related ADRs

- Extends: [0021 Detached Timeline and Playback Authority](0021-detached-timeline-playback-authority.md)
- Superseded by: N/A

## Context

独立タイムラインで複数項目を選択した直後、既に配送待ちだった所有映像ウィンドウの同期が到着すると、楽観的な選択が古い選択へ戻り、右クリックが単項目選択に変わる。時刻比較や選択IDの一致だけでは、配送順の逆転や同じ選択への再操作を識別できない。

## Decision

所有者は論理document ID（hook instance UUIDと読み込み世代）、source発行連番、選択要求UUIDを同期する。選択IDと受領した要求UUIDは同じReact stateとしてcommitする。別パスの設定と明示的な読み込み再試行は、Reactのeffectより前にdocument世代を更新し、読み込み中の編集を拒否する。同じパスの単なる再設定は再読み込みではなく、外部ファイルの任意変更を自動検出する契約は追加しない。

独立ウィンドウは最新の未確認選択だけを保持し、一致する要求UUIDのcommitで確定する。5秒以内に確認できなければ既知の所有者状態に戻して再同期を要求し、選択や削除を再送しない。document切替・unmountで待機を破棄する。Mainと独立ウィンドウは旧連番・旧document世代・退役済みownerを拒否する。退役owner履歴はpackage sessionごとに最大1024件とし、超過時は未知ownerを受け入れず、packageの再オープンで新しいsessionを使用する。

Mainの既存のpackage session、現行main frame、送信元URLと型検証を維持する。選択・コンテキスト削除にはdocument IDを付け、Mainと所有者の両方で一致を確認する。所有者はcommit済みの最新payloadだけを送信し、unmount後の非同期open完了は送信しない。UUIDはファイル所有権や認証情報ではなく、信頼された現行renderer内の操作世代である。

## Consequences

古い配送が新しい選択を取り消す競合と、旧documentの選択・コンテキスト削除の混入を回帰化できる。時計同期・通常のシーク・保存形式は変更しない。全編集commandの世代保護、侵害済みrenderer、外部での同一パス内容変更の自動検出までは保証しない。合成hook/IPC回帰と実Electronの選択・削除・Undo検証は別の証拠として記録する。
