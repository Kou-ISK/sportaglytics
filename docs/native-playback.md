# Native再生の統合境界と受入条件

## 現在の状態

対応するmacOS arm64の単一local映像は、Mainの資格・署名検証と停止画像の準備が揃うとネイティブ再生を自動使用します。起動環境変数や利用者による方式選択は不要です。すでにHTML再生中なら中断せず、次の一時停止で接続します。対応外の形式・速度・時刻・環境は内部で互換再生へ渡し、全速度・音声・コマ送り・保存・出力を維持します。機能を削って資格を広げません。新defaultの実配布・公証・品質確認は別の受入であり、この変更を公開済みとは扱いません。 通常配布は固定Resourcesのhelperを検証し、署名情報欠落・不一致では互換再生を使います。Rendererからpathやhelperを指定できません。短い消音再生やunit成功を長尺品質・可聴同期の証拠にしません。

[ADR 0078](adr/0078-native-playback-authority.md)が所有権と検査分離の判断を記録しています。[再生用コピー](playback-cache.md)の全内容proof契約は別方式として維持します。原本・Package metadata・保存位置・タグ・出力のsource identityを派生再生sourceで置換しません。

## 操作と所有権

停止を要求したnative seekが未完了の間に、pointer releaseなどが完全に同じ位置を再要求した場合、Renderer controllerは既存要求を維持します。seek ID・IPC・期限を更新して復号をやり直しません。異なる最新位置は従来どおり優先し、完了済みのseek、再生要求中、原本復帰中はこの省略の対象外です。要求をまとめても、画像・音声ACK前に時計やtag/save時刻を確定しません。

`src/renderer.d.ts`が公開APIの正本です。`src/types/ipc/nativePlayback.ts`はpayloadと応答を検証します。Mainは生存Window、trusted entry documentのmain frame、Package Session所有元を確認します。Rendererは実行ファイル・任意path・検証済みproofを選べません。

Mainがqualificationした単一local source、timelineStart=0、auto同期、liveなしの範囲だけをRendererの候補にします。HTML/range/nativeの所有権は排他的です。HTMLの遅いplay完了もnative所有中は停止します。共通時計はnativeの観測時刻を受け取り、±シークもこの時計を起点にします。原本HTML要素の古いcurrentTimeを読み戻しません。

時計は初回snapshot取得後、Mainからの専用通知で更新します。Rendererの周期pollや背景timer設定への依存を避け、配送中1件・最新保留1件に制限します。非同期write失敗も通知し、UI購読者や購読解除の例外がnativeの停止・終了確認を妨げないようにします。preloadの文書単位の受信器はownerと配送番号を検証して受領を返し、Controller解除後の古い通知も回収します。

各操作はgeneration/sourceKey/sequence/seekIdを持ちます。seekは停止した原本時刻と画像・音声の準備を確認してから再生可能になります。送信完了だけでは準備済みになりません。再生・停止ACKは実時計のtime/rateを同時に読み取って判定し、停止要求値を観測値として返しません。開始中に時計が確認済みの停止位置より前なら、値を補正せず期限内の実測を待ちます。同一seek内の確認済み時刻の逆行はMainでも拒否し、明示的な新seekの逆方向移動と区別します。要求は配送中1件と最新の保留1件へ集約します。遅い旧応答、未来の応答、不正な時計状態は採用しません。

私有診断では、開始時に実測した停止中の原本時刻と現在のhost時刻を同時に指定します。音声由来の時計を維持し、未来のhost時刻や公開時刻の補正は使いません。source時刻だけの指定との比較、時計setterの連番、補正前の実測を保存します。この条件での逆行解消は、実音声同期や全速度での品質確認とは分けて扱います。

障害・所有元変更・期限切れでは停止し、最後に確認した時計を保持します。原本へ戻すときはnativeの終了を先に確認し、停止した原本のsource・画像・音声設定を復元してから所有権を解放します。未知の終了を再起動やtimeoutで成功扱いにしません。Mainの再openは終了確認後の新generation・再qualificationを必要とします。

適格外の連続シークで原本へ復帰する間は、進行中の停止画像1件を完成させ、次に最新要求1件へ進みます。位置変更だけでは復元を取り消しません。source・画像・設定の確認が済んだ中間画像でnative canvasを隠し、共通時計もその確認済み時刻へ更新します。最新要求時刻とは分離し、最後の位置と設定が確定するまでHTML再生の所有権を解放しません。設定変更、文書変更、取消、実エラーは従来どおり中断条件です。復帰全体の20秒期限は維持するため、長時間の連続ドラッグを無制限に処理できる保証ではありません。

