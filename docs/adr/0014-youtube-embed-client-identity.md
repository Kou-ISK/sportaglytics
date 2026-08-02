# 0014 YouTube embed client identity

## Status

Accepted

## Date

2026-07-20

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A

## Context

Electron の本番 Renderer は `file://` から起動するため、YouTube の埋め込みプレイヤーへ通常の HTTP Referer が送信されない。YouTube IFrame Player は Referer または同等の API Client 識別情報がないリクエストを Error 153 として拒否する。証明書検証や `webSecurity` を無効化してもこの識別要件は解消せず、アプリ全体の安全性を損なう。

## Decision

- アプリ識別子 `com.kouisk.sportaglytics` を HTTPS origin として表した `https://com.kouisk.sportaglytics` を YouTube 埋め込みの正規クライアント origin とする。
- Renderer は Video.js YouTube tech の `widget_referrer` に同じ識別子を渡す。親画面が `file://` のため、IFrame API の通信元と一致しない HTTPS `origin` parameter は指定しない。
- main process は対象 Session の `webRequest.onBeforeSendHeaders` を使い、YouTube と YouTube Privacy-Enhanced Mode の `/embed/` リクエストに限って同じ識別子を `Referer` として付与する。
- TLS 証明書検証、`webSecurity`、ナビゲーション制限は維持する。YouTube 以外の通信や YouTube の一般 API リクエストへヘッダーを追加しない。

## Consequences

- `file://` で配布されるデスクトップアプリでも、YouTube に必要な埋め込みクライアント識別情報を一貫して送信できる。
- Renderer の `widget_referrer` と main process の request header は共有定数を正本として同期する必要がある。
- 動画所有者が埋め込みを禁止している場合や、ネットワーク上で YouTube が遮断されている場合の再生失敗は引き続き発生し得る。
