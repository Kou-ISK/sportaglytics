# 0072 Cancellable package history read

## Status

Accepted

## Date

2026-10-23

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0065](0065-unified-project-open.md), [0067](0067-in-place-package-updates.md)

## Context

隣接バックアップの列挙は既に非同期だが、OSのI/O待ちが長いと起動画面が待ち続ける。未完了の列挙を空履歴と扱うと、復元した原本に別コピーの更新を再採用する危険がある。

## Decision

名前だけを列挙し、無関係な兄弟項目のmetadata取得を要求しない。列挙待ちに専用progressと取消を設ける。取消は読み取り結果の採用を中止し、OS I/O自体の停止を約束しない。遅い結果/エラーは消費し、移行・bindへ継続しない。更新/復旧のcommitをUI取消で中断しない。

MainはWindowとrequestを照合し、reload/crash/closeで古い操作を失効させる。Rendererは選択/prepare/readの各完了時に要求の生存を確認する。Sessionのbindとreleaseに同じrequestを渡し、古い完了が後続の同名Sessionを解放できないようにする。取消送信失敗はbusy中にも表示する。

## Consequences

利用者は履歴確認待ちを取り消して再試行できる。OS側の列挙時間短縮や全工程の取消を保証しない。取消・旧世代・復元保護・同path再bindを回帰に含め、実際の遅い保存先での応答は別途確認する。
