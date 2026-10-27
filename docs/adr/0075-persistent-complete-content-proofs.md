# 0075 Persistent complete content proofs

## Status

Proposed

## Date

2026-10-24

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0074](0074-bounded-cache-hardware-compatibility.md), [0073](0073-verified-playback-cache-foundation.md)

## Context

全内容のfield・音声packet・時刻照合は決定的な内容検査であり、再起動のたびに同じbytesを全復号すると再利用待ちが増える。一方、書換え可能なpackage manifestやファイル属性だけを証明として扱うと、変更・破損を見逃す。現在のHW適合性は過去の内容証明から推論できない。

## Decision

Mainの全内容proofに限り、同じprivate userData内で再起動を跨いで保持する。各要求で実媒体の全SHA-256とbyte数を取り直し、recipe・verifier版・runtime/tool hashを結合する。加えて物理app.asarの全hashを起動ごとに求め、ビルド変更は無効化する。ElectronのASAR仮想FSを変更せずoriginal-fs adapterを使い、非ASAR実行は永続化しない。初回全解析の前後照合と、HW後/公開/採用前の改変検知を維持する。

記録はprivate領域の32byte鍵による認証付きledgerとし、最大8件・256KiBに制限する。認証後も型・関係・上限を検査する。欠落・破損・不完全・鍵/版/環境/ビルド不一致では全解析を行う。symlink/hardlink・owner/mode不正・未知ファイル・容量超過では永続化を無効にし、外部データを削除しない。鍵と記録はpackageへ保存・配布・外部送信しない。OS keychainや新しい権限は利用しない。

書込みをSession内で所有して完了を待ち、非同期完了後に原本/owner/取消を再確認する。rename前の取消は登録を防ぐ。発行済みrenameは完了を待ってstored/uncertainを記録し、取消を再送出する。不確かな書込みを再試行せず、次回に認証をやり直す。一時ファイルは成功記録として読まず、残存分を容量に数える。保存不能でも媒体検証を成功と偽らず、内容解析またはMainメモへ戻る。

内容proofは元媒体の表示列と全音声の対応を再利用するためだけに使う。新しいHW適合性・再生選択・readiness・音声設定・UI品質の証明を保存しない。生成時の全尺HW、再利用ごとの新しい区間HW、停止中の採用と原本復帰は既存の契約を維持する。

## Consequences

再起動後の同一bytes・同一環境・同一ビルドで全復号とそれを囲む二度目のhashが不要になる。毎回の全媒体hash、起動ごとのapp hash、現在のHW検査は残る。共有負荷やI/Oに依存するため、短尺実測を一定速度や長尺完了の保証にはしない。

ローカル鍵による認証は偶発破損や外部のmanifest注入を防ぐ境界であり、同じOSユーザーのprivate鍵を読める敵対者や侵害されたMainに対する耐性を主張しない。権限検査を満たせない環境は安全に全解析へ戻る。新依存・資産・保存形式・自動採用を導入せず、120秒の対応上限は変更しない。

初回生成の長い処理時間・全尺HW・容量・復旧、directory読込遅延、実音声同期・物理scrub・連続再生品質は別の残件である。通常起動と再起動の製品IPC計測を分け、記録の由来と無効化の負例を検証する。
