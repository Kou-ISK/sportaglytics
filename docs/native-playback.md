# Apple標準再生

macOS arm64の対応する単一local映像はAVPlayerで原本を直接再生します。再生用コピーの作成、方式選択、常時の開発警告は通常画面に出しません。音声選択・消音は既存の再生ツールバーへまとめます。実際の復旧失敗は隠さず、停止と復旧操作を表示します。

## 再生中核

AVPlayerが読み出し、復号、音声出力、共通時計を所有します。AVPlayerItemVideoOutputから、その時計に対応するNV12画像だけをIOSurfaceで既存の表示面へ渡します。独自FFmpeg復号、bwdif全field処理、PCM窓、独自の供給回復機構は再生経路から削除しました。FFmpeg/ffprobeは既存の書き出しと有界header確認に引き続き使います。

表示面はsandbox preloadと既存DOMコンテナに置き、既存のoverlay座標・重ね順・全画面要素を維持します。転送は最大3画像で、描画ACKとGPU参照解放を分離します。AVPlayerの内部buffer容量を、この3画像上限で保証したとは扱いません。

[ADR 0080](adr/0080-apple-player-playback.md)に採用理由を記録します。[AppleのAPI](https://developer.apple.com/documentation/avfoundation/avplayeritemvideooutput)を使用しますが、QuickTime PlayerやSportscodeの非公開内部と同一と主張しません。

## 操作と所有権

- タイムライン押下中は近傍画像を高速に表示し、一時停止を保ちます。離す・capture喪失・同じ画面を閉じる場合は近傍シークを確定し、実際の確認時刻から再開します。
- 通常スクラブの確定にはzero-tolerance seekを強制しません。コマ送り、キーによる相対操作、明示時刻指定は厳密シークです。近傍画像の時刻を要求時刻と偽りません。
- タグ・保存・書き出しの共通時計は確認済みAVPlayer時刻です。未完了の要求位置とは分離します。連打の相対操作は最新要求位置に加算します。
- 逆方向キーを離した時点で未完了のシークが残る場合、その操作だけを最後に描画した画像の位置へ戻します。古い画像の配送は即時に除外し、確認時計はApple側の応答を待ちます。別のシーク・再生・音声操作、文書交代、原本復帰を上書きしません。押下中の速度計算と要求頻度は変更しておらず、この修正だけで逆方向の滑らかさを保証しません。
- 速度・音声選択・音量はAVPlayerへ渡します。実際のitemが速度を扱えない場合は停止・終了確認後に既存経路へ引き継ぎます。
- Mainがsource/文書/generationを所有し、限定IPCでsender・payload・操作順序を確認します。通常利用に全尺変換、全尺hash、frame列挙を追加しません。
- 原本復帰中に新しいドラッグが来た場合も、押下中に再生を再開したり所有権を解放しません。旧文書のgestureで新文書をシークしません。

## 適用範囲と既存機能

現在の表示資格は1080のH.264、60000/1001入力、BT.709、3つの48kHz stereo AACという既存profileです。これはAVPlayer全体の対応形式上限ではなく、現在のsurface橋渡しで確認している範囲です。複数clip/angle、録画、異なるgeometry/color、Intel Mac、Windowsは既存の互換再生を保持します。Windowsへの新方式移植は今回の対象外です。

原本ファイル、project保存形式、描画・タグ・書き出しモデルは変更しません。選択音声は確認後にsource単位で既存exportへ伝えます。再生変更だけで描画合成や書き出し互換を保証せず、関連回帰と実package検証を行います。厳密な文書末尾への移動は既存の終端adapterを使います。非対応条件を利用者の方式選択へ押し付けません。

## 検証と限界

Session/Controller、preview・scrub・厳密シーク、source交代、連打、取消、通常終了、復帰失敗、sender/payloadの回帰を実行します。実原本は同じ区間・背景負荷で、押下中画像、離した後、再生進行、停止再開、速度、音声切替、末尾を確認します。比較は新しい画像と確認時計を根拠にし、待機表示を隠したことを改善と扱いません。

短い無音の成功は実聴取同期や長時間安定の証明ではありません。旧独自方式で起きた間欠停止の解消を、AVPlayerへの置換だけで断定しません。最終Mac署名packageの起動・終了・保存・書き出し、公証は別ゲートです。raw実媒体・私有project・測定画像は公開repositoryへ含めません。

## ビルドと診断

`native/macos/playback/apple-player`がAVPlayerの操作、`surface-transport`が画像の所有を担当します。`native:build`は固定source・Node headers・Apple SDKからhelper/receiverを構築します。FFmpegのstatic linkやworker適応は行いません。[対応ソース](third-party-distribution.md#native-playback-previewの対応ソース)と署名後hashを実配布物に対応づけます。旧releaseと原本を保持してrollback可能にします。

Mainは初期化前にclose可能なownerを返し、実process/pipe/GPU終了と停止時計receiptを確認します。秘密・映像・音声を記録せず、既存の数値256KiB ring、追加メモリ最大1MiB、保存最大2MiB×4件のローカル診断だけを使用します。診断失敗は再生や終了の成功条件にしません。

診断先はuserData内の`native-preview/recurrences`、一時manifest/receiptは`native-preview/sessions/session-1..4`です。媒体pathを含む一時manifestは確認済み終了後に今回作成分だけ削除し、既存slot/ユーザーファイルを上書き・削除しません。外部送信、新しい権限・永続設定はありません。
