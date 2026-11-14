# Native clip export

macOS arm64の署名済み配布では、対応する合成なし区間を`AVMutableComposition`と`AVAssetExportSession`のpassthroughで書き出します。UI・保存形式・新しい設定は追加しません。映像の再生方式とは独立した書き出し処理です。公開版ごとの有効範囲はRelease記録を参照してください。

動画書き出しの最終ファイルは保存先と同じボリュームの専用一時ディレクトリで完成させ、成功後に既存ファイルを置換せず確定します。途中で失敗した場合は処理自身の一時出力を削除し、個別出力で既に完了したファイルは保持します。ハードリンク非対応の保存先では、対応する macOS arm64 署名済みhostが利用可能かつファイルシステムが排他的renameを提供する場合に限り、その方法で確定します。それ以外はエラーにします。確定結果を確認できなかった場合は再試行や出力削除を行わず、一時物を保持して結果不明を報告します。

結果不明時の進捗画面には保全した一時ディレクトリの場所を表示します。この情報は確認のためのもので、自動削除の許可や書き込みプロセスの終了証明ではありません。表示情報は実行中のセッションに限られ、アプリ再起動後の自動回収は行いません。

進捗ウィンドウの「書き出しを中止」から対象処理を中止できます。中止処理中は停止と一時ファイルの後始末を待ち、完了済みのファイルは残します。保存確定の処理中は中止を受け付けず、未処理の出力がある場合は操作し直せます。通常のアプリ終了でもネイティブ処理と書き出しが起動した FFmpeg に停止を伝え、各ジョブの後始末を待って終了します。素材確認など中止に対応しない処理は終了待ちの対象です。

Windows のエンコーダー検査は同時ジョブで共有します。一方のジョブが中止されても他方の検査は継続し、最後の利用ジョブが中止したときは検査子の終了を待ちます。

再圧縮が必要な動画書き出しとPlaylist埋め込み保存では、macOSのVideoToolboxにハードウェアとソフトウェアの両方を許可します。選択はOSが行い、ソフトウェアではCPU負荷や所要時間が増える場合があります。どちらも利用できない場合はエラーとして扱い、失敗した出力を成功扱いしません。録画のリアルタイム設定は変更しません。[ADR 0083](adr/0083-macos-offline-encoder-fallback.md)。

## 選択と精度

対象はH.264映像1本と選択したAAC音声を持つローカル通常ファイルで、単一の最終クリップまたはインスタンス別出力です。元の圧縮品質とビットレートを保持するため、従来の再圧縮よりファイルが大きくなることがあります。

実際に描画される文字、Paint、motion、freeze、chroma、複数角度の合成、同期の空白を合成したprepared source、複数クリップの連結は既存経路を使います。文字表示が有効でも、選択された項目に表示内容がなければ、文字を描画しない場合に限り高速経路を試行します。URL、symlink、非対応codec・音声なし、非対応architecture、署名資源の検査失敗も既存経路へ戻ります。同時native処理はMain全体で1件です。別の要求を無制限に先読み・待ち行列へ蓄積しません。

要求された原本時刻の範囲をcompositionとsession.timeRangeへ渡し、キーフレームに範囲を広げません。preferredTransformを保持し、passthroughで無視されるvideoComposition/audioMixは使用しません。MP4との互換性をassetに対して検査します。境界だけを再圧縮する方式ではありません。

音声indexは選択したsource基準で既存経路と共通です。準備合成で選択を保持できない場合は従来どおり拒否し、別trackへ置き換えません。Timelineからは確認済みの音声選択を渡し、未確定・angle間の競合は止めます。package/playlistの永続形式は変更しません。

## 所有権と公開

Mainは固定された署名済み`NativeProductHost`を検証し、独立した`--export-clip`モードで起動します。再生sessionや画像queueは起動しません。既存の0600 FIFOを再利用し、NodeのsocketpairをFIFOと取り違えません。新しいbinary・資格情報・OS権限は不要です。

原本revision、helper終了、独立metadata検査、非上書き公開を順に確認します。映像と選択音声それぞれのcodec設定・提示区間、寸法・向き等を比較します。AACの圧縮packet末尾やB-frameの隠れたprerollを、そのまま余分な提示時間とみなしません。開発時は限定区間の画像・PCMを比較しますが、利用時に全原本・全frame/hash走査は行いません。

候補は専用一時領域に作成し、上限は原本サイズ+16MiBと8GiBの小さい方、helper期限110秒、親期限120秒、応答64KiBです。metadata probeは1件ずつ30秒・1MiBまでです。期限や取消では所有する子の終了を待ち、正常Quitもこの処理のdrainを待ちます。候補欠如・不適合・metadata検査失敗では原本不変を再確認して既存encoderへ戻します。原本変更・取消・出力衝突はfallbackしません。

出力先と同じfilesystemの専用stagingへ完全にコピーしてから、exclusive linkで最終名へ公開します。取消中の部分出力を最終名で見せず、既存ファイルを上書きしません。hardlink非対応filesystemでは候補を公開せず既存経路へ戻ります。cleanup対象は自身のstagingだけです。

## 検証入口と限界

```sh
pnpm run native:build
pnpm exec vitest run electron/src/nativeExport electron/src/ipc/exportPreparedClipRenderer.test.ts electron/src/ipc/exportSourcePreparation.test.ts
pnpm run test:native-runtime
```

対応入力の先頭・中間・末尾、任意時刻の境界、選択音声、合成除外、未対応入力、原本変更、取消、出力衝突を検査します。配布時は既存source manifest・署名・公証・packaged export E2Eを確認します。音声サンプル比較と実聴取は別の証拠です。全形式・全playerでのedit list互換性、複数区間を無再圧縮連結すること、全長の安定性を保証しません。非対応条件では機能を落とさず従来の正確な出力を維持します。

旧開発用Swift helperは製品の同一署名hostへ統合し撤去しました。追加コードは本プロジェクトのMIT sourceで、Apple frameworkはOS提供です。新しい第三者binaryは同梱しません。[由来の確認台帳](provenance-review.md)と[再生の検証範囲](native-playback.md)も参照してください。

## 公式資料

- [AVAssetExportSession](https://developer.apple.com/documentation/avfoundation/avassetexportsession)
- [Appleのexport APIガイド](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/AVFoundationPG/Articles/05_Export.html)
- [QA1744: preferredTransformとpassthrough](https://developer.apple.com/library/archive/qa/qa1744/_index.html)

SDKの`AVAssetExportSession.h`にもcontainer制約、audioMix/videoComposition無視が明記されています。QuickTime PlayerやSportscodeの非公開内部を同じ実装とは断定しません。
