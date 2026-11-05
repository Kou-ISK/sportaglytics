# Apple標準再生

macOS arm64の対応する単一local映像はAVPlayerで原本を直接再生します。再生用コピーの作成、方式選択、常時の開発警告は通常画面に出しません。音声選択・消音は既存の再生ツールバーへまとめます。実際の復旧失敗は隠さず、停止と復旧操作を表示します。

## 再生中核

AVPlayerが読み出し、復号、音声出力、共通時計を所有します。AVPlayerItemVideoOutputから、その時計に対応するNV12画像だけをIOSurfaceで既存の表示面へ渡します。独自FFmpeg復号、bwdif全field処理、PCM窓、独自の供給回復機構は再生経路から削除しました。FFmpeg/ffprobeは既存の書き出しと有界header確認に引き続き使います。

表示面はsandbox preloadと既存DOMコンテナに置き、既存のoverlay座標・重ね順・全画面要素を維持します。転送は最大3画像で、描画ACKとGPU参照解放を分離します。AVPlayerの内部buffer容量を、この3画像上限で保証したとは扱いません。

取得したCVPixelBufferはCMSampleBufferへ包み直さず、元のIOSurfaceと確認済みPTSを送ります。転送に使わないsample形式の検証で`kCMSampleBufferError_InvalidMediaFormat`となり終了する経路を除去します。元のpixel bufferをReleased ACKまで保持し、Drawn ACKだけでは画像プールへ返しません。既存のNV12配置・時刻・送信元・世代検証と3画像上限を維持します。このbuffer保持だけを逆方向の表示待ちの解消とは扱いません。

[ADR 0081](adr/0081-held-reverse-presentation.md)に採用理由を記録します。[AppleのAPI](https://developer.apple.com/documentation/avfoundation/avplayeritemvideooutput)を使用しますが、QuickTime PlayerやSportscodeの非公開内部と同一と主張しません。

## 操作と所有権

- タイムライン押下中は近傍画像を高速に表示し、一時停止を保ちます。離す・capture喪失・同じ画面を閉じる場合は近傍シークを確定し、実際の確認時刻から再開します。
- 通常スクラブの確定にはzero-tolerance seekを強制しません。コマ送り、キーによる相対操作、明示時刻指定は厳密シークです。近傍画像の時刻を要求時刻と偽りません。
- タグ・保存・書き出しの共通時計は確認済みAVPlayer時刻です。未完了の要求位置とは分離します。連打の相対操作は最新要求位置に加算します。
- 長押し逆再生はready後の`canPlaySlowReverse`（0.5倍）/`canPlayFastReverse`（2/4/6倍）を確認し、開始・速度変更時に負のrateを渡します。押下中に毎フレーム厳密シークを発行しません。能力フラグやrateを表示成功とせず、Drawnの異なる減少PTSが1秒以上途絶えれば停止・終了確認後に互換経路へ移ります。
- ネイティブの解放では先にpauseを要求し、実timebaseが0になった後の画像とメディア時刻で確定します。解放時のシークはありません。PTSと確認時計は負方向に進められますが、文書/source/操作sequence/配送IDの検証は維持します。
- 非対応素材、HTML、Playlist、複数アングルの代替は、表示まで進める1要求と最新希望位置1件を分けます。同じ長押しの入力で描画待ちを毎回破棄しません。解放は入力だけを止め、最後の希望位置まで完了します。HTMLは元映像PTSとpaint待ちを経て時計を公開します。Playlistは項目開始が下限で、時差、clip切替、既知の空白を維持します。確認できない画像はエラーで停止します。
- 再押下、別シーク、順再生、素材/項目切替は旧処理を失効させます。音量・消音変更は同じネイティブ逆再生操作を保持します。指定速度の実表示と待ち時間は[測定手順・クラウド検証](reports/2026-11-held-reverse.md)で別途評価します。
- 速度・音声選択・音量はAVPlayerへ渡します。実際のitemが速度を扱えない場合は停止・終了確認後に既存経路へ引き継ぎます。
- Mainがsource/文書/generationを所有し、限定IPCでsender・payload・操作順序を確認します。通常利用に全尺変換、全尺hash、frame列挙を追加しません。
- 原本復帰中に新しいドラッグが来た場合も、押下中に再生を再開したり所有権を解放しません。旧文書のgestureで新文書をシークしません。

## 適用範囲と既存機能

現在の表示資格は1080のH.264、60000/1001入力、BT.709、3つの48kHz stereo AACという既存profileです。これはAVPlayer全体の対応形式上限ではなく、現在のsurface橋渡しで確認している範囲です。複数clip/angle、録画、異なるgeometry/color、Intel Mac、Windowsは既存の互換再生を保持します。Windowsへの新方式移植は今回の対象外です。

対応native再生中のCommand＋左は、フォーカスされたウィンドウ内のキー解放を受け取って停止します。入力の配送、停止画像、所有者の確定を順に確認し、別のシークや再生操作が割り込んだ場合は古い操作を終了してから引き継ぎます。ネイティブ入力を利用できない環境では既存のキー経路を使います。対象外の素材までネイティブ対応範囲を拡大する変更ではありません。

原本ファイル、project保存形式、描画・タグ・書き出しモデルは変更しません。選択音声は確認後にsource単位で既存exportへ伝えます。再生変更だけで描画合成や書き出し互換を保証せず、関連回帰と実package検証を行います。厳密な文書末尾への移動は既存の終端adapterを使います。非対応条件を利用者の方式選択へ押し付けません。

## 検証と限界

Session/Controller、preview・scrub・厳密シーク、source交代、連打、取消、通常終了、復帰失敗、sender/payloadの回帰を実行します。実原本は同じ区間・背景負荷で、押下中画像、離した後、再生進行、停止再開、速度、音声切替、末尾を確認します。比較は新しい画像と確認時計を根拠にし、待機表示を隠したことを改善と扱いません。

短い無音の成功は実聴取同期や長時間安定の証明ではありません。旧独自方式で起きた間欠停止の解消を、AVPlayerへの置換だけで断定しません。最終Mac署名packageの起動・終了・保存・書き出し、公証は別ゲートです。raw実媒体・私有project・測定画像は公開repositoryへ含めません。

## ビルドと診断

`native/macos/playback/apple-player`がAVPlayerの操作、`surface-transport`が画像の所有を担当します。`native:build`は固定source・Node headers・Apple SDKからhelper/receiverを構築します。FFmpegのstatic linkやworker適応は行いません。[対応ソース](third-party-distribution.md#native-playback-previewの対応ソース)と署名後hashを実配布物に対応づけます。旧releaseと原本を保持してrollback可能にします。

Mainは初期化前にclose可能なownerを返し、実process/pipe/GPU終了と停止時計receiptを確認します。秘密・映像・音声を記録せず、既存の数値256KiB ring、追加メモリ最大1MiB、保存最大2MiB×4件のローカル診断だけを使用します。診断失敗は再生や終了の成功条件にしません。

診断先はuserData内の`native-preview/recurrences`、一時manifest/receiptは`native-preview/sessions/session-1..4`です。媒体pathを含む一時manifestは確認済み終了後に今回作成分だけ削除し、既存slot/ユーザーファイルを上書き・削除しません。外部送信、新しい権限・永続設定はありません。
