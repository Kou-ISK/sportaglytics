# 動画出力テキストの早い折り返し

## 原因と再現

2026-11-16、`develop`の`525f2b5afbe0d491d25895a6e7a89bd679e20276`（package version 0.17.29）から独立した修正。別の再生改善PR #288のブランチは変更していない。添付画像はLibraryからこのLinux環境への取得が2回とも失敗したため実画素未確認。以下の画像・文字列・動画はすべて合成であり、添付画像を再現したものではない。

旧`clipExportTextLayout`は日本語の1書記素を1.2em、ASCIIの大半を0.7emで見積もり、画面幅94%で折り返していた。実描画は左1.5%から開始するため、右側の予算とも一致しない。Noto Sans CJKの1080p/30pxで全角60文字を出力すると、実際の幅は1800pxなのに50文字+10文字へ分かれる。推定の過大評価は細い英字でさらに大きい。これはウィンドウ表示倍率によらず起き、旧プレビューも同じ推定レイアウトを共有するため、プレビューだけのCSS問題ではない。

旧ベースの実コードから合成MP4を出力した[修正前](assets/export-text-wrap/before.png)と、修正後の実フィルターで出力した[修正後PNG](assets/export-text-wrap/after.png)・[MP4](assets/export-text-wrap/after.mp4)。修正後は60文字が1行で、復号した白文字の範囲はx=31〜1826、y=1032〜1059。文字数上限の緩和ではなく、測定値に基づく幅の修正である。

## 変更

