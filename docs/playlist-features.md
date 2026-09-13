# Playlistの操作と保存契約

Playlistは、タイムラインで選んだ映像区間を整理し、連続再生・提示・書き出しを行う専用ウィンドウです。描画・位置キー・追尾の操作と制約は[Paint](tactics.md)を正本とします。本書はウィンドウ、再生順、保存、書き出しの契約を扱います。

## 作業の流れ

1. タイムラインでインスタンスを選択し、右クリックメニューまたは既定の `Cmd/Ctrl+Shift+P` からPlaylistへ追加します。
2. PlaylistウィンドウでOrganizerまたはSorterを選び、クリップを整理・確認します。
3. クリップを選択して再生し、必要に応じてノート、フリーズフレーム、Paintの描画を追加します。
4. `.stpl` として保存するか、映像クリップを書き出します。

Organizerは行と行内のクリップ順を編集する面です。Sorterはメタデータを表形式で比較・検索する面です。Sorterの列ソートやフィルターは見えている一覧を変え、文書の再生順を変更しません。再生・書き出しには同じ正規順序を使います。

## 再生と表示

- Playlistの再生バーは、メイン映像と同じ角丸・半透明の共有コントローラーを使います。時間表示、シーク、再生速度、前後移動をまとめて操作できます。
- シーク領域に描画のある位置を表示し、目印から該当時刻へ移動できます。Paint内では、図形ごとの表示区間と位置キーを下部タイムラインから直接編集します。
- アングル1、アングル2、2画面の表示に対応し、描画対象のアングルを分けて扱います。
- Playlistウィンドウの縦横比は自由です。メイン映像ウィンドウの固定縦横比を適用しません。映像とOrganizer/Sorter、Inspectorの作業領域に合わせてサイズを調整できます。
- フリーズフレームは指定時刻での静止表示と描画を保持します。再生中の図形表示・追尾とは別の編集単位です。
- Paint中の `Delete` / `Backspace` は位置キーまたは図形へ作用し、クリップは削除しません。文字・数値入力やダイアログでは通常の入力操作を優先します。

## `.stpl` の保存契約

`.stpl` は `playlist.json` を含むディレクトリ型パッケージです。埋め込み保存では `videos/` 以下に切り出した映像を含め、参照保存では元映像へのパスを保持します。

| 形式        | 内容                 | 持ち運びの条件                               |
| ----------- | -------------------- | -------------------------------------------- |
| `embedded`  | 対象区間の映像を内包 | パッケージ内の映像も含めて移動する           |
| `reference` | 元映像への参照を保持 | 元映像へ同じ場所からアクセスできることが必要 |

埋め込み映像はクリップ先頭を0秒とします。時刻の変換と描画のロード時移行は保存・読込層で行い、View側に旧形式の分岐を持ち込みません。JSONを直接編集する運用は保証せず、アプリの保存・正規化を通してください。

### 文書の正規順序

現行の `schemaVersion` は **2** です。

- `rows` がOrganizerの行を表し、各クリップは `rowId` と `rowOrder` を持ちます。
- 正規順序は行の `order` → 行内の `rowOrder` です。再生・保存・書き出しの呼び出し元は `getPresentationItems` を共通利用します。
- 行情報のない旧flat形式は既定行「クリップ」へ移行し、元の配列順を保持します。`actionName` による暗黙の再グループ化は行いません。
- 正規化は冪等であり、繰り返し読み込み・保存しても行やクリップを増殖させません。

Sorterの列ソート、フィルター、列幅・表示状態、Organizer/Sorterの切替、Inspector幅はウィンドウの表示状態です。文書には保存せず、それだけでは未保存変更にしません。詳細な判断背景は[ADR 0025](adr/0025-playlist-document-presentation-order.md)を参照してください。

描画の座標、位置キー、素材の保存範囲は[Paintのデータ契約](tactics.md)に従います。型定義を本書へ複製せず、`src/types/playlist/core.ts` を参照します。

## 複数ウィンドウと保存確認

複数のPlaylistを独立したウィンドウで開けます。同じファイルへの要求は既存ウィンドウをフォーカスします。文書を変更して閉じるときは保存確認を行います。

メインとの同期・コマンド転送はPackage Sessionの所有権に従います。別パッケージの映像・時刻・選択が混線しないよう、Mainが所有するSessionを境界にします。Rendererが任意の他ウィンドウを直接操作する構成にはしません。

## 映像の書き出し

書き出しダイアログで次を指定します。

| 項目     | 選択肢                                                |
| -------- | ----------------------------------------------------- |
| 対象     | 全クリップ / 選択中のみ                               |
| まとめ方 | 1本に連結 / インスタンスごと / アクションごと         |
| アングル | 全アングルを個別出力 / 単一アングル / 2アングルを合成 |
| 情報表示 | アクション名・番号・ラベル・メモのオーバーレイ        |

フリーズフレームとPaintの描画も書き出しデータに含めます。動きのサンプル数や書き出し上限は[Paintの制約](tactics.md)に従います。

進行状況は専用の進捗ウィンドウに表示します。失敗した場合は元映像、保存先の権限、空き容量を確認し、必要ならエラー詳細を開きます。FFmpeg実行・一時ファイル・キャンセルはMain側の責務であり、RendererのViewから直接扱いません。

## 実装と検証の正本

| 責務                 | 実装                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------ |
| 型・保存モデル       | `src/types/playlist/core.ts`                                                         |
| 正規化・移行・再生順 | `src/shared/playlist/playlistDocument.ts`                                            |
| UIと操作状態         | `src/features/playlist/components/`、`hooks/playlist/`                               |
| 描画                 | `src/features/playlist/studio/`、`hooks/annotation/`                                 |
| Playlist外部依存     | `src/features/playlist/gateway/playlistWindowGateway.ts`                             |
| 保存・埋め込み映像   | `electron/src/playlistWindow/storage.ts`                                             |
| ウィンドウ・IPC      | `electron/src/playlistWindow/windowManager.ts`、`handlers.ts`                        |
| 書き出し要求の構築   | `src/features/playlist/utils/playlistClipExportBuilder.ts`、`src/shared/clipExport/` |

Storybookの `Workspace/Playlist` 配下でOrganizer/Sorter、Inspector、Paint、長い名称、dark/light、狭い幅を確認します。保存・移行・再生順はdomain test、削除の対象とキーフレームはhook/component testで確認します。実ファイルの参照・埋め込み保存、閉じる際の保存確認、複数ウィンドウ、動画書き出しはElectron実機で別途検証します。[検証方針](testing.md)も参照してください。

関連する設計判断:

- [ADR 0008: Dedicated Sub-Window Runtime and Synchronization](adr/0008-dedicated-sub-window-runtime-and-synchronization.md)
- [ADR 0010: FFmpeg Clip Export Execution Boundary](adr/0010-ffmpeg-clip-export-execution-boundary.md)
- [ADR 0025: Playlist Document Presentation Order](adr/0025-playlist-document-presentation-order.md)

## 外部から開くときの準備完了

プレイリストの新規ウィンドウはpreloadで外部オープン通知を購読してから専用ready IPCを送信し、mainが保持する文書パスを受け取ります。画面の初期化より先に通知を送って文書が空になる競合を避けます。この境界はMac/Windows共通です。
