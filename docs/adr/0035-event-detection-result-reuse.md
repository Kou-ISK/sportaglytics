# 0035 Event Detection Result Reuse

## Status

Accepted

## Date

2026-09-16

## Context

自動検出のしきい値・前後秒数・追加先の調整はRendererで行うため、同じ映像を同じモデルで再解析する必要はありません。一方、映像の差し替えやmodel pack更新後に古い候補を再利用すると誤った結果になります。

## Decision

Main processに有効期限30分、最大4件・合計20 MiBのメモリ内LRU cacheを置きます。正常終了して検証済みの候補だけを保存し、映像や候補を追加でディスクへ永続化しません。

入力clipの順序・識別子・配置時刻・長さ、対象イベント、モデル情報・runner hash、および映像とmodel directory配下の全ファイルのidentity・size・mtime・ctimeをキーに含めます。処理前後のキーが異なる結果は保存しません。symlinkや大きすぎるmodel treeは再利用対象外とします。

再利用時もsender、payload、モデルのハッシュ、映像の存在・読取権限を検証します。新しいrequest IDで候補のコピーを返し、再推論しないためdurationMsは0とします。失敗・キャンセルした処理は保存せず、同時実行の共有も行いません。

## Consequences

同じ入力のしきい値調整では映像の再解析を省けます。アプリ終了・期限切れ・入力変更時には再解析します。初回の解析時間短縮はmodel runner側の責務です。ファイル内容の全量hashを毎回計算する方式は採らず、ローカル編集に伴うファイルmetadataの変化で無効化します。
