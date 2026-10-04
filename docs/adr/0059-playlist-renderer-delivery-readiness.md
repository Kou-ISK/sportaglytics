# 0059 Playlist renderer delivery readiness

## Status

Accepted

## Date

2026-10-04

## Context

新規Playlistを開く送信側は固定500ms待ってからclipを追加していた。Mainはその時点でIPCを直接送信するため、遅い初回描画でitem listenerが未登録だとclipが失われる。URLのロードや外部文書の購読完了も、Reactのitem/sync listenerの準備を保証しない。

## Decision

- MainはWindowごとにitem追加と同期を送信順に保持する。Rendererが既存のitem/sync listenerを全て登録してから送る`request-sync`を受信準備の合図として使い、検証済みPlaylist senderに対応するWindowの通知だけを一度配送する。
- 準備完了後の通知は直接配送し、reload開始時は再び保留する。Window破棄とともにその保留状態も破棄する。送信元のPackage Sessionによる宛先制限を維持する。
- 外部文書購読の`playlist:ready`とは責務を分け、新しい汎用IPCやpreload APIを追加しない。送信側の固定500ms待機は除去する。

## Consequences

最初のclip追加はRendererの起動速度に依存しなくなる。保留通知はWindowの生存期間だけMainのメモリに存在し、アプリ終了後まで保存するキューではない。文書形式、保存先、sandbox設定と既存のpayload/sender検証は変えない。

遅い初回ロードを実E2Eで制御し、単体テストで配送順序、重複ready、reloadとSessionの分離を確認する。受信準備の合図を送る位置は全item/sync listener登録後に保つ必要がある。
