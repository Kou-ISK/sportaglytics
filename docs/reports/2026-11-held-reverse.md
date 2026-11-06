# 長押し逆再生のクラウド検証と実機測定

## 対象と結論

2026-11-01、Linuxクラウドのみで作業。`develop`は調査コミット`d9ecdd79bd0bc09f713dbb95e2cc6c2eff11a839`と一致し、差分は0。既存PR #262の`fix/apple-pixel-retention`、`a5c78b5b94ceac48717fbb11bbc28f9cb272112c`を継続し、元のCVPixelBuffer保持修正を維持した。旧`fix/native-held-reverse`の`c3d38498`はPR #260の解放位置修正であり、今回の継続元ではない。新規リモートブランチ、Mac操作、マージ、配布・リリースは実施していない。

対応AVPlayerItemの負rate経路と、表示トランザクションを直列化する代替を実装した。**LinuxのHTML代替は実復号PTSで検証。AVPlayerの復号・物理表示・実機での滑らかさは未検証**。能力フラグ、rate設定、模擬時計を実表示成功の根拠にはしていない。[現行仕様](../native-playback.md)、[設計判断](../adr/0081-held-reverse-presentation.md)。

## 実復号した範囲

再現コマンド（Node、FFmpeg、Chromium、依存導入済みの環境）:

```bash
REVERSE_RESULTS=/tmp/held-reverse-results.json node scripts/test-reverse-playback-browser.mjs
```

`CHROMIUM_PATH`でChromium実行ファイルを指定できる。`REVERSE_MODE=main`または`playlist`で片側のみ測定できる。60fps/40秒/320×180のH.264 `testsrc2`を一時生成し、2つの実HTMLVideoElementで復号する。素材・プロファイル・生成JSは一時ディレクトリ内に限定し終了時に削除する。原本・私有project・モデルは使わず、新しいバイナリや素材をrepositoryへ同梱しない。

メインは実`useVideoTimeController`/Video.js、Playlistは実`usePlaylistPlayback`/TimelineVideoAdapter、共通の長押しhookと既定キーを使用する。実Playwright keydown/upを発行する。パッケージのmetadata lookupと画面外の周辺UIはfixture。`navigator.platform`だけをMacのキー割当に設定してCommandの既定割当を試験するが、OS・ブラウザ・復号器はLinuxである。完全なElectron画面のE2Eではない。

開始共通時計30秒。全行で押下中の**異なる元映像PTSが厳密に減少**した。開始位置の静止フレームは除外し、最大間隔には押下から最初の逆方向画像、最後の画像から解放も含める。初画像はrVFCの表示予定画像、確定はその後のpaint待ちを含む。本測定はheadless compositorの結果で、物理パネル撮影ではない。

| 経路     | 倍率 | 押下ms | 期待停止秒 | 実停止秒 | 異なるPTS枚数 | 初逆画像ms | 最大間隔ms | 解放→確定ms |
| -------- | ---: | -----: | ---------: | -------: | ------------: | ---------: | ---------: | ----------: |
| main     |  0.5 | 6005.0 |         27 | 27.00840 |           179 |       64.4 |       64.4 |        43.7 |
| main     |    2 | 4003.8 |         22 | 22.03380 |           119 |       47.1 |       50.1 |        49.7 |
| main     |    4 | 2003.5 |         22 | 22.06680 |            59 |       46.9 |       46.9 |        61.7 |
| main     |    6 | 2003.6 |         18 | 18.10020 |            59 |       48.1 |       48.1 |        63.8 |
| playlist |  0.5 | 6003.9 |         27 | 27.00840 |           179 |       61.6 |       61.6 |        42.7 |
| playlist |    2 | 4004.0 |         22 | 22.03360 |           118 |       47.5 |       50.1 |        45.3 |
| playlist |    4 | 2003.6 |         22 | 22.06760 |            59 |       46.4 |       46.4 |        61.4 |
| playlist |    6 | 2003.6 |         18 | 18.10020 |            59 |       47.1 |       47.1 |        78.3 |

