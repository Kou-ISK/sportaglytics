# Windows版

Windows固有の導入・操作・互換性・検証の正本です。各機能の操作は[ユーザーガイド](user-guide.md)、描画は[Paint](tactics.md)を参照してください。

## 対象と導入

配布対象はWindows 11 x64です。GitHub Releaseの `SporTagLytics-Setup-<version>-x64.exe` からユーザー単位でインストールします。管理者権限、別途のFFmpeg、Python、Visual C++ランタイムを要求しない構成です。Windows ARMのネイティブ配布とLinux配布は対象外です。

H.264書き出し・再符号化を伴うライブ録画には、Windows組込みのMedia Foundationを使用します。GPUは不要です。Windows Nでは「設定 → アプリ → オプション機能」からMedia Feature Packを追加し、Windowsを再起動してください。アプリが不足を検出すると、この案内を表示して処理を停止します。OS機能の自動追加は行いません。[Microsoftの導入案内](https://support.microsoft.com/en-us/windows/experience/platform-variants/media-feature-pack-for-windows-n)。

Windowsの署名証明書が設定されていないビルドは未署名です。SmartScreenや組織の実行ポリシーによって起動を制限される場合があります。macOSの署名・公証とWindowsのAuthenticode署名は別々に扱い、Windowsの未署名状態をmacOSにも適用しません。

## 機能と操作

| 機能                   | Windowsでの動作                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 映像・複数アングル     | 同梱のFFmpeg/FFprobeで素材解析・仮想アングル生成・書き出し。映像ウィンドウは操作欄を除いて縦横比を固定。Playlistは自由にリサイズ           |
| Timeline / Code Window | Ctrlで複数選択・Undo・保存。Ctrl+Altで区間作成・端の編集。上のつまみだけが再生位置を動かす                                                 |
| Playlist / Paint       | 描画、選手追尾、ディスク・リンク、位置キー、背景処理、静止時間、動画書き出しは共通実装。Backspace/Deleteはフォーカスと選択対象に応じて動作 |
| 音声同期               | ローカル素材の音声抽出、表示中の音声の一時解析に対応。YouTubeの映像・音声をダウンロードしない。無音・権限拒否・低信頼度では手動同期を維持  |
| 分析・レポート         | 同じ分析・PDF/PNG・Timeline交換形式を使用                                                                                                  |
| AI分析                 | CPUで動くllama.cppを同梱。GPUドライバー追加は不要。GGUFモデルは別途選択し、アプリに重みを同梱しない                                        |
| 自動イベント検出       | 検証済みの `win32-x64` runnerを含むmodel packが必要。macOS専用runnerをWindowsで実行せず、非対応状態を表示                                  |

MacのCommandに相当するキーはCtrl、OptionはAltです。設定の保存形式は `CommandOrControl` / `Alt` とし、以前の `Command` / `Cmd` / `Option` 設定は読込時に変換します。ホットキー設定では現在のOSの表記を表示します。

## パッケージとファイル

`.stpkg`、`.stpl`、`.stad` はフォルダー形式の文書です。Windows Explorerではフォルダーとして見えます。中身のJSONではなく、フォルダー全体を起動画面へドロップするか「開く」で選択してください。インストーラーはフォルダーの「SporTagLyticsで開く」を登録します。右クリックの最初のメニューに見当たらない場合は「その他のオプションを表示」を開いてください。`.stcw` は通常のファイル関連付けから開けます。

Macからコピーする場合もフォルダー全体と同梱映像を移してください。元のコンピューター上の絶対パスだけを参照する外部素材は、コピー先で再指定が必要です。日本語、空白、`#`、`%` を含むドライブパス・UNCパスはfile URLへ変換して再生します。ネットワーク共有にはOS側のアクセス権が必要です。

日本語字幕には同梱のNoto Sans CJK JPを使います。同梱FFmpegはUTF-8 code pageを宣言し、日本語のユーザー名・インストール先でもフォントを開けるようにします。Windowsの表示言語や日本語追加フォントの有無に依存しません。追尾結果、Paint文書、行色、プレイリストの保存形式はOS間で共通です。

AIのGGUFは任意の場所へ保存して設定に絶対パスを指定するか、`%APPDATA%/sportaglytics/llama/models/` に配置します。Program Files内へモデルをコピーする必要はありません。詳細は[AIセットアップ](ai-analysis.md)。アンインストール時に利用者のパッケージや設定を削除しません。

## 開発・検証

Node.js 22.12以降、pnpm 9、Visual Studio C++ Build ToolsとCMakeを使用します。FFmpegのソースビルドだけはMSYS2 UCRT64シェルで実行します。依存パッケージと実行順序は [Windows CI](../.github/workflows/windows.yml) を正本とします。

```powershell
pnpm install --frozen-lockfile
# MSYS2 UCRT64シェル内: node scripts/build-media-tools.mjs
pnpm run fonts:prepare
pnpm run llama:build:windows
pnpm run verify
pnpm run test:e2e
pnpm run electron:package:windows
```

CIは開発版のElectron E2Eに加え、NSISで日本語・空白・URL予約文字を含む場所へインストールしたアプリでも同じシナリオを実行します。FFmpegとllama.cppのPE import tableを検査し、開発環境にだけ存在するDLLへの依存を検出します。GUIを操作できるrunnerが必要です。CI結果はネイティブなWindowsビルド・操作の証拠であり、あらゆるGPU、音声機器、ネットワーク共有、管理ポリシーでの動作保証ではありません。

インストール直後に `scripts/windows/test-installed-app.ps1` が同じrunのcheckout・build出力と実ファイルを照合し、`output/distribution/windows-installed.json` を作成します。root LICENSE/NOTICE、ResourcesとASAR内のrenderer/preload inventory、台帳の全source資産とASARに入るpublic資産、Paintモデルの固定hash・告知・WASM、media-toolsのbuild manifest・告知・compiler runtime本文を検査します。既定のモデルなし配布候補にGGUFやevent packが混入した場合は失敗します。この検査はpack同梱版の配布レビューを代替しません。

installer・installed app・FFmpeg・FFprobeには `Get-AuthenticodeSignature` を実行し、実ファイルのSHA-256と `Valid` / `NotSigned` を記録します。その他の署名状態は失敗にし、未署名native binaryは署名前build hashとも照合します。署名済みnative binaryのhashは署名前manifestと別に記録します。証明書のsubjectやローカル絶対pathはreportへ出しません。未署名候補をこの検査で署名済みとして扱うことはありません。

reportはCIログの `Installed distribution evidence:` 行と既存の `windows-x64-installer` artifactに保存します。`sourceCommit` はPRではCIのmerge commitです。NOTICEのhashはcheckoutの改行を含む実bytesとの比較で、Git blobのhashとは区別します。reportはそのrunの新しいinstallerだけの証拠で、過去artifact、macOS署名・公証、素材の由来や許諾の完了を証明しません。NOTICE変更後は必ず再packagingし、古いmanifestを新候補へ流用しないでください。

実装の入口: `scripts/media-tools/windows.mjs`、`scripts/build-windows-llama.mjs`、`scripts/windows/`、`electron/src/mediaTools.ts`、`electron/src/videoWindowAspect.ts`、`src/utils/platformShortcut.ts`。

Media FoundationのCPU経路は `node scripts/windows/verify-h264.mjs` で720p/1080p/3840×1080二画面相当のMP4の60フレーム復号、H.264/AACと開始時刻・尺を検査します。インストール後にも同じ検査を行い、Paint overlay、二画面、同期、結合、captureを含む全24シナリオを実行します。不足検出unitはDLL不在・MFT不在・encoder不在・timeout・起動失敗を模擬します。Windows N実機のFeature Pack未導入/導入後の検証と、実機別GPU・カメラの検証はCIのCPU成功と区別します。

二画面出力は入力の高い方のfpsに揃え、異なるfpsの組合せでもOS encoderへ有効な値を渡します。CPU検査は25/30fps混在と60fps維持の実合成も確認します。
