# 0076 Operation-owned cache identity handoff

## Status

Proposed

## Date

2026-10-24

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0075](0075-persistent-complete-content-proofs.md), [0074](0074-bounded-cache-hardware-compatibility.md)

## Context

保存済み候補の探索と、その直後の全内容proof読出しがそれぞれ同じ媒体を全hashしていた。大きい動画では不要なI/Oになる。属性だけで過去のhashを推測したり、別要求のhashを永続的に信頼したりする方法は、変更検知の保証を保てない。

## Decision

Mainの同一reuse Jobに限り、候補探索で新しく求めた全SHA-256を、開いたFileHandleと一緒に一度だけ内容検証へ引き渡す。消費時に同じhandleとpathのdev/ino/size/mtimeNs/ctimeNs/nlinkを再照合する。非通常ファイル・leaf symlink・hardlink・途中交換・取消・二重消費を拒否する。handleを持つこと自体は不変性を保証しない。消費後はclose完了を待ち、失敗ならproofを返さない。

捕捉前にJobへcleanup所有権を登録する。close失敗はラッチして通常のfinallyやdiscardでは再発行せず、明示retryCleanupだけが同じFileHandleで再確認する。未確認cleanupは採用・終了を妨げる既存状態に残す。numeric fdを使った再closeはしない。引渡し能力はMain内部の要求だけに閉じ、IPC・package・永続ledger・MainのLRUには保存しない。

原本の検証前後、候補の全内容解析後・HW後・最終探索の全hashは維持する。現在のHW適合検査と、変更したビルド・環境・bytes・破損ledgerの無効化も変更しない。全内容proofが存在する成功要求では原本2回/候補3回、初回解析では原本3回/候補4回の全digest読みになる（変更前はそれぞれ候補が1回多い）。採用時の追加検査は別工程として残る。

Main成功artifactに最大32件のdigest読込回数・bytes・時間を残す。これはprobe、ヘッダ、tool、OSキャッシュや物理ディスク転送量を含まない。観測callbackはhashやcleanupの成否を変えない。

## Consequences

毎回新しく確かめるbytesに基づく証明を維持しながら、隣接する候補の全読み1回を除ける。ただし再利用でも大きい媒体への複数走査は残り、長尺の待ち時間問題全体の解決ではない。短尺の固定上限IPC計測を初回/同一起動/再起動に分け、共有負荷と論理bytesを報告する。削減したbytesから壁時計の同率改善を主張しない。

原本・保存形式・タグ・音声・fps・再生選択・exportは変更しない。新たな依存/権限/資産はない。長尺上限の変更、全長変換、directory I/O、実音声同期、物理scrub、再生品質とreleaseは別途検証する。
