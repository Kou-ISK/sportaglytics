# 0045 Buffer startup package open

## Status

Accepted

## Date

2026-09-21

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A

## Context

Mainはウィンドウの読み込み後にパッケージを開く通知を送る。一方、Reactが受信処理を登録する時点は `did-finish-load` と一致しない。購読の開始時にだけIPCリスナーを登録すると、起動直後の通知が失われてパッケージが表示されない。

## Decision

- 用途専用の `packageOpenBridge` をpreload初期化時に作り、通知を直ちに受信する。
- 購読者がいない間はウィンドウ内で最新1件のみ保持する。Mainのパッケージ別ウィンドウ振り分けは維持する。
- 購読後のmicrotaskで現在の購読者へ配送する。消費時に保留を消し、StrictModeの再購読で二重処理しない。
- 解除関数はその購読だけを解除する。古い解除関数は新しい購読者を無効化しない。
- 既存の `onPackageDirectoryOpen` を維持し、汎用イベントAPIや永続キューは追加しない。不正なパスの通知は保持しない。

## Consequences

画面の起動速度に依存せず通知が届き、画面間の購読交代中も保留できる。Native IPCリスナーはReactではなくpreload contextの生存期間に従う。1ウィンドウで未消費の複数操作を順に開くキューにはしない。将来その操作を導入する場合はMainのセッション契約と合わせて再検討する。

単体テストに加え、本物のsandbox preloadへ購読前に通知するElectron E2Eで配送境界を検証する。
