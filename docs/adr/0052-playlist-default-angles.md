# 0052 Playlist default angles

## Status

Accepted

## Date

2026-09-22

## Context

Playlist全体の表示アングルだけでは、クリップごとに最適な画角を選んだレビュー映像を再現できない。再生時に見たアングルと、単一ファイルの映像出力を一致させる必要がある。

## Decision

Playlist v5の各itemにdefaultAngleを保存し、未設定の旧itemはangle1へ移行する。既存の2アングル構成とPaintのprimary/secondary対応を維持する。Inspectorのprops-only Viewで既定値を選択し、履歴hookで保存・Undo/Redoする。クリップ進入時には既定値を表示する。一時的なプレビュー切替と既定値の変更は分離する。

書き出しの「各クリップの既定アングル」は共有のrequest plannerでitemごとのangleTypeへ解決し、単一出力requestを生成する。Mainの既存の区間・同期・Paint処理へ同じ選択を渡す。テキストプレビューも同じplannerを使う。固定アングル指定は全クリップへ適用し、2画面合成では個別のangleTypeを解除する。映像が不足しても他のアングルへ黙って置き換えない。

## Consequences

編集したレビュー意図を再生・保存・書き出しで維持できる。旧ファイルは最初のアングルで再生する。3・4アングルのPlaylist/Paint保存モデルへの拡張は別の契約変更となる。実FFmpeg出力の画素とUIの連続再生を検証し、アングル2を選んだ場合の再生時計・音声も確認する。

[Hudlの書き出し仕様](https://www.hudl.com/blog/hudl-sportscode-update-august-2020) / [Playlistの操作契約](../playlist-features.md)。
