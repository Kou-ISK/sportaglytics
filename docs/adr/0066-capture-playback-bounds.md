# 0066 Capture playback bounds

## Status

Accepted

[0054](0054-continuous-capture-playback.md)の単一MediaSourceと限定バッファを維持し、保存済み全体尺と終了・シークの契約を補足する。

## Date

2026-10-17

## Context

読み込んだ近傍区間だけをMediaSourceのdurationへ設定すると、離れた場所へのシークが古い終端へ補正される。その位置をバッファが退避するとseekedが来ず、同期処理が永久に待つ。録画末尾の音声と映像の長さの差も、終了通知のないMediaSourceでは待機を生む。

## Decision

- 全確定区間の終端をMediaSourceへ提示し、近傍バッファの範囲と分離する。durationはopen状態で初期化・伸長するだけにし、実sampleが伸ばした値を縮めない。
- 通常の時計補正はdecodeの完了を待って集約する。利用者の明示的なシークは、既に退避された位置への未完了要求を置換できる。
- 録画中は終了通知を送らない。停止して保存完了した文書は最終区間のappend完了後にendOfStreamを呼ぶ。EOS後のduration再計算を尊重し、過去シークでは再びバッファを読み込める。
- fragmentのreadとSourceBuffer操作は15秒で失敗へ進み、既存の区間再生fallbackを使う。録画プロセス自体は再生失敗に巻き込まない。
- 停止は入力末尾の排出→プロセスfinalize→最終区間収集→config保存→完了通知の順序を維持する。保存失敗はerrorとして既存区間を保持する。再オープン時の再生準備は録画Sessionから独立する。

## Consequences

保存成功と再生可能を別々に検証する必要がある。初期bufferの存在だけを成功とせず、離れた前後シーク、音声末尾差、終端からの戻り、別processでの再オープンを合成映像で確認する。既存の録画パッケージを再エンコードしない。
