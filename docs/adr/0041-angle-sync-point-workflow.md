# 0041 Angle sync point workflow

## Status

Superseded

Superseded by: [0044 Sync in the Coding toolbar](0044-sync-in-coding-toolbar.md)

## Date

2026-09-20

## Related ADRs

- Builds on: [0015 Clip timeline placement and audio-assisted sync](0015-clip-timeline-placement-and-audio-assisted-sync.md)
- Builds on: [0016 Multi-angle audio sync offset persistence](0016-multi-angle-audio-sync-offset-persistence.md)
- Supersedes: [0040 Shared media timeline clock](0040-shared-media-timeline-clock.md)

## Context

個々の元動画を基準・対象として選ぶ同期画面は、同一カメラの連続収録を一つのアングルとして扱う操作と一致しない。また、固定fps換算でのコマ送りは異なる録画形式を正しく扱えず、最低高さの大きい同期パネルは横長の映像ウィンドウ内で収まらない。

現在提供されているHudlの操作説明は、各アングルでSync Pointを指定してAlign Anglesを実行し、前後半でも同じ操作を繰り返す方式である。参考資料と確認範囲は[アングル同期仕様](../angle-synchronization.md#hudl-sportscodeとの対応)へまとめる。

## Decision

- ADR 0040の共通時計、Playlist、Paint、書き出しの契約をすべて継承する。変更するのは同期編集の操作単位とフレーム送りである。
- 同期点・コマ送り・保存は既存タイムラインに置く。映像用の追加シークバーは設けず、両ウィンドウからの操作を一つのControllerと型付きTimeline IPCへ集約する。アングルの表示切替はキーボードで行う。
- 編集も一つのアングルに一つの連続時計を持ち、元動画の切替を内部で解決する。UIに元動画の組合せセレクターを出さない。
- 未同期時は各アングルの映像を隙間なく並べる。同期点同士は元ファイル番号に依存せず、片方の1本目と他方の2本目も対応できる。同期で生じた欠落区間は既存の仮想タイムラインで黒・無音として再生・書き出しする。
- 各アングルの同期点は元動画IDとソース内時刻で保持する。アングル1を固定し、対象の同期点を含む区間から後続を移動する。先行区間との重複は拒否する。
- 先頭補正で負になる開始位置を既存のアングルオフセットへ正規化し、配置と補正を単一の設定保存に含める。既存の保存モデルは拡張しない。
- ローカル動画は現在位置付近のPTSを制限付きIPCで取得してコマ送りする。YouTubeで同等の精度を保証できない場合はfpsを推測しない。
- 動画の数・単一表示に応じた映像面の縦横比と、操作バーの実寸でOSウィンドウを調整する。Viewはpropsのみで構成し、実ウィンドウの比率もE2Eで確認する。

## Consequences

前半A/Cと後半B/Dを利用者が元ファイルとして選ばずに合わせられる。追加のサーバーや再生用の連結動画は不要。先頭の負補正も再生・出力の共通時計に乗る。

元動画の切替時には読込待ちを必要とする。区間の重複を解決するトリムや映像速度の伸縮は含まない。公式の操作説明への対応と、最新製品の外観の完全一致は区別する。