タイムライン別窓の矢印キーは相対秒を専用コマンドで所有元へ送り、所有元の未確定native要求を基準に加算します。別窓への遅い時計通知は加算基準にしません。通常のpackage再生のツールバーも、clip内HTML時刻ではなく共通package時計を使います。要求を蓄積しても、nativeの確認済み時計やtag/save/export時刻を先行させません。Home/Endとドラッグは絶対位置のままです。手動同期の相対入力は選択アングルのtransportへ渡し、同期更新した受理済み時刻を使います。処理中の拒否や選択アングル終端の補正を保留加算で上書きしません。

## 既存画面への限定接続

`PlayerSurface` と `SingleVideoPlayer` に自動選択の状態・音声操作と表示面を合成します。Viewはpropsのみ、qualification・player登録・preload接続はHook/Controllerの責務です。native canvasは既存の映像・操作・全画面コンテナ内に置き、backing寸法とCSS寸法を区別します。復旧失敗時だけ「再生を復旧」を表示し、利用者に方式の選択を求めません。

Mainが表示寸法、速度集合、音声本数、音量/mute、正確なseek grid、seek可能末尾と再生終了前の引継ぎ位置を資格として渡す。対象外の操作は削除・丸めず、native終了後に原本へ渡す。復帰中の最新シーク・速度・音声・一時停止を保持し、旧復元の取消を新しい要求の失敗と扱わない。原本のsourceとmetadataが有効ならデコーダーを再loadしない。設定だけの置換では、安定したplayer identityと同一の要求時刻を確認して既発行seekを再利用し、実際のseekedまで待つ。

nativeの終了応答は実rate=0で測定したsource時刻と処理済みsequence/seekIdを含む。Mainは有界な未確認命令を保持し、送信済みでも未処理の新命令と区別する。明示シーク以外の復帰にはこの停止時刻を使い、最後の通知時刻へ巻き戻さない。停止時計・終了が不明なら所有権を解放しない。供給不足は診断の観測継続と製品復帰を分け、確認済みのmedia失敗だけを同じ原本復帰処理へ送る。protocol/cleanup不明は停止状態を維持する。

原本復帰では、停止画像の確認後にcontrollerの停止時刻と共通React状態を同期commitし、その間もHTML所有権を保持する。通常再生用の内部時計もnative所有中の確定時刻で更新する。commit中のunmountや新操作は取消・revisionで再検証し、同じ有効な試行だけを解放する。これにより旧React時刻や旧rAF時計からの巻戻しseekを防ぐ。

限定窓の自然終端はbackend自身が時計を停止して観測を返す。Rendererの通知間隔から停止を予測しない。停止観測後に最新の再生意思を原本へ引き継ぎ、ユーザーが一時停止した場合は再開しない。

限定実画面では長尺原本の直接open、native画像、速度変更による原本復帰、複数音声選択を確認している。ただし供給不足が残り、可聴同期・長時間品質の合格ではない。タグ/save/export時刻は共通時計と保存範囲を使用する。Playlistの描画/captureは別playerに属し、その既存経路を維持する。native表示上の描画/captureとの完全な互換性は未検証である。選択音声はsource単位の確認済み状態としてTimelineへ送り、最終angle/source確定後にexport payloadへ適用する。合成3音声素材の実画面書き出しで選択音声と区間長を検査しているが、原本の可聴同期やnative表示上の描画合成を保証しない。

## 既存機能のinventory

| 既存の操作                          | 維持する契約                             | native有効化までに必要な検証              |
| ----------------------------------- | ---------------------------------------- | ----------------------------------------- |
| 再生・停止、±10/30秒、Timeline seek | 原本時刻、最新操作、停止画像             | 実表示・BrowserWindow IPC・停止からの復帰 |
| コマ送り、逆再生ホットキー          | 元映像のframe時刻、キー解除で停止        | field/VFR、逆方向連続操作、境界           |
| 速度0.25/0.5/0.75/1/1.25/1.5/2/4/6  | 全presetを保持                           | 各速度の音声時計・表示・underflow         |
| 音声track選択、音量、mute           | 全trackと選択状態、切替後の同期          | 複数音声の聴取と停止/再生中切替           |
| scrub中の画像                       | 入力に対応する最新画像、古い応答の不採用 | 物理入力、視認性、最終画像までの遅延      |
| Coding/tag、保存・再開、export      | 共通時計と原本参照、既存形式             | 実タグ保存・再読込・出力時刻と画素        |
| 多アングル・複数clip・同期offset    | 各原本時刻、空白・clip境界               | 現候補の対象外。既存経路を維持            |
| YouTube、live capture、MSE/range    | 既存の再生・録画継続                     | 現候補の対象外。既存経路を維持            |
| Playlist/Paint/解析用frame capture  | 原本参照と既存画像取得                   | native表示への切替で取得機能を失わない    |
| 文書変更、reload、Close/Quit取消    | 旧世代失効、終了待ち、新世代再確認       | 実Window lifecycleと未確定cleanup         |

