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

### Mainの素材プラン

`resolveNativePackageSourcePlan`は、Mainが所有するpackage pathと選択angle IDから、最大2系統の素材プランを作る。package内の最大8angle/各16clipを上限とし、選択されたlocal素材だけを調べる。既存`getAngleOffset`/`resolveMediaTime`/`getMediaTimelineEnd`を使い、surfaceの選択順を変えても元のpackage番号に対するoffsetを維持する。clipの既知の配置・長さ、重複ID・重なり、有限のpackage時刻を検査し、不明な配置や長さを隣のclipから推測しない。空白はsource失敗と区別して返す。

filesystem adapterは既存の単一素材資格検査とも共有する。metadataは1MiB上限・leaf非追従で読み、package更新/capture中、config変更、通常のsource置換を再検査する。相対参照のpackage外への逸脱とsymlinkは拒否し、既存の絶対local参照は維持する。任意の同一UIDによる親dir差替えを、複数のstatだけで完全に封じたとは主張しない。プランの時刻解決はopaque source keyを返し、Rendererからpathを渡す権限を追加しない。

このプランはgroup backendへのMain内部の入力段階で、Window/Package Session認証、helper能力検査、IPC、surface登録を代行しない。既存providerは単一素材の資格条件を維持し、group helper接続前に複数素材を単一URLとして公開しない。合成filesystemの回帰では、元angle番号のoffset、選択順、空白/排他的末尾、設定/素材置換、選択配列の非同期変更、絶対参照、symlinkと既存単一条件を検査する。

Main所有のAbortSignalで要求を失効できる。FSのawait境界で取消を確認し、新たな検査や失効済みプランの時刻解決を拒否する。既に実行中のFS操作を中断したとは扱わず、handleを閉じて返るまで待つ。他packageの更新lease/取消と混線させない。この段階にOSのFS停止時間の絶対保証はない。

## 取得画像による小容量比較

`scripts/testing/native-group-acquisition.mm`の現在のcontent fingerprintはNV12のformat・寸法と両planeの全active byteをSHA256へ入力する。行末paddingは除外し、上限4096×2160の外や不正なlayoutは画像不明とする。輝度を97byteごとに採取していた旧markerは全画像同一性の証拠にせず、過去のPTS取得数と区別する。全画素検査にも観測負荷があるため、異なるmarker方式の待ち時間を無条件に比較しない。`success`は有限診断の完了であり、滑らかさ・実表示の合格ではない。

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

同じ権限・実行環境の別processで、1080p/59.94fps/High 4.2/8bit/BT.709/参照4枚の小さい合成対照を比較した。progressiveはHW必須decoderを2個とも作成でき、HW使用propertyもtrueだった。interlacedの対照と実原本は最初のHW必須作成が`-12911`だった。実原本は圧縮headerの`frame_mbs_only_flag=0`、`field_pic_flag=1`、取得bufferのFieldCount=2を確認した。原本のSPS/PPSを変更せずApple APIでformat descriptionだけを作り直しても結果は変わらなかった。従って「このMacではH.264全般がHW利用不能」「ロックが原因」とは扱わず、scan/coding方式を含む入力別の能力として評価する。この少数対照から全interlaced入力の非対応を断定しない。fieldや色の情報を削って初期化を通す変更は採用しない。

