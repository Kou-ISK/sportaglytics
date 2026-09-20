# 0039 Local tactical board and frame-scoped pitch calibration

## Status

Accepted

## Date

2026-09-20

## Context

ADR 0029の4点較正は任意の長方形を測るモデルで、映像内の範囲を全体ピッチへ配置する情報を持たなかった。戦術説明には編集可能な俯瞰配置が必要だが、運用サーバーや映像の外部送信を増やさない。汎用人物検出だけでチーム・遮蔽・空中位置や動くカメラまで正しく復元することはできない。

## Decision

- 既存の較正へ任意のピッチ内 `region` とクリップ相対秒の `referenceTime` を追加する。region省略時は既存の幅・長さで平面全体を表し、過去のデータを再解釈しない。参照時刻がない既存較正も読み込めるが、認識の前に現在フレームで確認する。
- 較正と戦術盤の時刻はクリップ先頭を0秒とし、参照/埋込映像のソースパスや開始位置に依存させない。別フレームへの無条件再利用はせず、線の一致を確認するか再較正する。
- `ItemAnnotation.tacticalBoard[target]` に1枚の静止盤を持ち、m座標・所属・ラベル・矢印を保存する。既存注釈・反対アングルは保持する。任意フィールドの追加としてschema version 2を維持し、不正値は読込で拒否する。
- Viewはpropsだけで描画する。編集Hookが一操作一履歴を持ち、確定時にPlaylistの一履歴へ統合する。動画読取・モデル・PNG保存はGatewayへ分離する。
- 停止フレームに限って同梱のMediaPipe Tasks Vision / EfficientDet-Lite2 INT8をCPU実行する。全体+4分割と重複抑制の後、足元を較正平面へ射影する。チーム・個人は識別せず、ユーザーが候補を明示的に追加・修正する。新しい実行時ネットワーク・サーバー・汎用IPCは追加しない。
- MediaPipeは外部利用統計送信を含まない0.10.21に固定する。1.0.1は検証で統計送信の試行を確認したため採用しない。更新時は同じ通信遮断E2Eで送信試行も検証する。
- npm版・モデルrevision・SHA-256を固定し、ビルド時にモデル取得・WASMコピー・権利表示を行う。実行時は配布資産だけを読み込む。

## Consequences

オフラインで手動編集と認識支援を使える一方、配布容量がモデルとWASM分増える。認識は画質、選手サイズ、遮蔽に依存し、候補数を実選手数とみなさない。ボールは地面上の近似に限る。連続的な俯瞰追尾、自動ピッチ線検出、カメラ較正補間、戦術盤動画は別の機能・評価が必要である。ADR 0029の描画/動画合成契約は維持する。

## References

- [MediaPipe Object Detector](https://developers.google.com/edge/mediapipe/solutions/vision/object_detector): 入出力、COCO学習モデル、Lite2の精度/速度の特性。
- [Hudl Studio release notes](https://www.hudl.com/releases/studio): 戦術盤・較正点・フレーム確認の参考。UI素材・独自モデルは利用しない。
- [Paint仕様](../tactics.md)