表の未検証機能を隠す・削除することは有効化の代替になりません。診断のrate=1・mutedという範囲は製品の機能上限ではありません。

## 通常利用と開発診断

通常再生は、対応素材をdirect経路で扱い、問題素材だけに理由を持つfallbackを検討します。毎回の全尺変換・全frame/hash・全PCM走査を通常open/playの前提にしません。必要範囲の復号、有界queue、索引と変更検知、音声に対応した時計、供給不足と実エラーの監視を組み合わせます。stat一致だけで全内容一致を証明したとは記録しません。

必要範囲の音声供給は、原本sample位置で連続する窓を使い、保持する窓数と同時読取数を制限します。先読み結果はseek世代に結び付け、古い読取が終了するまで次の読取を開始しません。前方の窓切替では同じ音声rendererへ連続したPTSを供給し、時計を再設定しません。開発時の連続PCM参照との照合を、通常利用の毎回全尺検査に置き換えません。

映像のdropは再生区間・renderer世代ごとに停止中の前後metricsを保存し、source field数、画面の更新能力、display callback、投入遅延、音声・映像の供給範囲と比較します。SDKの集約drop数だけで表示周期による選択と処理遅延を断定的に分離せず、物理表示の検証も別途必要とします。

私有の短尺hostは実デコード・native表示を製品controllerから操作する診断です。in-processのIPC transportは実BrowserWindowの試験ではなく、muted再生は音声聴取の試験ではありません。全field/hash証明やPCM比較の費用は開発検証として分けて報告します。通常製品providerに診断処理をそのまま追加しません。

