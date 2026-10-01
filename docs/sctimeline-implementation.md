# SCTimeline JSONとSportscode XML

SCTimelineとXMLは別の入力経路です。SCTimelineは既存の`timeline.rows[].instances[]` JSON converterであり、メニューは「SCTimeline（JSON）」と表示します。XML bytesの出力やSportscodeネイティブパッケージへの書き込みを実装するものではありません。

## 既存TimelineへのJSON取り込みと出力

`timelineImportExportService`がJSON配列を先に判定し、SCTimeline JSON構造をfallbackとして扱います。成功すると現在の場面一覧を置き換え、暗黙mergeはしません。通常JSON入力は時刻・ID・ラベルを検証してから正規化します。旧actionType/actionResultはType/Result labelsへ移します。

JSON・CSV・SCTimelineの既存exportは場面中心です。version 2の空行、行の固有ID、順番・色の完全バックアップではありません。CSVはType/Result以外のラベル群や内部メタデータを保持しません。完全な分析を保管・移動するときは`.stpkg`を保存してください。SCTimelineでの外部Sportscode実機往復は未検証です。

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