- Mainの測定Adapterが出力と同じFFmpeg/fontfile/太さ/整数ピクセルサイズで、候補行全体の`text_w`を測定する。字幅の単純加算はkerning/shapingを失うため使用しない。[FFmpeg drawtext](https://ffmpeg.org/ffmpeg-filters.html#drawtext-1)と[式評価](https://ffmpeg.org/ffmpeg-utils.html#Expression-Evaluation)の公開仕様を使用する。
- sharedのレイアウト規則へ測定関数を注入し、左右各1.5%と右端2pxのshadow/raster余裕を除いた幅に収める。明示改行・CRLF・空行・書記素の不可分性を保持し、英語は可能なら空白で折り返す。長い単語は書記素単位で折り返す。日本語の禁則処理は新設していない。
- 30〜24px/1080p相当・行送り1.25倍・上下各1%・帯20%上限を維持する。出力ピクセルへの丸めを測定と描画で一致させる。文字や行が収まらない場合は省略せず拒否する。
- 単一映像は自動回転後、2画面は既存のSAR正規化・偶数高さ・hstack後のサイズを使う。プレビューは検査済みレイアウトを再利用し、文字描画後に表示用へ縮小する。Paint・フリーズ・音声処理は変更していない。
- 実画素検査で、従来の百分率/引用符のエスケープにより文字が消える条件も見つかった。`expansion=none`とAVOption/filtergraphの2段階エスケープで、測定対象と描画本文を一致させる。先頭末尾の空白も保持する。
- 測定は最大32候補を直列バッチ化し、1プロセス10秒/出力256KiBに制限する。exportの中止signalを継承する。cacheは要求内だけで最大2048件/約1MiB。既に高さ予算を超えた段落は残りの本文を保持して測定を止め、最小サイズでも不可能なら中間サイズの再試行を省く。10万文字でも測定回数が250未満である単体回帰を追加した。本文はprivate tempのtextfileに渡し、argvへ含めず、成功・失敗後に削除する。測定失敗時に旧推定へ戻さない。
- 初回の対応OS CIはFFmpeg 8の`print()`ログ接頭辞を扱えず測定時に失敗した。[8.1.2の公式式評価実装](https://github.com/FFmpeg/FFmpeg/blob/n8.1.2/libavutil/eval.c)と同版libavutilのローカル実行で差を確認し、7の数値単独形式と8の`[Eval @ address]`付き形式を受理する。未知の測定ID・欠測・不一致は引き続き拒否し、両形式の単体回帰を持つ。

## 検証と再現コマンド

Linux x64、Node 24.19.0、pnpm 9.1.0、FFmpeg 7.1.5、Debian `fonts-noto-cjk` 1:20240730+repack1-1。ソース・型の検証と実描画検証を分ける。

```bash
pnpm run verify
EXPORT_TEXT_EVIDENCE_DIR=/tmp/export-text-evidence node scripts/test-export-text-layout.mjs
# 事前にe2e:prepare（Linux仮想displayでは既存E2E_CLOUD_LINUXの指定が必要）
node scripts/e2e-export-text-geometry.mjs
```

実FFmpeg回帰はproductionの依存グラフをコンパイルし、14条件のMP4を作成・復号して白文字の左右/下端の画素範囲を検査する。各条件で、インラインのエスケープ済み文字と独立したliteral textfile描画のRGB全画素一致も確認する。検査時の[結果JSON](assets/export-text-wrap/results.json)を保持する。

| 条件                                                                     | 結果                                                                                                           |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| 日本語60文字、1920×1080                                                  | 1行、右端1826px                                                                                                |
| 日本語120文字、1920×1080                                                 | 62文字+58文字、右端1886px（右余白28.8px以上）                                                                  |
| 英語・長い単語・日英混在・太字                                           | 全文字保持、単語/書記素で折り返し                                                                              |
| 640×360、1280×720、1440×1080、1920×1080、1080×1920、3840×1080、3840×2160 | 画素境界検査通過                                                                                               |
| CRLF・空行・結合文字・百分率・引用符・バックスラッシュ・先頭末尾空白     | literal textfileとの全画素一致                                                                                 |
| 高さ超過                                                                 | exportフィルター生成前に拒否                                                                                   |
| 回転・SAR結合幅                                                          | 純粋geometry/probe応答と実Electron Mainのpreview/exportを検査。90度回転で540×960、SAR付き2画面で1792×576を確認 |

単体回帰は利用可能幅、重み/サイズの測定引数、単語/書記素/明示改行、最小サイズ/高さ超過、異常な測定応答、cleanup/cache、選択ソースとプレビューhookのstale結果を確認する。共通ゲートの最終結果はPRに記録する。途中の環境不整合はfrozen installとElectron binaryの通常取得で解消し、131件のNode検査が通過した。`vision:prepare`は既存の固定モデルURLがHTTP 403を返すためローカルでは未完了。モデル検証は省略・置換せず、独立して`vite build`、Main/runtime、preload検査、`storybook build`と対象Electron E2Eを実行した。初回コミットのGitHub品質CIは全工程成功したが、最終headの結果は別に確認する。途中の全体試験は旧runnerテストが実在しない`/ffmpeg`を使ったため1件失敗し、測定portを模擬して修正した。期待する出力・安全条件は弱めていない。

## 未実施と公開条件

Linuxの仮想X display/Electron 43.8.1では既存`e2e-export-menu`が通過した。実メニュー、Timeline/Playlistダイアログ、ノート編集/保存/再読込、Sorter順序、実MP4、日本語複数行、preview、overflow拒否と復帰を確認した。`e2e-export-text-geometry`は実Mainのpreview/export関数を呼び、単一・90度回転・SAR付き2画面でサイズと復号画像を比較した。RGBの平均絶対差は順に0.112/0.268/0.030（0〜255階調、許容3未満）。この専用比較はIPC transportの検証ではない。

MacのHiragino、Windows同梱Noto/FFmpeg 8.1.2、署名済み配布物はローカル未検証。macOS PR CIとWindows CIに同じ実画素回帰を追加した。対応OSの最終head CI、通常レビュー、必要な配布物受入が完了するまで公開済み0.17.29を置き換えない。

通常リリースは署名・公証・同一配布物E2Eを含む既存手順が必要。developには未公開モデル方針があり、mainとの差分を無条件に一括公開できない。PR #288との版・main統合の競合がないことを確認し、既存の限定release運用/例外の適用条件と新versionを確定する。Linuxの成功を理由に別Macタスクと競合するrelease dispatchを起動しない。

## 資産の由来

本変更に新しい依存・フォント・製品binaryはない。証拠の青背景はFFmpeg `color`、文字は架空の反復句、PNGは合成MP4の復号結果。リポジトリの検査scriptで作成し、ユーザーの画像/映像/識別情報は含めない。Noto Sans CJKは既存検査環境のSIL OFL 1.1フォントを使用し、フォントファイル自体は再配布しない。Windows配布フォントとNOTICEは既存の`fonts:prepare`を維持する。

SHA-256:

- Regular TTC: `b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a`
- Bold TTC: `faa5f3656a78b2e2d450d27fe8382c778bc2b6bb5ea29c986664a6a435056ceb`
- before.png: `695f94d99b1bf9be9238030c4104b9b44b1b86bbca9ce92fc1c80a37b44f2df1`
- after.png: `9cb8bbe15eef9bc073cbc27fd96e16e8b01e8dad9f9cf5bbaf303138aacf0bcc`
- after.mp4: `a0416bc89b83c8138fb72c3bcd3a805b6b175116ad2f6ff6f27658e2aa604992`

## 限定リリース準備

PR #289は全3 workflow成功後にdevelopへ通常merge（`2fcfa7eeb51f8040cbef9238001cccfaf088406f`）した。macOS/HiraginoとWindows/Notoの14条件も通過し、Windows通常・インストール版の各29シナリオが成功。続く0.17.30準備では`export-text-geometry`を共通/配布物E2Eへ登録し、Main内でそのアプリのFFmpegを解決する。source-only比較を配布物の成功として流用しない。ARCH-EX-014で対象を限定し、PR #288とモデル関連の未公開差分は含めない。署名・公証・公開の最終状態は準備/main PRと同一release runに記録する。
