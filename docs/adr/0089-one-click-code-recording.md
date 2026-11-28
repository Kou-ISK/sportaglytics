# 0089 One-click Code Window recording

## Status

Accepted

## Date

2026-11-28

## Context

[Hudl の Lead Time](https://support.hudl.com/s/article/add-lead-time-to-a-button-sportscode?language=en_US) と [Lag Time](https://support.hudl.com/s/article/add-lag-time-to-a-button-sportscode?language=en_US) では、ラグを有効にしたコードは押下から指定秒数後に自動終了し、再有効化の設定も持てます。既存の SporTagLytics のラグは手動停止後の余白です。既存のウィンドウやホットキーを暗黙に自動終了へ変えるとタグを欠損し得ます。

## Decision

ボタンごとに `recordingMode: 'single-click'` を選択できるようにする。既存ファイルの既定値は手動開始・終了のままにする。1クリックではパッケージの再生位置で締切を判定し、開いている間はラベルを受け付ける。再押下による延長は元の開始を変えず、終了だけを押下位置から指定秒数後まで伸ばす。記録済みの場面は更新しない。別パッケージへの移動で未確定記録を持ち越さない。状態取り出しと確定を動作時に直列化し、React の再実行による二重保存を避ける。

対象を指定するラベルは別の明示設定にする。[Hudl のリンクの説明](https://hudl.hudl.com/en_gb/products/sportscode/tiers) と [付与順の例](https://www.hudl.com/blog/sportscode-building-blocks-script-a-passing-matrix-in-minutes) を根拠に、排他または終了リンクに該当する記録中コードにだけ付与し、終了、次コードの開始の順とする。設定済みのリンクIDを使い、コード名が曖昧なら推定しない。この順序は実ファイルの運用を再現するための実装規則であり、Sportscode のあらゆるリンク・スクリプトの実行順を保証しない。

記録中のキャンバスボタンは、開いているコードウィンドウとボタンIDで識別する。名前を変更しても、進行中の記録は開始時の行名で確定し、結果ラベルはその記録に付く。変更後に開始する記録は新しい行名を使う。他のファイルを開いた際に、コピー元とIDが同じでも記録を引き継がない。これはSporTagLyticsのデータ保護の規則であり、Sportscodeの実行中の改名仕様とは区別する。

旧版が新しい記録・ラベル設定を無視して別の場面を作るのを防ぐため、新設定が有効な `.stcw` は version 2 で保存する。既存ファイルは version 1 のまま読め、新設定を使わなければ保存も version 1 のままとする。

## Consequences

一時停止中は再生位置が進むまで待つ。締切を越えてシークした場合は到達位置ではなく元の締切で保存し、既知の映像終端を越えない。上記はSporTagLyticsのオフライン記録の規則であり、Sportscodeの一時停止・シーク・録画中の細部や、専用形式・スクリプトの互換性を保証しない。