実際の押下msにはテストクライアントのキー配送時間も含む。各目標に対する許容差は試験では0.7秒、結果は約0.1秒以内。PTSの逆順と1秒未満の最大間隔も独立にassertする。Playlistでは追加で13秒から6倍、clip境界と10〜12秒の空白を横断して項目開始2秒で停止し、2アングル間の0.7秒差を確認した。空白は存在しないフレームを生成せず、既存timelineが解決した空白として扱う。異なるclipのlocal PTSは連続とは見なさない。

## 模擬した範囲と回帰

- 実NativePlaybackController/Sessionとhookに、AVPlayer観測・IPC配送・Drawnを模擬注入。4倍率の指定時間と距離、保持時間を増やしてもseekIdが増えないこと、停止画像付き実時計、解放直後の再押下、速度変更・方向変更・別seek・音声変更・先頭停止・source取消を検査。
- nativeの最初の通知がseeking/buffering/pausedでも、その後の負方向進行を受け付ける。方向変更時は新しい操作の最初の観測で再基準化し、同じ方向の不正な後退/進行は引き続き拒否する。
- 一度に表示まで進める要求は1件。遅い応答中に最新希望を更新し、受信後・rAF描画前の新入力でも有効な途中画像を描く。解放後は最後の希望位置へ到達する。preloadの実実装と模擬texture/canvasを接続して検査。
- 文書/source/seek/sequence/配送IDの旧画像拒否、描画前source変更、Abort後の旧完了、画像を確認する前にcurrentTime代入値を公開しないことを検査。
- Playlistの最初の0.5倍ステップが既存15msシーク許容差で省略される回帰を追加。明示シークだけを確実に適用し、通常再生中の補正閾値は維持。
- 全既存unit群の順再生・スロー順再生・一時停止・スクラブ・音声・手動同期・Studioキー制限も実行対象。これらの実機操作全部を今回測定した意味ではない。

`PlayerObservation.test.cpp`はLinux C++で、負rate、遅延pause、1枚だけ繰り返すPTSと減少PTSの区別を検査する。Apple SDK/AVPlayer本体の代用ではない。Linuxで実行可能なpipe/receipt/transport/recurrence/runtimeのNode回帰96件も通過した。

## 品質ゲートと未完了

引継ぎ版の最終再実行はVitest **359 files / 2,016 pass / 7 skip**、Node **127/127 pass**。追加transport回帰 **96/96 pass**。型/Electron型/lint/architecture/design-system/ADRも通過した。新しいApple SDK実行結果はない。

- `pnpm run verify`: 型、Electron型、lint、architecture、design-system、ADR、VitestとNodeテストを実行。buildの`vision:prepare`で固定モデル取得がHTTP 403となるため、**aggregate全体は未完了**。
- `vision:prepare`の対象は`https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/1/efficientdet_lite2.tflite`。クラウドの許可ホストに含まれない。既存hash検証を緩めたり、モデルを代替して合格扱いにはしていない。`e2e:prepare`も同じ前提で停止する。
- モデル取得から切り離した`vite build`、`storybook build`、`build:electron-main`、`bundle:preload`、`check:preload`は個別に通過した。モデルを含む完全なアプリビルド成功とは区別する。
- Apple Objective-C++/IOSurfaceのbuild・`pnpm run test:native-runtime`全体、Mac実原本・音声の実聴取・長時間安定、Windows実機、署名・公証・配布は未実施。リリースは作業範囲外。
- 実装とは別の差分点検で、停止前の画像確定、方向変更直後の時計拒否、初回微小seek省略、画像待ち準備例外のcleanupを修正した。別担当者による独立レビューと対応OSの最終受入は残る。

## 実機測定手順（この作業では未実施）