[Hudlの2019年公式記事](https://www.hudl.com/blog/hudl-sportscode-countdown-improved-performance)はAppleの映像framework、scrub・frame step改善、多くの素材で変換不要という方向を説明しています。歴史的な参考であり、現行の内部queue/hash/全尺検査や今回素材への適合を示すものではありません。

## 検証の入口と未達条件

末尾への復帰では、Mainで適格判定した同じsourceの厳密な終端を要求した場合だけ、既存の停止画像確認精度（2ミリ秒）以内のHTML終端差をadapterで吸収します。それ以外の範囲外要求は従来の1マイクロ秒の丸め限界を維持し、任意の時刻を末尾へ丸めません。共通時計・タグ・保存時刻は変更せず、停止・seek完了・画像readyの確認を維持します。最終clipの厳密な末尾では表示用のplayerを保持し、復帰commitによるsurfaceの自己破棄を避けます。中間gapと書き出し区間の終端除外は維持します。

画面統合の私有診断では、原本から復号した画像を Electron の共有テクスチャで sandbox preload へ渡し、既存描画と同じ DOM コンテナの canvas に表示します。`playlist` の公開入口から既存の `scaleObjectForDisplay` / `renderObject` を再利用し、`videoPlayer` の公開入口から同じ `NativePlaybackController` を操作します。別 native window の表示結果だけを既存 UI との互換性証明にしません。

共有テクスチャの転送完了・canvas 描画完了・GPU 参照解放は別の通知です。シークの画像 ready は現在の owner / seek に属する描画通知で判定し、pixel buffer の再利用は GPU 参照解放まで待ちます。転送 timeout の遅着は解放済みと推測せず、保持と終了未確認を記録します。注釈は描画した画像の原本 PTS に合わせ、シーク待機中の旧画像へ新しい目標時刻の注釈を重ねません。

この経路は実験段階です。配布可能な native transport、画面更新に応じた供給、障害時の回収、全画面での連続再生と実操作の確認が必要です。単一の矩形と停止画像の全画面検査では、全描画ツール・chroma・motion・multiangle・書き出し合成の互換性を保証しません。通常利用へ診断用の hash 計算や共有メモリ受信の周期 poll を持ち込みません。

Mainの`nativePlaybackSession` / `nativePlaybackManager` / `nativePlaybackHandlers`、Rendererの`nativePlaybackController` / `nativePlaybackGateway`、`nativePackageClock.integration.test.tsx`を使用します。toolbar、既存HTML再生、source切替とrange所有権の回帰も対象です。sender・payload負例、保留配送、遅いACK、停止画像復元、cleanup不明、再openを分離して検査します。

通常有効化には、上表の機能維持と実BrowserWindow IPC、連続再生、実音声同期、物理scrub、長尺全体の停止/seek/再開、供給速度・buffer量、原本fallbackの実測が必要です。package履歴のdirectory I/O遅延はdecoderとは別に確認します。品質ゲート・Storybook・専用短尺診断だけではreleaseしません。実データ・私有host・結果は公開せず、公開再現には合成素材を用います。

## 任意位置への開発統合

`nativeSourceAccess`は現在のMain Package Sessionに属する単一local clipをmetadataから解決し、原本・設定の変更を検知します。相対参照のpackage外逸脱、symlink、複数clip、timeline offset、録画・更新中は対象外です。既存の絶対local参照は保持します。起動資格は1MiB以下の設定と有界header probeから作り、全媒体のframe/hash走査や変換は行いません。

`nativeSourceProfile`は確認対象の映像・全3音声の形式、原本時刻0、field周期、音声sample終端から不変のgeometryを生成します。現在は1080p H.264、60000/1001入力、BT.709、3つの48kHz stereo AACという限定profileです。headerだけを全尺適合の証明とせず、復号時も各fieldの形式・時刻とPCMのtrim・連続性を確認します。原本末尾は音声/映像の短い方にreserveを設けて既存再生へ引き継ぎます。末尾や非field境界への要求を丸めて精度を落としません。

開発runtimeは要求された原本時計を保持し、その時刻を含むfieldから読み始め、音声を最大2.5秒×2窓・reader1個で供給します。最後の窓はsource終端までに短縮し、seek/closeで旧readを取消します。映像は32個の論理creditで未消費画像を制限し、停止中の待機をIO timeoutに数えません。open/seek/read期限、取消、通信メッセージと同時所有数の上限は維持します。過去の計測履歴を循環保存するため、時間経過による履歴上限を再生停止理由にしません。

bwdifのslice workerは2個に固定し、decoder worker4個、同時session数、32fieldの保持上限は維持します。fieldの省略や時刻変更は行いません。候補比較では全fieldの画素・PTS・形式とprocess全体のCPU/RSSを照合します。単体のfilter処理時間短縮を、統合再生の間欠停止解消と同一視しません。

原本時計と表示fieldは別々に扱います。field境界の有理数時刻を優先し、それ以外はナノ秒または有界な有理数探索で元のdoubleへ厳密に往復する時計を受理します。表示はその時刻を含むfieldを使い、初回画像ACKはそのfieldと同じseek世代に結び付けます。未来fieldを許す丸め誤差補正は使いません。正確に表現できない時刻、reserveが不足する末尾は原本へ戻し、要求値を黙って丸めません。PCMの最初の窓は表示fieldを含む範囲を取り、再生reserveは要求時計から確認します。

配布helperの署名照合と自動選択は実装対象ですが、実配布の資格、過去の間欠停止と可聴同期は未完了です。限定profileやrate=1を全入力の製品上限にせず、それ以外は内部の互換経路へ引き継ぎます。

開発候補では、復号済みfieldの参照保持と表示用NV12画像の準備を分ける比較も行います。全fieldの時刻・形式検証を維持し、画像化は実際の表示要求で選ばれたfieldに限定します。旧世代を含む転送中の所有数を画像化前に確認し、buffer不足でowner・ACK・終了処理を待たせません。復号済みcoverage、画像準備、draw ACK、GPU releaseは異なる証拠です。画像準備数の削減だけで実表示の安定性・総メモリ削減・可聴同期を合格にしません。

## 限定ローカル試用の扱い

固定Main runtimeの有音出力資格はRendererや保存設定から広げません。通常runtimeは全3音声を保持し、音声切替など現在backendの適格外操作は互換再生へ渡します。未指定の開発runtimeは消音限定です。無音の自動検証を実聴取同期の合格とは扱いません。

自動開始は現在のplayer登録identity、source、表示面、停止、画像ready、速度・音声・音量・時刻を照合します。同じ登録では1回だけ試み、終了・障害・非対応操作後に自動再起動し続けません。再openで改めて資格を取得します。同じURLでもplayer登録が変われば前の資格は使いません。設定/seekイベントのたびにheader probeを繰り返しません。既存の再生用コピー要求はnative終了と原本復帰を確認してから同じ文書へ引き継ぎます。

ローカル試用も、初期化の前にclose可能な所有者を返す必要があります。filesystemやaddonの欠損でhelperを起動していない場合は、その事実を確認して原本へ戻します。factoryが処理を始めた後の所有権不明やGPU解放不明は、未起動と推測せず失敗を維持します。試用は専用profileと架空projectを用い、インストール済みアプリや実projectを置換しません。

共通ツールバーの相対skipは、nativeのseek完了待ちでは最新の要求位置へ差分を累積します。連続する`+10秒`を同じ確認済み位置へ合流させず、原本プレイヤーの`currentTime`指定と同じ操作結果を保持します。確認済みの再生時計と操作の基準位置は分離し、タグ・保存の確認済み時刻を要求だけで進めません。絶対pointer seekは最新要求を優先し、表現不能時刻の原本復帰と有界queueは維持します。

任意位置の時刻資格は、既存field有理数・ナノ秒表現を優先し、それ以外は64回以内の連分数探索で分母10億以下・safe integer分子の候補を調べます。元のdoubleへ厳密に往復する場合だけ使用し、許容誤差やfieldへの丸めで資格を広げません。これはbinary有理数との数学的な完全一致ではありません。Main/Rendererとnativeは同じ探索上限・採否条件を持ち、field選択・音声範囲は整数有理数で判定します。表現できない時刻は引き続き原本へ復帰します。

### Bounded Renderer failure reporting

The optional local diagnostic sink also accepts Renderer restoration failure after Native closes normally. A dedicated numeric IPC authenticates the Main frame, document and source-owner generation, accepts the first report only, and rejects stale owners after qualification or navigation. Stage, fixed reason code, command/seek numbers and requested/confirmed source times are numeric evidence. A duration-guard failure may additionally retain the failed snapshot time, the exact duration read by that guard, its finite/nonfinite category, readyState and seeking flag. Values are bounded and nonfinite numbers use fixed numeric categories; this does not add buffers or enlarge the existing fixed ring/files. Unknown reasons map to zero; free-form errors, paths, owner tokens and media are not persisted. Diagnostic failure or persistence completion never changes playback drainage or restoration ownership.

The private recorder normally uses two rows in its existing fixed ring; an optional duration context adds one row. Its memory and exclusive four-file limits remain unchanged. A Main-only record is incomplete for Native evidence. Diagnostics do not prove a playback speed or intermittent starvation fix.

## 配布helperのソース構築

必要source/headerは`native/macos/playback/source-files.json`に明示し、[告知](../native/macos/playback/NOTICE.md)と[対応source/relink手順](third-party-distribution.md#native-playback-previewの対応ソース)を添付します。`pnpm run native:build`はmacOS arm64の固定sourceを生成し、`native:sources`は未署名buildの対応sourceを保存します。通常macOS packageのarm64だけへ正確な8資源を追加します。Intel/Windowsは既存互換経路を維持します。

### 署名済み配布とローカル検証

通常packageはhelper/receiverを先に既存Developer IDで署名し、元のunsigned identity/filesを保持したmanifestへ固定2fileの署名後hash・identifier・teamを追加します。builderが最後にアプリ本体を署名した後、appのApple Developer ID要件・固定identifierを検証し、そのteamと2helperのteamを照合します。manifestのteamだけを信頼根にせず、署名情報の欠落をunsignedへ降格させません。最終payload検査ではソース・NOTICE・unsigned manifest・署名後hashを再照合します。既存の未署名試用成果物は保全しますが、新defaultの完成配布には使用しません。復旧は保存済み原本/projectを保持した旧リリースへのrollbackとし、公開済みartifactを上書きしません。

Mainは初期化前にclose可能な所有者を返し、helper終了後のreceiptと停止時計・SHAを確認します。通常動作では詳細event履歴と周期progress JSONを保存せず、既存の数値のみ256KiB ringと追加メモリ最大1MiB、失敗記録最大2MiB×4件を使用します。試用launcherで`--user-data-dir`を専用directoryへ指定し、保存先がそのuserDataの`native-preview/recurrences`であることを確認します。限定package自身は通常appIdを引き継ぐため、指定なしではprofileは分離されません。recurrencesへ映像・音声・媒体pathを保存/外部送信しません。別途必要なIPC/最終receiptと媒体pathを含むmanifestは`native-preview/sessions/session-1..4`へ排他的に作成し、確認済み終了時に今回作成分のみ削除します。既存slotやユーザーファイルを上書き・削除しません。全slot使用済みでは原本へ戻ります。
