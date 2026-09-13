# Windows版

Windows固有の導入・操作・互換性・検証の正本です。各機能の操作は[ユーザーガイド](user-guide.md)、描画は[Paint](tactics.md)を参照してください。

## 対象と導入

配布対象はWindows 11 x64です。GitHub Releaseの `SporTagLytics-Setup-<version>-x64.exe` からユーザー単位でインストールします。管理者権限、別途のFFmpeg、Python、Visual C++ランタイムを要求しない構成です。Windows ARMのネイティブ配布とLinux配布は対象外です。

Windowsの署名証明書が設定されていないビルドは未署名です。SmartScreenや組織の実行ポリシーによって起動を制限される場合があります。macOSの署名・公証とWindowsのAuthenticode署名は別々に扱い、Windowsの未署名状態をmacOSにも適用しません。組織の制限を解除する手順は提供しません。

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

`.stpkg`、`.stpl`、`.stad` はフォルダー形式の文書です。Windows Explorerではフォルダーとして見えます。中身のJSONではなく、フォルダー全体を起動画面へドロップするか「開く」で選択してください。インストーラーはフォルダーの「SporTagLyticsで開く」を登録します。`.stcw` は通常のファイル関連付けから開けます。

Macからコピーする場合もフォルダー全体と同梱映像を移してください。元のコンピューター上の絶対パスだけを参照する外部素材は、コピー先で再指定が必要です。日本語、空白、`#`、`%` を含むドライブパス・UNCパスはfile URLへ変換して再生します。ネットワーク共有にはOS側のアクセス権が必要です。

日本語字幕には同梱のNoto Sans CJK JPを使います。Windowsの表示言語や日本語追加フォントの有無に依存しません。追尾結果、Paint文書、行色、プレイリストの保存形式はOS間で共通です。

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

実装の入口: `scripts/media-tools/windows.mjs`、`scripts/build-windows-llama.mjs`、`scripts/windows/`、`electron/src/mediaTools.ts`、`electron/src/videoWindowAspect.ts`、`src/utils/platformShortcut.ts`。