1. 配布せず開発buildを用意する。比較する両版で同一原本・同一区間・同じ開始時刻を選ぶ。原本の識別hash/サイズ、codec/fps/geometry、アプリcommit、OS、機種、画面Hz、背景負荷をローカル記録する。私有pathや映像を公開資料へ転記しない。開始は全条件で先頭・clip境界から15秒以上離す。
2. development rendererと非minifyのpreloadでDevToolsを開く。以下の数値だけをローカル配列へ記録し、処理をpauseするbreakpointやフレームごとのconsole出力は使わない。全イベントの時間を`performance.timeOrigin + performance.now()`にそろえる（Mainプロセスの独立時計と混ぜない）。各試行前に配列をクリアし、記録は各10秒程度で止める。
3. main worldのキー捕捉で、`ArrowLeft`の初回keydownとkeyupの時刻/修飾キーを記録する。repeat keydownは開始時刻を更新しない。HTMLは各videoの`requestVideoFrameCallback`で`mediaTime`、`currentSrc`のローカル識別子、表示時刻を記録する。同じURLでもclipが変わった場合は別区間として扱う。
4. nativeは`electron/src/preload/nativeSurfaceBridge.ts`の`drawn = admission.commit(p.meta)`直後（bundle内の同じ非minify箇所）に**停止しない条件付きbreakpoint**を置き、次の式で描画された画像だけをisolated worldのローカル配列に記録する。右側の`false`により処理は停止しない。

   ```js
   (drawn &&
     (globalThis.__reverseFrames ??= []).push({
       at: performance.timeOrigin + performance.now(),
       seq: p.meta.nativeGeneration,
       seek: p.meta.seekId,
       id: p.meta.id,
       pts: p.meta.pts / 120000,
     }),
     false);
   ```

   `withNativeSurface.ts`のapply入口も同様に`intent.sequence/seekId/rate/playing`だけを記録する。PTSの記録は受信時刻や要求時刻で代用しない。preloadに汎用の公開APIを追加する必要はない。

5. `nativePlaybackController.ts`のreceive内、ready判定後の`this.update(...)`直前で、`ready`のときだけ`observation.sequence/seekId/phase/rate`、`value.lastConfirmedTime`、同じrenderer時刻を記録する。画像と同じ操作の停止確認を照合する。HTMLでは対応hookの`waitForVideoPresentation`解決後の時計確定を記録する。DevToolsのexecution contextを切り替え、各worldの配列をローカルJSONへ保存する。計測が重くなる環境ではDevToolsの記録量を減らし、無計測の目視/画面収録も併記する。
6. 0.5倍6秒、2倍4秒、4倍2秒、6倍2秒をそれぞれ3回、主画面とPlaylistで実行する。原本PTSが開始PTSより初めて小さくなる画像までの時間、押下中の異なる減少PTS枚数、隣接画像の最大間隔（両端の待ちも含む）、解放から同じ停止操作の画像と確認時計がそろうまでの時間を算出する。停止までの差分が約3/8/8/12秒であることも独立に確認する。
7. nativeは押下中にseekIdが増えないことを確認する。capability=trueや負rate観測のみで合格にしない。画面収録を併用し、数字だけ戻る/解放時だけ飛ぶ/初期数枚だけ動く場合は不合格。代替では遅い復号条件で途中画像が残り、最後の希望位置にも到達することを確認する。
8. 解放直後の再押下、右方向・通常seek・スクラブへの切替、素材交代、先頭、Playlist項目開始、clip切替/空白/アングル時差も測定する。順再生/スロー/停止、音声設定、Playlist切替、手動同期のコマ送り、Studioの制限を対照確認する。計測設定を解除し通常操作へ戻す。

nativeの描画ACKはrendererのdrawImage実行の証拠であり、物理パネルの発光時刻ではない。物理的な滑らかさは同一条件の目視/画面収録を別欄に記録する。本報告には新しいMac測定値はない。

## ローカル継続への引継ぎ

ローカル動作へ切り替える指示を受け、クラウドの新規実装を停止した。最後に実復号8条件を通過した表示待ち条件を保存する。元PTSが要求より先にある画像の再利用を拒否し、表示許容幅は50ms。20fps未満や可変フレーム間隔が大きい素材では追加検証が必要である。

直前に試した「固定50msを廃して確認済み区間だけ再利用する」変更は、`requestVideoFrameCallback`時点で`video.seeking`も検査するとMainの2倍条件で`REVERSE_IMAGE_TIMEOUT`になったため採用しなかった。ローカルではseekedとrVFCの順序を調べ、低fps素材まで拡張するなら新たに検証する。未合格の実験は作業branchの実装に混ぜていない。

PR #262への保存コミットには`[skip ci]`を付け、macOS/Windowsを含む新しいGitHub Actionsの起動を避ける。既存のrelease workflowはworkflow_dispatchのみで、起動しない。ドラフト状態を維持し、別担当レビュー・Mac実原本の受入・完全buildは未完了のまま引き継ぐ。
