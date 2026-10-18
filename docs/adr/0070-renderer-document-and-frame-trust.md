# 0070 Renderer document and frame trust

## Status

Accepted

## Date

2026-10-18

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- [0002 Typed Electron IPC and renderer gateways](0002-typed-electron-ipc-and-renderer-gateways.md)
- [0014 YouTube embed client identity](0014-youtube-embed-client-identity.md)
- [0026 Package session window ownership](0026-package-session-window-ownership.md)

## Context

共通IPC guardは生存するBrowserWindowだけを確認していた。BrowserWindowに属することは、呼び出したframeやその文書がアプリのものだという根拠にはならない。従来のnavigation guardも任意の`file://`・`data:text/html`を許可していた。監査で実際の攻撃や任意コード実行を再現したわけではなく、追加の防御を設ける判断である。

守る対象はMainが扱うユーザー文書・設定とPackage Sessionの操作権限。信用するものはインストールされたアプリのentry document、Mainが生成したwindowと既存のsession ownershipである。外部ページ、開こうとする任意のローカルHTML、iframe、そのframeからのIPCはアプリ文書として信用しない。正規アプリ文書内でのスクリプト注入、改変済み配布物、OSアカウントへの侵入は、このguardだけでは封じ込められない。

## Decision

`getRendererUrl()`が返す一つのentry documentだけを共通IPCの文書として許可する。hash routeは除外して同一性を比較し、queryを含む別URL、近似path、任意のfile/data/http URLは許可しない。Electronの現行開発起動もbuildしたentry documentを使う。Vite単独のブラウザー開発にElectron権限を追加しない。

共通のevent guardは`event.senderFrame === event.sender.mainFrame`とframe URL、生存するWebContentsを確認する。window宛ての個別操作は、これに既存の期待window/session比較を重ねる。消えたframeは拒否する。設定IPCも独自の緩いguardを使わず共通実装へ統一する。公開preload APIや保存形式は増やさない。

rendererによるtop-level navigationとmain-frame redirectはアプリ文書だけに限定し、`window.open`は引き続き拒否する。YouTube iframeの移動・redirect、映像・画像・MediaPipeのBlob/WASM resourceはこの制限の対象にしない。live captureの専用partitionとpermission/main-frame制限も維持する。Mainの明示的な`loadURL`はnavigation eventで止められないため、IPC側の検査を別に行う。Mainが生成するHelpはpreloadのないdata文書として表示し、アプリIPCの許可対象にはしない。

詳細なイベント範囲は[Electron webContents navigation](https://www.electronjs.org/docs/latest/api/web-contents#event-will-navigate)、frame契約は[Electron IPC sender validation](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages)を参照する。file URLには一般的なWeb origin比較を流用せず、アプリが生成した完全なdocument URLを比較する。

## Consequences

外部文書・子frameが生存BrowserWindowを共有しても、共通guardを通るfile/settings/主要feature IPCの権限を得ない。既存のpayload検証・session所有権は引き続き必要であり、この変更で全IPCを自動的に包んだわけではない。個別実装のhandlerを変更するときも同じ文書/frame契約を確認する。

一般file IPCは正規rendererの要求pathを扱うため、正規文書内のスクリプト注入が成立した場合の任意path操作は残る。将来のpath capability化は、OS picker・別保存・外部映像・複数sessionの既存契約を列挙してから別判断にする。汎用CSPはYouTube/MediaPipe/live captureへの影響を確認せず追加しない。今回を確定脆弱性の修復や全境界の完全な隔離とは表現しない。

`windowSecurity.test.ts`と`windowSenderGuards.test.ts`は誤URL・子frame・破棄済みframe・別owner・iframe redirectを検査する。`scripts/e2e-window-security.mjs`は合成文書だけを使い、実preload/Mainの許可と拒否、生成Help、Settingsを検証する。その他のsubwindow・YouTube・Paint・録画は既存の対応E2Eを併用する。Linuxクラウドの検証はMac/Windowsの配布・支援技術検証を代替しない。
