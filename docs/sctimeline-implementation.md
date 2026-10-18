# SCTimeline JSONとSportscode XML

SCTimelineとXMLは別の入力経路です。SCTimelineは既存の`timeline.rows[].instances[]` JSON converterであり、メニューと保存ダイアログは「SCTimeline（JSON）」と表示します。既定の出力名は`timeline.SCTimeline`です。旧既定名`SportscodeXML.SCTimeline`から名前だけを変更し、JSON構造・拡張子・読み込み条件は変更しません。XML bytesの出力やSportscodeネイティブパッケージへの書き込みを実装するものではありません。

## 既存TimelineへのJSON取り込みと出力

`timelineImportExportService`がJSON配列を先に判定し、SCTimeline JSON構造をfallbackとして扱います。成功すると現在の場面一覧を置き換え、暗黙mergeはしません。通常JSON入力は時刻・ID・ラベルを検証してから正規化します。旧actionType/actionResultはType/Result labelsへ移します。

JSON・CSV・SCTimelineの既存exportは場面中心です。version 2の空行、行の固有ID、順番・色の完全バックアップではありません。TimelineメニューのCSVはType/Result以外のラベル群や内部メタデータを保持しません。分析画面のデータCSVは全ラベル群の列を含みますが、これも完全バックアップではありません。完全な分析を保管・移動するときは`.stpkg`を保存してください。SCTimelineでの外部Sportscode実機往復は未検証です。

## 表計算ソフト向けCSVの文字列

Timeline、分析データ、マトリクスのCSVは、文字列をダブルクォートで囲み、内部のダブルクォートを二重化します。セルの先頭が`=`・`+`・`-`・`@`または全角の`＝`・`＋`・`－`・`＠`になる文字列には、先頭にアポストロフィ`'`を付けます。先頭の空白やBOMに続く記号、先頭の空白に続くタブ・改行・復帰も対象です。区切り文字・改行は引用したセル内に保持します。

例えばノートの`=1+1`はCSVでは`"'=1+1"`となります。先頭の`'`はソフトによって表示され、プログラムで読み込む場合には値の一部になります。文字列の`-2.5`にも接頭辞が付きますが、マトリクスの数値や分析データの秒数・件数は元の数値表現を保ちます。アプリ内のノート、保存済み`.stpkg`、JSON/SCTimeline出力は変更しません。正確な文字列の交換にはJSONを、完全な分析の保管には`.stpkg`を使ってください。マトリクスのXLSXは文字列セルと数値セルを区別し、CSV用接頭辞を追加しません。

これは式としての解釈を抑える出力処理です。すべての表計算ソフトや、編集・再保存後のCSVの挙動を保証するものではありません。表計算ソフトで読み込む際は文字列列として扱い、再保存したCSVを共有するときにも出力内容を確認してください。[OWASPのCSV Injection解説](https://community.owasp.org/attacks/CSV_Injection)も、ソフト間の違いと再保存で保護が失われる制限を説明しています。自動試験では出力bytes・引用・数値保持・元データ不変を検査し、Excel/LibreOffice実機での式実行は検証していません。

| 責務                   | 正本                                                                |
| ---------------------- | ------------------------------------------------------------------- |
| 型                     | `src/types/timeline/sportscode.ts`、`core.ts`                       |
| pure JSON converter    | `src/utils/scTimelineConverter.ts`                                  |
| serialize / format選択 | `src/features/videoPlayer/app/utils/timelineImportExportService.ts` |
| native I/O             | 同featureのgatewayと`window.electronAPI`                            |

## Sportscode公式Edit List XML

XMLは起動画面の専用操作で、明示的に選んだ映像と秒数補正から別の新規`.stpkg`を作ります。既存Timelineへの上書きとは分けます。フィールド対応、拒否条件、原本保護、検証限界は[パッケージ互換とXML仕様](package-compatibility.md#sportscode-xmlから新規作成)を正本とします。

Rendererの`Setup/SportscodeImport/domain`がXMLを解析し、Hookが入力・確認・取消を管理し、Viewはpropsだけで描画します。Gatewayと専用IPCがbounded XML読取・hash確認・動画copy/probe・容量確認・完成renameを担当します。Mainはsenderとrequest、version 2文書、原本hash・映像範囲を検証します。XML parser自体はRenderer側です。

設計判断は[ADR 0009](adr/0009-timeline-import-export-interoperability.md)、検証入口は[Testing](testing.md#パッケージ互換と保存保護)を参照してください。
