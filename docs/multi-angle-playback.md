# 複数映像の共通再生セッション

## 状態と目的

**方式比較・実装中。公開版0.17.29の制限を解除したものではない。**

単一・複数angleで同じ共通時計と操作を使い、通常再生、逆再生、停止、clip切替を扱う。逆方向キーは `←` 0.5倍、`Shift+←` 2倍、`Option+←` 4倍、`Command+←` 6倍。長押し中の実画像追従と、解放後に確認した停止位置から再開することを受入対象とする。AVPlayerの採用、rateの成功、進行する時計だけでは完成としない。

[ADR 0086](adr/0086-common-native-playback-session.md)はProposedであり、現行の[ADR 0081](adr/0081-held-reverse-presentation.md)を現時点で置換しない。

## Sportscodeの公開調査

確認日: 2026-11-16。確認事実と当製品の設計仮説を分ける。

- [Hudlの2019-07-04説明](https://www.hudl.com/blog/hudl-sportscode-countdown-improved-performance)はAppleの動画基盤と、多angle・4K・高fps・H.265への対応を説明する。AVPlayerの個数、内部の共通時計、逆方向cache実装は公開していない。
- [2020年教材](https://hudl-content.s3.amazonaws.com/craft/intensive-course-digital-workbook-PRO.pdf?mtime=20200322101530)の3頁はimport時の変換不要を説明する。一方、[現在のimport案内](https://support.hudl.com/s/article/import-a-video-file-sportscode?language=en_US)の検索取得本文はcopy+transcodeを推奨する。後者の直接本文はCSS errorで取得できていない。時期と対象が違い、常に変換する・絶対変換しないとは結論しない。
- [2020-11-29説明](https://www.hudl.com/blog/hudl-sportscode-update-november-2020)はclip末尾の継続/停止/loopとangle別の音声操作を説明する。
- [更新履歴](https://www.hudl.com/releases/sportscode)の2026-01-06は単押しによる連続早送り/巻戻し、2026-05-27は一部captureのbuffer調整、2026-06-03は特定feedの再圧縮を記載する。これらは内部同期方式の証拠ではない。

手元にはSportscode 12.10.0が存在するが、ライセンス利用可否・同条件の実操作比較は未確認。現在の最新版Sportscodeの性能や、当製品との優劣をこのインストール事実から推定しない。旧マニュアルは現行内部方式の根拠に使わない。

## Apple APIから確認できる境界

[AVPlayer.setRate(time:atHostTime:)](<https://developer.apple.com/documentation/avfoundation/avplayer/setrate(_:time:athosttime:)>)は外部host clockへの同期を支援する。[automaticallyWaitsToMinimizeStalling](https://developer.apple.com/documentation/avfoundation/avplayer/automaticallywaitstominimizestalling)をfalseにする必要がある。bufferが空ならデータ準備を保証せず停止するため、全angleの準備・stall処理は当製品の責任になる。

[AVPlayerItem](https://developer.apple.com/documentation/avfoundation/avplayeritem)のreverse capabilityはready後の可否である。全フレーム供給や画面提示の品質保証ではない。`AVPlayerItemVideoOutput`で取得したPTSも実画面の提示ACKとは別に扱う。

## 現在の接続制限

`PlayerSurface`と`useNativePlaybackPanel`は単一登録を要求し、`nativeSurfaceBinding`、gateway、NativePlaybackManagerも単一所有である。Mainは一angle・一clip・offset0を資格条件とし、`nativeSourceProfile`は1080p/59.94fps/H.264/音声3本等に限定する。UIの除外条件だけを外すと複数時計・重複音声・誤ったsource所有を作るため行わない。

共通の配置計算は既存`shared/media/mediaTimeline.ts`を維持する。共通時刻にangle offsetを加え、active clipの配置開始を引いてsource時刻へ写像する。空白・半開区間・末尾・負offsetを別の時間モデルへ置き換えない。

## 取得画像による小容量比較

以下は**非GUIの取得フレームとplayer時計**の測定であり、実表示・実聴取の合格ではない。原本は読取のみ。音声は診断内でmuteし、映像の複製・全尺変換は行わない。各compute子の外側期限45秒、入力ready8秒、seek4秒、baseline画像2秒、観測1.6秒、pause後0.3秒。繰返しは同じitemの再seekであり、OSのdisk/decoder cacheをcoldへ戻していない。

| 条件                                                  | 観測                                                                             | 解釈                                                                                |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 合成320×180/59.94fps、2系統、2倍逆、共通host、3回     | 初回新画像取得157ms、warm135〜138ms、各25枚/1.6秒、最大取得間隔約73ms            | host開始猶予100msを含む。画面提示ではない                                           |
| 同素材、独立rate/common hostのABBA対照                | 独立は各系統の初動差約6〜14ms、共通hostは概ね1ms未満。ただし両者とも約25枚/1.6秒 | 同期の方向性は有望だが画像密度は改善しない                                          |
| 同素材、共通host、0.5/4/6倍逆                         | 7/約50/約75枚を各1.6秒で取得                                                     | slow reverse能力がtrueでも0.5倍の画像追従は不足                                     |
| 同素材、片側offset0.5秒                               | 各25対34〜36枚、同時に新規取得した一部ペアのみの差3.45ms                         | 同時ペアだけで全期間同期とは判定できない。未更新側の画像年齢も必要                  |
| 同素材、NV12 reader、0.5秒×2系統                      | 31sampleずつ、保持約5.76MB、初回sample149ms、2系統計227ms                        | 全sampleの有界cacheが可能。実表示と供給持続性は未確認                               |
| 許可済み1080p/59.94fps/H.264原本、同じ素材の独立2系統 | 共通host2倍逆で各6枚/1.6秒、初動約442〜446ms、取得間隔約420ms                    | 真の別カメラ同期比較ではない。取得PTSが時計より大きく遅れるため時計だけの合格を拒否 |
| 同原本、NV12 reader、0.25秒×2系統                     | 16sampleずつ、保持100.36MB、各chunk約782/660ms                                   | readerを小区間ごとに再初期化するだけでは2倍の持続供給を満たさない                   |

製品の`STApplePlayerSession`に同じhost開始APIを接続した別対照では、合成2系統の逆2倍は初回約164ms/warm143ms、各24〜25枚だった。実原本は初回約430ms/warm436〜443ms、各6枚で、時計と最新取得画像の差は最大約2.04〜2.10秒だった。片側が更新されないpollも含めるとangle間PTS差は最大約0.20秒であり、同時freshペアだけの0秒を全体同期の合格には使えない。これはunbundledの製品sessionコードで、Mainのsource資格検査・IPC・surface・署名配布版は未接続である。

同じ製品sessionで合成の通常再生（片側offset0.5秒）は各88〜90枚/1.6秒を取得したが、停止指令直前と0.3秒後の時計に、1回で約31msの差が残った。実原本逆再生では片側に約68〜75msの差も観測した。単純なpauseの返却を停止位置確定としない。共通hostの解放時刻から確定する位置と、各playerの停止/新しい画像確認を分離する必要がある。

2つの独立reader processを並行させた0.5秒窓の対照では、3位置の準備は約0.90/1.22/0.95秒だった。1窓を0.5倍で再生して稼げる1秒を一部で超え、2倍ではいずれも0.25秒に間に合わない。この対照も連続供給方式としての採用根拠にはしない。

1fpsの低解像度controlも別に取得した。これを重い実原本の測定として扱わない。buffer保持量はCoreVideoの返すdata sizeの観測合計で、resident memory、decoder内部の割当、GPU全体の使用量とは異なる。`getrusage`は当compute processのCPU/RSSのみ。全フレーム列挙や全尺decodeはしていない。

## コマンド実行環境のdecoder能力

同じ原本の圧縮GOPをAVAssetReaderで読み、一つのVideoToolbox decoderを再利用する小容量対照も行った。最初の2窓では15枚ずつを保持し、GOP読取約5〜11msに対してdecode/drain約541〜647msだった。別GOPへの移行では、開始keyを指定してもreaderが返す依存sampleが240件の有限上限へ達したため、その窓はdecodeせず停止した。必要sampleを無視して成功とは扱わない。ゼロsampleのcontrol/empty/drain markerを記録しており、編集区間の一般的な実装としては未採用である。

追加の能力対照では`VTIsHardwareDecodeSupported(H.264)`はtrueだった一方、同じformatに`RequireHardwareAcceleratedVideoDecoder`を指定したsession作成は`-12911`だった。ローカルSDKでこれは`kVTVideoDecoderMalfunctionErr`であり、権限拒否やスリープが原因とは確定できない。通常sessionの`UsingHardwareAcceleratedVideoDecoder`照会は`-12900`（`kVTPropertyNotSupportedErr`）で、HW使用の有無は**不明**である。nilをfalseへ変換した初期診断値を「software decoderだった」という証拠には使わない。この実行環境の取得性能から、署名済みGUI経路での方式の優劣を断定しない。

根拠: [VideoToolboxの同期/遅延出力とdrain](https://developer.apple.com/documentation/videotoolbox/vtdecompressionsession-api-collection)、[AVAssetReaderTrackOutput](https://developer.apple.com/documentation/avfoundation/avassetreadertrackoutput)、ローカルSDKの`VTDecompressionProperties.h`/`VTErrors.h`。環境設定・権限を変更して結果を通すことはしていない。

## 比較を続ける方式

1. **映像別AVPlayer + 共通host clock**: 通常再生の第一候補。全angleをreadyにして共通hostへ一度指令し、毎フレームJS→IPC→seekを基本方式にしない。
2. **各video output + 共通描画タイミング**: 取得画像をangle別source世代・実PTSで管理する。画面提示ACKとbuffer解放を結び、clockだけ進む状態を失敗として扱う。
3. **有界reverse cache**: 負rateだけで画像密度が不足したため比較する。元のdecoded frameを保持し、画質低下や全尺変換を前提にしない。現原本で短いreaderを再作成する方式は遅いため、GOPの再decode費、継続reader/事前の小さなring、倍率に応じたcache窓を検証する。採用はまだ確定しない。

## 共通セッションの責務

- 一つのpackage再生セッションがcanonical clock、操作世代、選択音声、全angleの状態を所有する。単一angleも同じ制御へ載せる。
- angleごとにsource/clip世代、AVPlayer、frame供給、surface、ready/blank/failedを持つ。同じファイル名や同じPTSでも所有者変更を無視しない。
- forward開始は全active angleがreadyとなってから共通hostへ予定する。空白angleはdecoder失敗ではなく明示的なblankとして扱う。
- 音声は選択された一つのangle/trackだけを有効にし、forward切替では旧側の停止後に新側を有効にする。逆方向の音声方針は別途明示し、mute/volumeの保存値を書き換えない。
- clip境界は既存配置を使い、正当なclip切替を文書取消と混同しない。空白/終了した片側の旧画像を新clipとして残さない。他angleが続く場合、package終端までは共通時計を扱う。
- active angleの準備失敗・致命的なdecode失敗では全体を停止して説明する。単なる空白は他angleの失敗にしない。native/HTMLの無検証混在や二重音声で復旧したと扱わない。
- 通常seek・方向変更・媒体切替・unmountは旧非同期完了を失効させる。既発行FS/decode/GPU処理が取消されたとは推測せず、終了確認まで所有leaseを保持する。

## 解放と保存位置

要求時刻、hostから算出した時計、取得sampleのPTS、提示済み画像を分離する。キー解放時はcommon clockをそのhost時点で止め、停止用の新世代を発行する。全active angleの停止画像（または正当なblank）を実表示で確認してから、共通位置を確定する。古い表示位置へ巻き戻す追加seekはしない。停止画像待ち中のタグ/保存は、未確認位置を確定値として記録しない。再押下と別seekの意図は旧完了から守る。

## 有界bufferと現在の実装単位

`ReverseFrameCache.hpp`はimageの所有leaseと共通保持budgetを分離する。cacheから除いたimageも、GPU/consumerに貸出中なら同じbudgetに残る。返却は別threadでも二重減算せず、古い操作/source世代のpublishを拒否する。穴・排他的末尾を別clipの画像で埋めない。これはOS全体の排他的予約ではなく、decoder内部の割当を含む厳密hard capでもない。

製品の`ApplePlayerSession.scheduleRate`はready・pending seek・numericなsource/host時刻・rateを検査して共通host開始を行う。全angle準備やbuffer準備を保証するAPIではなく、group barrier/停止監視/音声所有は引き続き上位へ実装する。実sessionの診断では、古いseek完了が新しいseekを成功扱いにしないこと、pending中/不正時刻/close後の開始拒否と既存の単一rate開始を確認した。

この部品は単体契約と実AVAssetReaderのCVPixelBufferへ接続済みだが、公開版のgroup session/surfaceへは未接続。実原本の0.25秒×2系統で、次のPTSから区間を確定できる15枚ずつを保持し、cache選択とconsumer貸出を検査した。保持94.09MB、consumer貸出中の3.14MBはcache消去後も計上され、返却後は0になった。decoded sampleのdurationが未定義だったため、末尾sampleの範囲は推測せず選択対象から除外した。reader内の一時sampleとdecoder内部は保持budgetの対象外であり、総メモリ上限とは呼ばない。原本の有限10秒packet読取ではkey PTS間隔に約1.69〜3.00秒の差があり、小区間readでもGOP再復号を伴い得る。上限を通すために画質や必要検査を緩めない。予算・memory pressure・待機期限を超えた場合は候補保持/停止とする。

## 受入ゲート

- 単一/2angle、同じ/異なるfps・codec・解像度、offset、異なるGOP境界、通常clip/空白/末尾、初回item/warmを分ける。Sportscode/QuickTimeは利用可能な既存環境だけを使い、同じ素材・開始点で比較する。
- input→要求→seek完了→取得PTS→実提示、解放→停止提示、提示間隔/停滞、angle間差と未更新画像年齢、30秒から段階的な長時間driftを測る。CPU/GPU/RSSの測定範囲を明示する。
- 一方のsource変更/破棄/失敗、遅延callback、途中取消、配布物の旧protocol、音声切替を回帰する。単体mockの成功を実decoder・実表示の証拠にしない。
- draft PRから差分レビュー、共通品質ゲート、両OS CI、署名・公証、**同一署名済み配布版の実機確認**を経て正式リリースへ進む。実表示・音声の未検証を公開版の性能達成としない。

関連: [native再生](native-playback.md)、[時間・操作測定](reports/2026-11-held-reverse.md)、[テスト](testing.md)。
