# 0009 Timeline Import/Export Interoperability

## Status

Accepted

## Date

2026-05-06

## Context

Timelineの場面、行、ラベルを外部形式で扱う際は、保持できる情報と操作の対象を明確にする必要があります。既存のSCTimeline converterはJSON bytesを扱います。これをXMLと表記すると、公式Sportscode Edit List XMLやネイティブパッケージを読めると誤認させます。また映像と時刻の対応を推測して既存分析へ上書きすると、誤ったCodingと原本喪失につながります。

## Decision

- `.stpkg`内のversion 2 Timeline（rows / instances）を完全な内部文書とする。既存のJSON配列・CSV・SCTimeline JSON exportは場面中心であり、空行や行固有IDの完全バックアップではない。
- CSVはType/Result以外のラベル群と内部metadataを保持しない。SCTimelineはpure JSON converterへ閉じ込め、UIもJSONと明記する。外部Sportscode実機往復とXML出力は検証済みとして扱わない。
- 既存TimelineへのJSON/SCTimeline importは、既知形式を確認して場面一覧を置き換える。暗黙mergeしない。旧actionType/actionResultはlabelsへ移す。
- 公式Sportscode v10のEdit List XML仕様を基にした別経路を用意する。ユーザーがXML、映像1本、秒数補正、警告を確認し、既存分析を更新せず別の新規`.stpkg`を作成する。
- XMLのID・小数秒・code・label text/group・free_text・行順/色を保持する。開始日時から秒補正、前後半、ファイル位置を推測せず、負時刻・逆転・映像尺超過を切り詰めない。
- DTD/ENTITY・namespace・未対応属性/version・壊れたXML・重要構造不明は拒否する。補助フィールドの非対応は警告し、明示確認を求める。`.scpkg` / `.sczip`は未対応であり、拡張子変更や内部ファイル推測を行わない。
- Domainのpure parser、Hookの入力/確認/取消、props-only View、Gateway/専用IPCのI/Oを分ける。Mainはsender/request・v2文書・XML hash・映像参照/尺・保存先/容量を検証する。XML parser自体はRenderer側に置く。
- 元XML/映像は保持し、一時保存先へのcopy/probe/文書保存を検証してからrenameで新規完成する。既存保存先を上書きしない。取消・失敗は一時結果を除去する。

具体的なsubsetと制限は[パッケージ互換とXML仕様](../package-compatibility.md)を正本とする。一次資料は[Hudl公開のSportscode v10マニュアル](https://static.hudl.com/craft/SportsCodeManual-2.pdf)のXML仕様である。非標準の旧XMLを自動補修しない。

## Consequences

- XMLとSCTimeline JSONの操作と責務が明確になり、既存分析と原本を保持できる。
- 意図した映像・秒数補正を確認する操作が増えるが、時刻の推測による誤Codingを避ける。
- 合成XML/映像のunit・Electron回帰を整備できる。全歴代Sportscode版やネイティブ形式の互換、実OS picker、強制終了・停電時の耐久性は追加検証が必要となる。

Sportscode XMLのscalar leafに付いた単位・version等の属性は推測しない。秒数として受け付ける既知構造に属性があれば拒否する。取り込んだラベルのgroup名はcanonical文書で保持し、旧SporTagのgroup名変換へ渡さない。
