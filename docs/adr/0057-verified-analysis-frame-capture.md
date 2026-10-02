# 0057 Verified Analysis Frame Capture

## Status

Accepted

## Date

2026-10-02

## Context

全内容PNGではDOMのscroll値が目的地へ到達していても、native撮影の画像が同じ表示状態であることは保証できない。1倍で最初のviewportが再び入り末尾が欠ける間欠的な出力が観察された一方、計測を加えた実行は正常だった。原因を待機時間だけに断定せず、要求と画像の対応を確認する契約が必要である。2倍での座標修正は維持し、分数倍率でcropの画面原点と合成原点の丸め位相が違う1px欠けも防ぐ。

## Decision

- 既存の`capture-window-region-png`に限定した型付きrequest/responseを使用する。requestはcropと検証模様のnonce・矩形・viewport寸法、responseはPNGとnative倍率。既存sender検証を維持し、新規IPC、汎用JavaScript実行、公開capabilityを増やさない。
- Rendererは同じscroll rootの先頭に一時paddingを加えて元の内容を保護し、scroll位置に追従する64bit nonceとlocator枠の模様を置く。各模様の位置はそのtileの実scroll値から計算する。検証帯は切り出しから除外する。
- Mainは`beginFrameSubscription(false)`の画像で、nonceの全セルとlocator枠の全画素・期待位置・viewport寸法を照合する。一致したcallback画像自体をcropする。最初のcallback、2回の同じhash、`invalidate`、一定時間経過だけを成功条件にせず、照合後に別の`capturePage`も呼ばない。
- 2.5秒は失敗deadlineである。一致しなければ保存しない。同じWebContentsの同時要求を拒否し、成功・timeout・navigation・renderer終了・Window破棄でtimer/listener/subscriptionを解除する。
- root原点・crop両端・検証帯をnative pixel境界へ揃え、適用後の実矩形のpixel edgesを確認する。通常offsetは整数画像ピクセルからCSSへ変換し、最終offsetはブラウザーでclampされた実値を使う。撮影前後と各tile間でroot矩形・extent・scroll・倍率を検証する。
- 一時style、検証帯、root/入れ子scrollはfinallyで復元する。保存dialogより前に復元を終え、失敗時は部分画像を保存しない。PDF経路と保存データ形式は変更しない。

## Consequences

模様は書き出し中だけ短時間表示され、PNGには入らない。各tileでframe購読とbitmap照合が必要になる。非表示Windowや描画停止、画面移動・resizeなどで検証不能な場合は未確認画像を保存せず失敗する。

合成ラスタとstub NativeImageによるunit検証はnative compositorの受入を代替しない。同じscroll tree内の対応関係と模様の非混入は、observerを入れないMacのcold初回出力で確認する。将来のElectron更新ではFrameSubscriber画像のpixel表現も再確認する。
