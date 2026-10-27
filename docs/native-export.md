# Native clip export candidate

macOSの単一角度・合成なし区間に対し、`AVMutableComposition`と`AVAssetExportSession`のpassthroughを検証する非公開経路です。通常の`registerExportHandlers`にはproviderを渡さず、helperも配布しません。既存のFFmpeg／VideoToolbox出力を維持します。

## 選択と所有権

`createPreparedClipRenderer`は実際のsourceと`timeOrigin`を確定してからMain専用`NativeClipExporter`へ渡します。対象は文字、静止画、motion、freeze、chroma、複数角度合成を伴わない最終出力です。複数クリップの結合は既存経路へ戻します。nativeのpreroll/edit listを既存concatへ混ぜる品質はまだ確認していません。同期区間のgapやサイズ正規化は既存の準備処理が担当します。

helperはH.264/AAC、元映像のframe境界、要求範囲、選択音声、MP4互換性を確認します。`compatibleFileTypes`を使い、presetだけを検査する`supportedFileTypes`で適合と判断しません。trackのpreferredTransformを保持し、videoComposition/audioMixをpassthroughへ渡しません。後者はApple仕様上無視されます。境界だけの再圧縮は実装・検証していません。

adapterは専用一時ディレクトリと子プロセスを所有します。期限や出力上限で停止要求を出した後も`close`まで待ちます。helper失敗でもsource revisionが変わっていればfatalとし、変更後の原本へ黙ってfallbackしません。receiptと候補出力を独立qualificationへ渡し、合格した場合だけ`COPYFILE_EXCL`で公開します。出力先の衝突、原本変更、公開時エラーをfallbackへ変換しません。Main専用qualificationは必須で、通常利用に全source/frame/hash走査を追加しません。

## 音声と正確さ

`ClipExportItem.audioTrackIndex`は選択した角度のsourceに対する音声indexです。指定時はnativeとFFmpegの両経路へ伝えます。省略時の既存encoderの先頭音声規則は維持します。同期区間を合成すると音声0の1trackへ変わるため、その準備が必要な要求で0以外を指定した場合は処理前にエラーにします。別trackを先頭へ置き換えて成功扱いしません。タイムライン書き出しでは再生画面の確認済み音声選択を、文書内のsourceと結び付けて既存のTimeline同期へ渡します。nativeの要求値ではなく、現在世代の画像・音声準備が完了した観測を使います。切替中・複数選択・同一sourceのangle間競合は未確定として書き出しを止めます。原本へ戻った後はHTMLの実音声選択を読み直します。最終angle/sourceを決めてから適用し、別素材やplaylist内の別packageへ番号を流用しません。明示されたclip音声設定を優先します。playlistへの選択保存は今回追加しません。

明示音声0でも、従来のmetadata検査で音声が1本と確認できた全区間出力はstream-copyを維持します。複数音声、部分AAC区間、B-frame境界などの既存制約は維持します。音声のない素材に明示選択を適用せず、音声0以外をcopy適格に拡張しません。

処理完了・container durationだけでpixel/audio一致としません。AACのpriming/末尾、edit list、B-frameのpreroll、複数playerの読取り方を確認する必要があります。開発診断では選択区間の全frame/PCM/packet比較を使い、その時間を含む結果とexport本体の時間を分けます。通常運用の適格判定は検証済み条件と必要区間のmetadata／変更検知で成立させる設計で、毎回の全尺decodeへ置き換えません。

## 未達のgate

- 先頭・末尾の映像、原本時刻、音声選択・サンプル終端、AAC/edit listを読む複数playerの互換性。
- 複数区間の結合、native非対応入力でのfallback、公開済み出力・失敗後の原本と一時ファイルの保全。
- 描画ありの既存経路について、座標、重ね順、文字、freeze、chroma、時刻・範囲・音声の出力回帰。
- macOS各対象版・architectureのhelper build/配布・署名。通常UIとreleaseは未有効。

native再生窓はHTML canvasを引き継ぎません。座標、重ね順、fullscreen、seekに追従する描画、frame captureは[native playback](native-playback.md)の未達gateです。書き出しが別処理であることを「影響なし」の根拠にはしません。

## 検証入口

TypeScriptは`electron/src/nativeExport`とexport runner/preparationのunit testで、所有権、非上書き、source更新、資格欠如、描画除外、角度・時刻原点・音声fallbackを確認します。実helperはmacOS SDKを使用して開発用の専用出力先へbuildします。

```sh
xcrun swiftc -parse-as-library -O -module-cache-path /tmp/native-export-module-cache native/macos/ExportTime.swift native/macos/ClipPassthrough.swift -o /tmp/ClipPassthrough
pnpm exec vitest run electron/src/nativeExport electron/src/ipc/exportPreparedClipRenderer.test.ts electron/src/ipc/exportSourcePreparation.test.ts
```

追加したSwiftは本プロジェクトで作成したsourceです。Apple frameworkはOS提供の動的依存です。新たな外部コードやbinaryを同梱していません。配布前の確認は[由来の確認台帳](provenance-review.md)に従います。

## 公式資料

- [AVAssetExportSession](https://developer.apple.com/documentation/avfoundation/avassetexportsession)
- [Passthrough preset](https://developer.apple.com/documentation/avfoundation/avassetexportpresetpassthrough)
- [Asset compatibility](<https://developer.apple.com/documentation/avfoundation/avassetexportsession/determinecompatibility(ofexportpreset:with:outputfiletype:completionhandler:)>)
- [Apple QA1744: track transformとpassthroughの制約](https://developer.apple.com/library/archive/qa/qa1744/_index.html)

SDKの`AVAssetExportSession.h`にもpassthroughのcontainer制約、audioMix/videoComposition無視が明記されています。Sportscode内部の書き出し方式は未確認です。
