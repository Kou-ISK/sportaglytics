# 0068 Timeline close save handshake

## Status

Accepted

## Date

2026-10-18

## Context

Timelineは300ms debounceで保存する。原子的な置換はMainへ届いたwriteの完全性を保つが、Rendererに残った変更を終了前に送る保証にはならない。hookのunmount時に保留timerを消すだけでは、最後の編集がIPCへ届かない。Playlistの未保存確認やライブ録画の停止待ちは別の文書・処理に対する保護である。

## Decision

- Timelineを所有する主画面に用途限定のclose handshakeを置く。preloadは登録ID、Mainは要求IDを発行し、Mainは対象Window・正規app文書・mainFrame・両IDを照合する。汎用send/on APIは増やさない。
- Rendererは要求を受けると同期的に編集を止め、debounceを解除し、最新snapshotを既存の直列保存queueへ入れる。先行writeと最新snapshotの実保存完了後にだけ成功を応答する。React commit前の変更と、まだeffectが導出していない行の色・名前も捕捉する。
- Mainは成功応答後にatomic writerへ既に入ったwrite群をdrainし、それからcloseを再試行する。quitでは全てのTimeline所有Windowを準備してから窓を閉じる。
- 保存失敗・応答不正・15秒の応答/書込待ちtimeout・文書reloadでは終了を取り消す。Rendererへ再開を通知し、変更と再試行手段を残す。応答がない画面を自動的に破棄しない。
- close許可は一度の同期的な再試行に限る。別のWindowが終了を止めた場合、残った主画面は再び編集でき、次の終了には新しい応答が必要。Playlist確認とlive captureの既存停止待ちは維持する。
- ライブ録画停止の終了ガードは試行ごとに状態を戻す。TimelineやPlaylistが終了を取り消した後に再録画した場合も、次のquitで新たに停止を待つ。許可したnative closeの完了までは編集を凍結し、単にclose呼出しが戻っただけで再開しない。
- atomic writerはファイル単位の順序保証と、一時ファイルwrite/sync/close→renameを維持する。終了待ちは各writeの成功・失敗も追い、後続成功だけで先行の失敗を隠さない。

## Consequences

- 正常保存では追加の確認ダイアログなしに終了できる。保存できない場合は終了を取り消した説明を表示し、接続・容量・権限の復旧後に再試行できる。
- quit/closeを実Electronで検証する。hookのmock試験だけでOS終了時のdata loss防止を証明したとはしない。複数窓、短いdebounce、書込中のUndo、失敗後の再編集も対象にする。
- OS強制終了、停電、filesystemの耐久性、任意の外部同時変更は保証しない。別文書への切替や任意のrenderer強制reloadの保存保証を、このclose契約から推定しない。
- cloud Linuxでの実Electron検査はMac/Windows配布実機の合格を代替しない。旧版の署名・公証も変更後候補へ流用しない。
