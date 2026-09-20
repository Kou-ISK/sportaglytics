# 0042 Document-Owned Export Menu

## Status

Accepted

## Date

2026-09-21

## Related ADRs

- Extends: [0008 Dedicated Sub-Window Runtime and Synchronization](0008-dedicated-sub-window-runtime-and-synchronization.md), [0021 Detached Timeline and Playback Authority](0021-detached-timeline-playback-authority.md)

## Context

映像書き出しの設定はTimelineまたはPlaylistに所属する。フォーカス中のWindowへ直接通知すると、映像Windowなど購読を持たないrendererでは操作が失われる。Timelineを開いて直後に送信しても、HTMLのロード完了とReactのデータ・購読準備は一致しない。

## Decision

- Mainのメニューactionはフォーカス中のWindowを起点にPackage Sessionを解決し、そのTimelineを開く。Playlistは自身の設定へ通知する。無関係なWindowへのbroadcastや先頭Windowへのfallbackは行わない。
- Timelineでは書き出し要求をセッションごとの一時状態に保持する。書き出しHookは購読後に型付き`clip-export-ready`を送り、Mainが該当Timelineのsenderを検証して要求を一度だけ配信する。
- 購読解除・ロード開始で準備状態を解除し、Window終了で未処理要求も破棄する。通常の再表示で消費済み要求を再実行しない。
- ファイル出力の条件・Paint・FFmpeg処理は既存の共通export経路を使う。保存形式や映像の時計は変更しない。

## Consequences

- 閉じたTimelineもメニューから書き出せる。固定時間の待機に依存せず、別パッケージのデータを誤って出力しない。
- UIの準備通知はWindow runtimeで消費するため、映像側Controllerの編集commandには転送しない。
- メニューcallbackから設定画面と実ファイル出力までのE2Eを維持する。export API単独の試験と、複数Session・遅延senderの単体試験を併用する。