根拠: [VideoToolboxの同期/遅延出力とdrain](https://developer.apple.com/documentation/videotoolbox/vtdecompressionsession-api-collection)、[AVAssetReaderTrackOutput](https://developer.apple.com/documentation/avfoundation/avassetreadertrackoutput)、ローカルSDKの`VTDecompressionProperties.h`/`VTErrors.h`。環境設定・権限を変更して結果を通すことはしていない。

## 事前準備と短押しの追加対照

[preroll API](<https://developer.apple.com/documentation/avfoundation/avplayer/preroll(atrate:completionhandler:)>)はreadyかつrate0で使う。実原本の同じ20秒位置/逆2倍/独立2系統、同じBGRA診断のABBA順（各processで初回itemとwarmの2回、計8回）では、controlの最初の後退画像取得は約432〜436ms、preroll後は約422〜435msだった。しかし別途542〜551msの準備が加わり、内容の変化は双方とも6回/1.6秒に留まった。準備済みcurrent timeを使う別対照2回でも約427〜438msに準備540〜549msが加わった。この順序のpreroll追加は改善として採用しない。OS cacheは消しておらず、実表示比較ではない。

製品sessionの共通host開始に対し、予定anchorの約74〜77ms前にpauseする2回の対照では、両系統の時計は20秒で保持され、後退画像は取得しなかった。解放後に残った1枚は同位置のbaseline確定であり、逆再生が後から始まったとは扱わない。

SDKのhost同期契約は、未来hostを厳密な遅延実行timerとは定めない。timebaseはanchor前にも進み得るため、groupのcanonical clockと画像publish境界で開始前の画像を扱う。clip offsetを含めて準備済みであることと、全angleの実提示が完了したことを混同しない。

## 停止画像と追加の供給対照

既存の独立`setRate`（自動待機のdefaultを維持）と新しい共通host開始（自動待機false）は異なる条件であり、比較結果を相互に流用しない。音声trackを一つ選んでmuteした実session対照では、単一の独立2倍逆でも、pause後の強制取得画像が停止時計より約1.13〜1.16秒古かった。各条件2回、20秒から1.6秒観測し、実表示は未接続である。停止時計へ一度だけexact seekする別対照では、単一は対象位置の約1フレーム以内を取得したが約0.87〜1.07秒の追加待ちがあった。共通hostの2系統ではseek完了trueの後も古いPTSを取得した。従ってseek完了やnonnull bufferを停止画像確認とみなす修正は採用しない。停止時計・sampleの有効区間・実表示ACKを照合する責務が残る。

別の隔離したGUI対照で、2つの独立した直接`AVPlayerLayer`、同じ原本の20秒開始、共通host/逆2倍/5秒、音声一系統ずつmuteを確認した。準備済みの画面と操作後画面を同じ実行IDで取得したが、停止時計は約9.943/9.868秒と約75ms離れ、表示場面は別途読取取得した10秒の参照画像と異なった。映像は変化したものの、連続性・最初の提示の時刻・正しい停止frameは合格にしない。実画面取得の間隔ではframeごとの提示PTSを計測できず、時計とlayerReadyだけを実提示の証拠にしない。

同GUI診断の初回は8秒の準備期限で終了し、その後の画面取得で再起動された可能性があった。初回ログを後続の画面の測定値へ流用しない。修正した診断は実行IDと一回限りの起動ticket、自己終了を持ち、終了後はアプリ個別取得をせず全体一覧で停止を確認した。製品アプリや原本/設定は変更せず、この対照を署名済み製品group経路の受入とは扱わない。

小さい範囲の連続取得では、getter呼出し削減、`hasNewPixelBuffer`を省いた毎poll強制取得、preroll追加は、揃えた対照で供給改善を示さなかった。依存GOPの対象外画像にVideoToolboxの`DoNotOutputFrame`を指定する実験も、対象15枚のPTS/active NV12画素の一致は保ったが復号時間を改善しなかった。これらを高速化として製品へ入れない。

保持容量の別仮説として、取得済み画素をAppleのlossless LZ4で保存する小容量対照を行った。一つの1080p/0.25秒/15枚では、active NV12計46.66MBに対して、独立圧縮30.82MB、隣接frameとのXOR差分19.87MBだった。差分方式の圧縮約121ms、逆順復元と全active画素比較約26msで、全画素が一致した。これは一窓のみの診断で、一般の圧縮率、連続供給、総メモリ上限、製品採用を保証しない。field/color情報を含む復元adapter、最悪時raw容量、anchor間隔、共有budget、途中取消を検証してから採否を決める。原本の再圧縮や全尺変換は行っていない。

## 比較を続ける方式

停止画像については、2つの実製品sessionを共通hostで20秒から逆2倍・5秒動かす有界対照で、pause後のclockが約10秒でも古い17秒付近のoutputを返した。exact seek完了後も5秒以内に一致しない対照があった。自動待機をtrueへ戻す仮説は解消せず不採用とした。古い画像を拒否し、補正時だけvideo outputを再作成する製品コードの対照では、同じprocess内2回・各2映像とも、実停止時計の名目1フレーム内の画像を約805〜807msで取得した。通常の明示seekは従来のままで、補正は一停止につき一度に限定する。

これは実AVPlayerSessionの取得検査であり、Main/IPC/group surface、物理画面、実音声同期の合格ではない。押下中は5秒あたり10画像、初動約621〜630ms、取得間隔の最大約812msであり、滑らかさの目標は未達である。正しい停止取得への改善を連続逆再生の完成と扱わない。

別の各1回の同session対照では、0.5倍は約315ms、4倍/6倍は先頭に達した時計0秒の画像を約153/105msで取得し、各2映像ともPTS検査を通った。これらは下限と倍率の限定確認であり、条件の異なる2倍測定との速度比較や倍率どおりの実提示の証明ではない。

終端の境界を追加した再対照でも、逆2倍の両系統は各停止時計に合う画像を約768〜775msで取得した。ただし時計同士は約54ms離れたため、共通host指令だけでgroup停止同期が完了したとは扱わない。素材末尾近くからの単一順再生は自然終了の時計と最終画像を補正なしで保持した。これらも実sessionの取得であり、clip/group/物理画面の受入とは分離する。

1. **映像別AVPlayer + 共通host clock**: 通常再生の第一候補。全angleをreadyにして共通hostへ一度指令し、毎フレームJS→IPC→seekを基本方式にしない。
2. **各video output + 共通描画タイミング**: 取得画像をangle別source世代・実PTSで管理する。画面提示ACKとbuffer解放を結び、clockだけ進む状態を失敗として扱う。
3. **有界reverse cache**: 負rateだけで画像密度が不足したため比較する。元のdecoded frameを保持し、画質低下や全尺変換を前提にしない。現原本で短いreaderを再作成する方式は遅いため、GOPの再decode費、継続reader/事前の小さなring、倍率に応じたcache窓を検証する。採用はまだ確定しない。

### 供給不足の追加切り分け

小容量の圧縮sample読取とVideoToolbox対照では、読取は約5〜13ms、依存GOPの復号は約0.5〜1秒だった。SDKの任意`ThreadCount`へ2/4を指定でき、実decoderもその値を返したが、同じ短区間の復号はdefault/2/4/defaultで約0.93秒のままだった。スレッド指定を高速化として採用しない。これをOS全体のCPU使用率や全codecの結果へ一般化しない。

同じ原本の1秒分を0.25秒ずつ取得すると、同じ依存sampleを含む計222画像の復号に約2.76秒かかった。1秒分をまとめて取得すると77画像の復号、約0.96〜0.97秒で、選択した60枚のPTSと全active NV12画素SHA256が一致した。raw保持は最大約47MBから188MBへ増える。この対照は選択窓のまとめ読みであり、全GOP/全尺を無制限に保持する提案ではない。

sampleが窓の開始をまたぐ場合は、開始より前のPTSでも実sample区間が開始を覆う画像を含める。PTSだけで開始前の画像を捨てると境界が欠ける。実durationをCMTimeで加算した61枚の対照では、既存`ReverseFrameCache`を4つの新しい要求で再利用し、各境界を覆う画像を取得できた。旧producerの再publishは拒否し、終了後の保持計上は0だった。これはnative cache部品と実bufferの接続であり、Main/group/surfaceへの接続完了ではない。

一方、2つの実AVPlayer sessionを停止状態の共通時刻へ直列seekする別対照は、最初の小さな後退画像を約117〜119msで取得したが、5秒間の確認画像は5組、最終停止確認は約1.5秒だった。初回移動距離も負rate対照と異なり、初動改善値として採用しない。画像の追従と供給量を満たさないため、この方式を製品の連続逆再生へ置換しない。

実時計から離れた画像が少しずつ進む状態を、既存の変化検査だけで成功扱いしないよう単一Hostの監視を補強する。現在操作のDrawn PTSと実時計の差を要求倍率で換算し、既存と同じ壁時計1秒を超えた場合は失敗停止へ渡す。同じ長押しの自動seek反復は追加しない。この誤判定修正は、供給持続性・実表示・複数映像の完成を意味しない。

## 共通セッションの責務

### 次のgroup接続で維持する境界（未提供）

現Receiver addonはport・peer・flight map・last IDを一つだけ持ち、v1 packetにはangle/source世代がない。既存のgateway/surface登録も単一所有である。2つのsenderを同じv1 channelへ接続するとIDやPTSの所属を区別できないため、除外条件だけを外さない。group能力を検査した別versionの契約で、group内で一意な配送ID、angle slot、source世代、表示操作、共通時刻とsource PTSの分離を実装する。旧helperをgroup対応と推測しない。

2angleを揃えて切り替えるbarrierでは、表示中の2画像を保持したまま次の2画像を受ける必要がある。v1の全体3枠をそのまま流用すると、最後の1画像を送れず旧pairも解放できない。新group契約は少なくとも4枠を必要とし、最大6枠を上限候補として共通予算へ計上する。v1の3枠は変更しない。transfer/GPU/Drawnの各完了、片側blank/失敗、途中取消とclip世代を含む回帰・実表示を通すまで、このgroup契約を公開済みとは扱わない。

画像のsource PTSをangle間で直接比較せず、既存のoffset/clip配置から共通時刻へ写像する。Mainが検証したliveな配置revisionとsource grant、共通時計、音声ownerを持ち、settings配送sequenceと表示操作の寿命を分ける。これらのMain/IPC/Renderer接続は、この段階の素材プランや共有leaseだけでは実装済みにならない。

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

共通の`frame-ownership/FrameLease.hpp`はimageの所有leaseと保持budgetを担当し、`ReverseFrameCache.hpp`は同じleaseを用いてcache選択を行う。cacheから除いたimageも、GPU/consumerに貸出中なら同じbudgetに残る。返却は別threadでも二重減算しない。decode要求と再生/表示操作の世代を分け、同じ検証済みsourceの完成済みimmutable画像は次の要求でも再利用する。古いproducerのpublish、古い要求のselect/取消は拒否する。要求取消は現在のpublish/select権限を失効させるが、完成画像を次の要求で再利用するために保持できる。`clear`はevictionのみで取消ではない。frameのproducer由来を新しい表示操作のACK権限として使わず、consumer側の操作識別子を別に持つ。穴・排他的末尾を別clipの画像で埋めない。これはOS全体の排他的予約ではなく、decoder内部の割当を含む厳密hard capでもない。

`RetainedImage`は時間区間を持たない資源leaseで、`RetainedFrame`が検査済みsample区間・producer由来を付ける。通常のAVPlayer転送のために不明なsample durationを捏造しない。既存`SurfaceSender`の通常経路も予算で計上し、cache由来の`sendLeased`は同じ予算に属する`RetainedImage`だけを受理する。groupではcache/各senderへ同じ予算stateを渡す。画像と無関係な予算ownerを別引数で渡さず、別予算からの迂回を拒否する。

cache消去やDrawn ACKでは予算を返さず、既存のReleased ACKでsenderの追加pixel参照を先に破棄し、その後leaseを返す。Released未確認のsender破棄では同じ画像の予算を一度だけquarantineへ残し、別senderのReleasedだけで解消しない。残量があっても同じ予算での新規保持・転送を拒否する。これは外部GPU終了を捏造せず予算の再利用を止める会計であり、新しい予算の作成を復旧手順とは扱わない。通常のHost成功終了は全pendingのReleasedを待ち、終了不明は既存の失敗・quarantine方針を維持する。送信失敗、credit不足、無効ACKや従来の非cache画像の所有を維持する。予算不足は転送前に拒否し、Hostは既存のmedia失敗・終了確認へ渡す。実CoreVideo poolと同じMach転送の対照では、cache消去後も予算・pool再利用が保留され、Drawn後も保留、Released後に予算0・再利用可能となった。ACKは試験peerが発行しており、実Electron GPU完了や画面表示の受入ではない。group backend・Main/IPC・継続供給器への接続も引き続き未完である。

実原本を読む2つの製品`STApplePlayerSession`から通常転送/借用転送へ各1画像を渡す非GUI対照も通った。共通予算の保持は6,272,768bytes、両Drawn後も同じで、Releasedに従い3,136,384→0bytesとなった。元のIOSurface IDを保ち、pixel copyを追加していない。これは静止画像の資源経路で、source clock/PTSは別記録し、Main IPC、継続再生、実GPU/画面、実音声、署名配布版の受入とは扱わない。

製品の`ApplePlayerSession.scheduleRate`はready・pending seek・numericなsource/host時刻・rateを検査して共通host開始を行う。全angle準備やbuffer準備を保証するAPIではなく、group barrier/停止監視/音声所有は引き続き上位へ実装する。実sessionの診断では、古いseek完了が新しいseekを成功扱いにしないこと、pending中/不正時刻/close後の開始拒否と既存の単一rate開始を確認した。

この部品は単体契約と実AVAssetReaderのCVPixelBufferへ接続済みだが、公開版のgroup session/surfaceへは未接続。実原本の0.25秒×2系統で、次のPTSから区間を確定できる15枚ずつを保持し、cache選択とconsumer貸出を検査した。保持94.09MB、consumer貸出中の3.14MBはcache消去後も計上され、返却後は0になった。decoded sampleのdurationが未定義だったため、末尾sampleの範囲は推測せず選択対象から除外した。reader内の一時sampleとdecoder内部は保持budgetの対象外であり、総メモリ上限とは呼ばない。原本の有限10秒packet読取ではkey PTS間隔に約1.69〜3.00秒の差があり、小区間readでもGOP再復号を伴い得る。上限を通すために画質や必要検査を緩めない。予算・memory pressure・待機期限を超えた場合は候補保持/停止とする。

同じ実bufferを次のsource同一要求で再利用し、古いproducerの再publishを拒否する対照も通した。さらに別のMetal offscreen 1MiB buffer転送では、unretained command bufferの完了handlerまでleaseを保ち、GPU完了とconsumer返却に応じて2MiB→1MiB→0と計上が減ること、全転送byteの一致を確認した。これはbuffer寿命の検証であり、動画描画、色、field処理、実画面提示の証拠ではない。

## 受入ゲート

- 単一/2angle、同じ/異なるfps・codec・解像度、offset、異なるGOP境界、通常clip/空白/末尾、初回item/warmを分ける。Sportscode/QuickTimeは利用可能な既存環境だけを使い、同じ素材・開始点で比較する。
- input→要求→seek完了→取得PTS→実提示、解放→停止提示、提示間隔/停滞、angle間差と未更新画像年齢、30秒から段階的な長時間driftを測る。CPU/GPU/RSSの測定範囲を明示する。
- 一方のsource変更/破棄/失敗、遅延callback、途中取消、配布物の旧protocol、音声切替を回帰する。単体mockの成功を実decoder・実表示の証拠にしない。
- draft PRから差分レビュー、共通品質ゲート、両OS CI、署名・公証、**同一署名済み配布版の実機確認**を経て正式リリースへ進む。実表示・音声の未検証を公開版の性能達成としない。

関連: [native再生](native-playback.md)、[時間・操作測定](reports/2026-11-held-reverse.md)、[テスト](testing.md)。

## Group v2 の転送・提示接続（開発中）

v1とは別のMach message識別子を持つgroup v2を追加した。1 sessionに2 viewport、共通の6 creditを持ち、両creditを確保してからpairを発行する。画像のoperation/seek、pair、angle、source epoch/index、source sample区間、共通時刻と有効区間を別々に運ぶ。Mainは検証済み素材プランへの写像を検査し、IOSurface handleをRendererへ公開しない。初期転送は既存の1080p NV12/BT.709 limited資格条件に限定し、一般素材の資格拡張を済ませたとは扱わない。

Mainの`groupSurfaceTransport`はimport、転送完了、Renderer ACK、GPU参照終了を分離する。終了時はowned producerのexit/pipe closeの証拠を先に要求し、未確認のrelease/transferは再試行やbudget返却をせず保持・失敗通知する。native addonの全group操作は開いたservice tokenへ束縛し、v1のcloseや古いownerからgroup資源を閉じない。

preloadでは既存の単一`setSharedTextureReceiver`からv2を分岐する。別々のcanvasを要求し、両angleの同じpair/共通anchorがそろい、両VideoFrameを取得してから一回のRAF内で描画する。空白は不透明なmedia blackとして扱い、古いHTML画像を透過表示しない。新sourceで不完全な旧pairを解放し、operation失効・unbind・エラー時に未提示の借用を残さない。片側描画失敗時はpair成功を報告しないが、すでに行ったcanvas描画を取り消せる、物理表示が原子的に同期するとは保証しない。

提示receiptとMainの両ACK記録は実際にcanvasへ送ったpairの共通時刻であり、要求時刻、AVPlayer時計、物理scanoutの証明とは異なる。新しい操作だけでreceiptを進めず、片側だけのACKを停止位置の証拠にしない。現在はMain transportとpreload受信の接続段階で、Hostには後述の限定placed-pair入口を追加したが、helper capability・通常Controllerからのgroup bind/停止fence・packageのclip切替・継続reverse供給は未接続である。公開APIへv2を有効化しておらず、この差分だけを複数映像製品の完成や速度改善とはしない。

停止fenceのMain内照合は`groupPresentationLedger`へ分離する。最後にcanvasへ送った2 delivery IDとpair/owner/seek/共通anchorを、最大64 pairの発行metadataへ照合する。ACK遅延中でも発行済みpairを検査できるが、未発行・不完全・別seek・書換えた時刻・期限外の履歴・既に新しいpairを提示済みの古いproofは拒否する。これは新しいRenderer公開権限ではなくMain内部の検査であり、preloadでの停止時receipt捕捉とHostへの停止fence伝達をまだ代行しない。Host接続時は音声/clockのpauseをACK待ちで遅延させず、発行済みnative metadataにも照合する必要がある。

native producerも`GroupSurfaceSender`に最大64 pairの発行metadataを残し、停止fenceのoperation/seek/pair/共通anchorと両delivery IDを照合できる。Released後もmetadataだけを短期保持し、画像leaseを延命しない。partial sendの不完全pair、履歴外、古いcontrol、すでに新しいDrawnがあるpairを拒否する。限定placed-pair Hostの入力loopはこの照合を使用する。通常Main/preloadとのrelayとpackage全体のgroup Host制御は未完である。

Hostの`DecodedFrameWindow`は圧縮CMSampleBufferをVideoToolboxへ渡し、その同じsampleのPTS/durationと復号callbackの時刻を照合する。AVPlayerの表示deadlineから元画像時刻を推定しない。指定窓は最大1秒、現在のsource要求は前後0.25秒、512 buffer・圧縮16MiB・単packet 4MiB・保持64画像までとし、同時workerはhelper全体で2件、各sourceは1件に制限する。受付から5秒を過ぎた結果を採用しないが、応答しないSDK操作を終了済みと扱わず実worker/callbackの排出を待つ。

Mainで検査したfile revision（dev/ino/size/mtime/ctime/nlink）をmanifestから供給器へ渡し、読取開始・画像採用・cache参照で照合する。通常の素材差し替え/変更を拒否する境界であり、同一UIDによる任意の親directory改変への排他的保証ではない。取消/旧requestのcallbackは新画像を公開できない。画像loanの解放まで共有保持budgetへ計上し、decoder内部/OS/GPU全体のhard capとは呼ばない。

ImageIO JPEG passthroughの自作fixtureはVFR、600Hz/120000Hz、異なる画像内容、取消/欠損/差し替え、予算不足と実排出を確認する。JPEGの色変換はcodec/寸法別の自作基準と比較し、H.264全般の色資格や書き出し成功とは扱わない。

### 限定placed-pair Hostの実接続

`nativeGroupHostConfiguration`はMainの選択済みプランから、angleの順序とsourceIndex、120000Hzの配置・offset、明示された一つのaudio ownerを持つversion 2 / `placed-pair-decoded-samples` manifestを作る。二angle・各一clipの共通有効区間だけを受け付け、空白・複数clip・重ならない区間を一般対応として通さない。旧version 1は変更しない。この入口はhelper内で実行できるが、通常providerの能力交渉・Controllerへはまだ公開していない。revision 9やexport能力からgroup再生対応を推定しない。

Hostは実`STGroupPlayerSource`二系統を持ち、圧縮sampleから復号した画像を共有512MiB保持budgetへ計上する。実sampleの有効区間をoffsetでglobalへ写像し、二画像の共通区間にあるanchorだけを`GroupSurfaceSender`へ渡す。初回/明示seek/停止位置は要求anchorを両方が覆うまで未準備とする。継続再生の希望時計と取得画像anchorは別にし、同一画像位置の繰返しを進行としない。要求時刻を両画像が覆わない場合、共通時計と音声を最後の完全な提示pairで止め、固定した不足時刻を待つ。実画像の完全pair提示を確認するまで時計を再開しない。待機は5.5秒で失敗・両側停止・排出へ進み、decoder側の5秒期限と容量上限も維持する。これは滑らかな逆再生の達成値ではなく、止まった画像と進む時計を成功にしない有限の監視である。

同じseekでの再押下・倍率/音量変更は、制御所有と物理seekの世代を分けて引き継ぐ。初回targetへの再seekを毎操作で発行しない。新seekは古い完了を失効し、closeは既発行seek callbackとdecode workerの終了を待つ。解除はまず両側をpauseし、現在のnative発行履歴へ両delivery IDの停止proofを照合してから確定画像を取り直す。片側だけのACK、改変anchor、古いproofを成功にしない。共通hostへのscheduleが片側で拒否されたら両側をpauseする。音声はMain指定の一angleだけを選び、変更前に全側をmuteする。reverse中は一時的に無音とし、保存済みmute設定は書き換えない。

`test:native-group-player-host`はMainの実manifest関数、既存owned backend/FIFO、実ローカルhelper、音声用AVPlayer、実reader/decoder、N-API/IOSurface/Mach、再押下/停止proof、結果hash、子closeとpipe終了を通す。合成VFRの二要素とoffsetを使い、Drawnは試験側の模擬ACKである。Speaker・Canvas/GPU提示・一般素材・異なるカメラの同期・署名済み配布版の受入ではない。終了receiptの`stoppedClock`はnullとし、共通画像anchorを実測AVPlayer停止時計へ偽装しない。新しいcodec、原本加工、FFmpeg linkは追加しない。

### Display deadlines are not source-sample provenance

[Apple's API definition](https://developer.apple.com/documentation/avfoundation/avplayeritemvideooutput/copypixelbuffer%28foritemtime%3Aitemtimefordisplay%3A%29) and the SDK AVPlayerItemOutput.h define outItemTimeForDisplay as a display deadline, not an invariant original compressed-sample PTS. The heavy-source placed-pair run returned a deadline absent from its actual packet table; the strict metadata lookup rejected it. This is not a memory or Mach drainage failure. Do not hide it with a nearest-sample tolerance or relabel a held image.

SourceSampleIntervals contains real compressed-sample metadata. Equality of a candidate AVPlayer deadline with a sample start is a restrictive experimental gate, not general proof of pixel provenance. The Host mode is therefore explicitly placed-pair-deadline-experiment; it is not advertised as a production capability and normal provider/Controller activation remains disconnected. A timestamped pixel producer (for example a bounded reader/decoder cache), or a separately justified presentation contract, is still required. Earlier AVPlayer acquisition-time observations are not original-sample or physical-display evidence.

The synthetic fixture now has distinct content per sample, and receiver-side pixels are checked as well as timestamps. Repeating two unchanged sample starts at different anchors does not count as a new image. These tests still do not prove full real-media content, different-camera synchronization, speaker output or signed-distribution acceptance.

The subsequent read-only pixel comparison matched nine AVPlayer buffers to independently decoded active NV12 pixels. The paused baseline matched its source PTS; all eight negative-rate observations had a different display deadline (including deadlines equal to a _different_ real sample start). The movie-time attachment merely repeated the display deadline and was not independent source provenance. At that intermediate checkpoint the experimental placed-pair Host rejected negative playing controls as `unsupported-reverse-provenance`, pauses/drains, and the source adapter also refuses negative scheduling. The synthetic Host re-press test uses positive-rate controls and separately verifies the negative-rate rejection. Legacy v1 controls are unchanged. A timestamped reverse producer remains required; this guard is not a reverse performance improvement or completed product connection.

### 元sample時刻を保持する供給器への置換

上記deadline実験のmetadata indexは採用せず削除した。現在の限定Hostは`placed-pair-decoded-samples`であり、`DecodedFrameWindow`の実sample画像を使う。AVPlayerは音声のみとし、音声trackがある場合はvideo track/outputを無効化する。無音素材のAVPlayer時計を共通時計の実測として扱わない。現在は下記の限定Hostだけで共通時計と復号bankによる負rateを試験する。通常providerのreverse能力は実機受入まで有効化しない。この置換だけで通常Controllerや複数clip対応、逆再生速度改善を達成したとはしない。

読取専用の重いH.264素材対照では、独立した二供給器の各1秒窓へ0.5/2/4/6倍相当の逆向き時刻列を問い合わせ、88件の取得画像を既存の独立した連続復号の絶対PTS・duration・active NV12 SHA256へ照合し不一致0だった。これは時間を進めながら提示する試験ではない。最初の要求画像が両側で利用可能になるまで約2.46〜3.56秒、保持画像の最大観測量は約383MB、close/実worker終了後は0だった。source属性は不変。現在の0.5秒bank構成より長い1秒窓を用いた診断で、通常Controller・異カメラ同期・連続速度・実画面/音声・署名配布版の合格を示さない。供給遅延が残るため、通常のreverse能力を有効化する根拠にはしない。

### Avoiding unnecessary GOP preroll

A fixed half-second reader pad can cross the preceding full-sync boundary and make a small window decode an additional GOP. The reader now searches backward from the requested start using AVSampleCursor, for at most 512 decode-order steps and within the existing cancellation/deadline. Only a numeric full-sync sample at or before the request is an eligible anchor. Partial sync, unavailable metadata or an unsuccessful bounded search keeps the previous conservative fallback. Exact output/sample timing, packet/image limits, file-revision checks and physical drain remain unchanged; an unresponsive SDK call cannot be forcibly declared complete.

A same-input, same-position two-owner ABBA diagnostic at a half-second window reduced processed packets from 225 to 45 per owner. The first requested pair was available at about 2.38 s in both controls and 0.46–0.47 s in both candidates. All 88 selected images/intervals matched the independent continuous decode; retained image bytes were unchanged and drained to zero. Input was already read, OS cold cache was not controlled, and this is producer availability rather than screen presentation or sustained reverse performance. Gains depend on GOP position; a window that genuinely needs the older GOP cannot skip its dependencies.

The faster reader exposed a close/drain ownership race: a completed dispatch block could still retain an unadopted progress snapshot or cancelled worker image bank after reporting drained. Rejected snapshots and cancelled completed banks now explicitly release their own loans before the drain flag changes. This never releases an external consumer's shared image loan. The existing real source close/loan regression detected the failure and passes with the correction.

### Independent preparation with a joint ready barrier

A qualified source starts its bounded image window while the audio-only AVPlayer is loading or positioning. Image availability does not depend on audio seek completion, but the source must not expose a ready image until that actual completion succeeds. This removes serial preparation without weakening readiness, operation ownership or shutdown. A native regression gates AVPlayer readiness and withholds delivery of a real seek completion: decoded image loans must exist while readiness remains false; releasing the completion permits the pair, and closing first must wait for the completion and actual decoder drain. The ordinary Host still constructs its own audio session from Main's qualified URL; the internal constructor seam is for lifecycle tests, not a renderer capability.

### Bounded prefetch and presentation backpressure (experimental)

The decoded-sample Host now has a common host clock and two immutable half-second image banks per source. One bounded worker per source fills the adjacent bank while the preceding bank remains available; both banks and borrowed image leases share a 512 MiB retained-image budget. This is not a reservation or a bound on AVFoundation, decoder, OS or GPU memory. An explicit user pause prevents new prefetch; already issued reads must physically finish. A fixed-target buffering pause stops output while preserving its intended decode direction, so it can fill one adjacent bank before resuming. A fixed target outside the newest bank cannot advance prefetch indefinitely. New seeks, changed file revisions and close revoke old work and preserve the existing drain rules.

Negative rates -0.5/-2/-4/-6 use these exact timestamped images while AVPlayer audio is paused. Observed time is the last complete Drawn pair, not a requested clock or a single-angle acknowledgement. Missing coverage suspends the clock at that pair and holds one fixed target; only a new complete pair covering it can resume. New input revokes that pending target. Reverse-to-forward switching first repositions audio through a physical seek. The receipt still does not label the image anchor an AVPlayer stopped clock.

The actual Host regression now crosses the initial bank boundary at all four rates, verifies each source's decreasing PTS, release/re-press, current operation ownership, stop proof, real child/pipe close and zero retained/quarantined transfer bytes. Both Drawn acknowledgements are synthetic, not Canvas or speaker acceptance.

A read-only heavy-source two-owner diagnostic ran each rate for 2.5 seconds. With backpressure, each run closed successfully at its last acknowledged pair, but only about 0.75–0.79 source seconds were traversed and maximum pair gaps were about 0.31–1.13 seconds. Initial movement after an already prepared paused pair was about 64–92 ms. These are warmed producer/transfer observations with synthetic Drawn; they do not establish physical display latency or nominal sustained 2/4/6× performance. Repeated GOP preroll remains a measured bottleneck. Increasing clock speed while holding stale images is not an acceptable performance fix. Normal Controller/capability, package clip/gap transitions, real audio/display and signed-distribution acceptance remain incomplete.

### Ordinary Controller/session contract integration

The actual group Host is now exercised through the existing Renderer Controller class and Main session, rather than accepting raw diagnostic observations alone. This exposed a real contract mismatch: buffering previously reported ready frames or nonzero rate, which ordinary Main correctly rejects. The Host now pauses on coverage or complete-pair progress deficits and reports buffering with rate zero and no readiness for the pending target. The displayed time remains that of an actual complete pair.

A Main-only `drawn-pair` scope requires a complete-Drawn ledger verifier. It permits directional late pair acknowledgements during buffering only when that exact generation/operation/seek/time is confirmed; it does not relax the legacy fixed buffered source-clock contract. Close uses separately tagged `presentedStop`, checked against issued operations, direction, scope and the latest complete Drawn pair (including both exact delivery IDs and document) after actual child/pipe/native drainage. Delayed observation history cannot authorize an older recovery anchor. The legacy `stopped` field remains a measured source clock; modes cannot substitute one receipt for the other. Controller recovery consumes the qualified image anchor without naming it an AVPlayer clock.

The four-rate real-Host regression constructs those ordinary actors and checks paused HTML recovery ownership once. IPC, source qualification/signature, Canvas Drawn and original HTML restoration are adapters; normal UI/provider selection, actual two-canvas drawing and two-port recovery remain incomplete. This connection is not a signed product capability or a release acceptance claim.

### Release fence across the ordinary control writer

The document-local preload bridge captures the last submitted complete pair and synchronously freezes further pair paint when Controller receives release. The asynchronous command writer must not sample a later frame after an IPC wait. One selected writer and the latest unsent stop barrier are retained; a re-press cannot skip that stop. A newer explicit seek can supersede an unsent barrier. Preload keeps at most two pointer-free receipts and does not resume paint while a later frozen stop is pending. Already submitted Canvas work is not physically retractable.

The typed `presentationFence` is preload-owned, validated against Main's published/current pair ledger and translated to Host stop proof; legacy source-clock sessions reject it. Binding replacement, foreign owners, stale operations and caller-supplied receipts fail without granting source or handle access. Missing complete pairs fail closed instead of inventing a clock. The real Host regression now uses this bridge and the ordinary Controller's pause/preview/scrub operations. Source qualification/signature, IPC and Canvas acknowledgement remain test adapters; normal provider capability selection and real signed screen/audio acceptance are still required.

### Refill pause versus user stop

The Host's common-clock coverage barrier previously called the same source pause that clears prefetch direction. Buffering now pauses AVPlayer output separately while preserving the decode intent for the fixed pending target. Explicit user pause, new seek and close retain their existing revocation rules. A native source regression waits for actual image-worker drainage, then checks the synchronous request transition: refill starts one adjacent read, user pause starts none, and repeatedly polling the fixed target cannot start a second adjacent bank. Playback is still reported buffering with zero rate until complete-pair evidence permits resumption.

The shared image budget records its peak charged bytes in the internal final result. This includes image loans and uncertain charges, not decoder/OS/GPU allocations, and does not change the 512 MiB limit or worker count. Wider unaligned and GOP-aligned bank experiments increased worst pair gaps and were not adopted as smoothness improvements. The candidate's group Host retains half-second bank planning. Nominal high-rate performance remains a separate, unmet acceptance condition.

### Main manager and held-key contract

Main availability carries `clockAuthority: drawn-pair` only for a group with a qualified presentation/rate scope; omission retains the legacy source-clock contract. The ordinary Manager forwards the backend's Main-owned ledger verifiers to its session and rejects a group backend that omits them. Group reverse-key eligibility comes from that qualified rate scope after confirmed image readiness, rather than the audio-only AVPlayer's reverse capability. Legacy playback still requires its measured AVPlayer capability. The existing one-port gateway rejects group availability before taking the HTML lease; a two-port UI gateway and authenticated group resource/provider selection remain required.

A fenced stop is a bounded barrier in both the Controller and Main session writer. Re-press cannot overwrite it while an earlier backend write is pending; only the latest unsent fenced stop is retained, and an explicit newer seek may supersede it. In-flight writes are still awaited, never declared cancelled. The actual native regression now enters through Manager inspect/open, Controller gesture arming/start, guarded Main apply, complete-gesture stop/retire/normalization and Manager close. Qualification/signature, IPC, input permit/retirement, Canvas acknowledgement and original HTML restoration are adapters. This is not physical-key, screen, speaker or signed-distribution acceptance.

## Explicit group protocol negotiation

The verified playback helper has a separate `--group-playback-capabilities` query. It declares only the exact placed-pair decoded-sample protocol, two angles/one clip each, 120000 Hz image time, the existing 512 MiB charged-image budget and submitted-pair stop authority. Export revision 9, the export-budget response and receiver method presence do not establish this capability. It is not a throughput, source qualification, physical display or signature receipt.

`resolveSignedNativeGroupResources` keeps normal signature/resource/hash validation before the fixed query; there is no development-policy downgrade in this composition gate. Each query has its own cancellation, 2-second termination-request deadline and 4096-byte aggregate output bound. Timeout, malformed/unknown/extra fields, stderr, old-helper exit and cancellation fail closed, and completion still waits for the actual owned child close. An SDK/OS operation which does not exit cannot be called drained. The compatible single-source startup remains unchanged. This gate is preparation for the paired provider/UI, not activation of that unfinished route.

## Main group backend composition

`nativeGroupBackend.ts` composes the verified group protocol, authenticated placed-pair plan, existing owned FIFO child and group surface transport. It returns a closeable owner before source revalidation, filesystem, addon or process work. Each write revalidates the captured plan, updates pair admission and translates a stop only through Main's published ledger. The image clock remains distinct from a source clock.

Successful close requires native drain, physical child/pipe exit, surface/GPU loan drainage, hash-matching real result bytes, AVPlayerGroup success, no stopped-source clock, zero retained/quarantined bytes and a peak within the negotiated charged-image bound. It returns a separate complete-pair receipt. Uncertain factory ownership, invalid result or unconfirmed texture release retain their session; abnormal physical closure permits texture drainage but never becomes successful native drain. Activity-cleanup errors do not replace an original child/receipt failure. Ordinary same-UID filesystem trust remains the existing session-storage boundary; this is not immunity to hostile ancestor replacement. Normal source selection and two-port UI recovery remain unconnected.

The Main group backend also exposes a separate physical-termination promise. It checks generation, actual exit/pipe closure and launch status, and returns only those fields. A failed native receipt can coexist with a known exited child. That fact may support an isolated diagnostic app's normal process teardown, but never HTML recovery success, native/GPU-drain acceptance or deletion of retained session data. A timeout or uncertain factory cannot provide this proof.

## Drain pending presentation without an animation frame

Main sends one document/generation-scoped group drain notification when stopping demand. Preload discards pending complete or half pairs immediately, cancels RAF/demand callbacks and rejects later controls for that drained generation. A stale/foreign document or generation cannot close the current owner; a later valid owner remains usable. Last submitted stop metadata is retained independently of the discarded imports. This message is Main-to-preload only and carries no native handle, time target or successful-cleanup claim.

This covers a lifecycle gap when a hidden/occluded document cannot run its queued animation callback. Returning imports still requires real transfer/acknowledgement/GPU release milestones in Main. Sending the notification does not authorize producer drain or release uncertain ownership; the existing deadlines and physical-close checks remain unchanged. It is not by itself a diagnosis of the earlier black-screen trial or proof of sustained cadence.

## Typed Main admission for selected angles

The fixed `native-playback:inspect-group` endpoint accepts exactly two distinct package angle IDs and one of those IDs as audio owner. It accepts no source path, executable, timestamp, settings or capability receipt from Renderer. Sender/main-frame and Package Session authentication run before payload parsing. Main resolves the current package plan, verifies signed resources and the explicit bounded group capability, then serially checks the two existing strict source profiles. It revalidates package/source grants across asynchronous boundaries and again before backend creation/writes.

The first Host still admits only one local clip per selected angle with a nonempty common overlap. Multi-clip/gap or incompatible profiles retain original playback; this endpoint does not turn those cases into a single source. Validated resource/capability values are captured for the factory rather than sharing a mutable runtime object; this does not pin filesystem content against arbitrary same-UID replacement. Returned bindings identify angle/clip and current file URL separately, even when both angles use the same URL. Placement and source endpoints use the Host's canonical 120000-tick grid. The qualified presentation is their common range, capped by both source/video/audio endpoints; audio belongs to the explicitly selected angle. Main's opaque group URL is session identity, not a new readable file grant.

Changing selection revokes only idle qualification. Pending lookup, opening, active, closing or held ownership rejects replacement; it does not close another session or pretend HTML recovery finished. A drained owner may be requalified under the same existing manager rules. Ordinary single-source inspect stays separate. Nonpackaged unsigned preview runtimes do not acquire production group authority through this endpoint.

This connects packaged startup, typed preload IPC, authenticated Main selection, signed capability, plan/profile qualification and the existing group backend. The ordinary two-canvas UI, both original-player recovery ports and common-clock eligibility mapping are still separate unfinished work. In particular, a group stop outside the current common clip range must not restore two stale source URLs or clamp a legitimate package seek to the overlap. Do not enable the paired UI by only removing its exclusion. Qualification unit/IPC tests mock filesystem/media probes/signatures/Electron as stated; they are not signed distribution or actual two-camera/audio acceptance.

### Ordinary paired surface and verified return (restricted candidate)

The normal PlayerSurface now offers pair admission only for exactly two local, single-clip angles that cover the same complete package interval from zero. Existing mediaTimeline offsets and Main's canonical 120000-tick placements must agree. Unknown duration, different ends, clip/gap timelines, live capture, manual sync, unsupported profiles or absent signed group capability retain HTML playback. This restriction is not general multi-clip/angle acceptance.

Each Video.js registration carries its actual player slot ID. A pair boundary registers two independent canvases (including when both URLs are equal) through one group preload binding; it never attaches a legacy one-source binding beside them. Only a matching generation's complete-pair callback reveals both canvases. The Renderer sends package angle IDs and one audio owner to inspectGroup, validates Main's returned clip/source/offset bindings, then invokes the ordinary Controller through a separate two-port gateway. Two audible original players or unknown audio selections do not get silently reassigned.

A group registry binding validates the common package clock against the current timeline. Native observations already use global package time; offsets are applied only to the original source players on recovery. Main's native/transfer drainage must finish before either original is restored. Both captured source ports must independently confirm paused, seek-complete, ready images at their mapped positions before the shared lease is released. A peer error, timeout, owner/source replacement, non-finite clock or cancellation aborts this recovery attempt's listeners/new mutations and retains ownership. Browser seeks already issued cannot be physically cancelled. An exact qualified package endpoint may map to the canonical native endpoint; arbitrary seeks outside the original clip are never clamped.

jsdom integration covers real boundary/surface/panel/gateway/Controller/package-clock modules with mocked IPC, canvas Drawn notification, native drain and HTML media ports. It is not real decoder, physical display/audio or signed distribution acceptance. Sustained high-rate cadence, distinct-camera synchronization, general clip/gap recovery and signed paired UI acceptance remain open; the prior experimental results do not establish those requirements.

A complete Drawn pair at the exact initial target may precede the initial audio-ready paused observation. In drawn-pair mode only, a separately ledger-confirmed buffering observation for that issued seek may establish its image baseline. It neither marks audio/video ready nor changes lastConfirmedTime; both still require an actual ready observation. A missing/foreign pair, an off-target first image or a source-clock buffering observation cannot establish this anchor. This handles an initial reverse command while audio is still preparing without pretending delivery is readiness.
