# 0053 Live capture on the package timeline

## Status

Accepted

## Date

2026-09-22

## Related ADRs

- Related: [0008](0008-dedicated-sub-window-runtime-and-synchronization.md), [0015](0015-clip-timeline-placement-and-audio-assisted-sync.md), [0010](0010-ffmpeg-clip-export-execution-boundary.md)
- Supersedes: N/A
- Superseded by: N/A

## Context

撮影中にもコードを記録し、直前の場面をレビューする必要がある。USBキャプチャとIP配信は入力APIが異なるが、再生・コードの時計・保存・書き出しを別々に実装すると、後処理で時刻の変換や再インポートが必要になる。長時間の未確定MP4を再生対象にすると異常終了やOS間互換性の問題も生じる。

## Decision

Mainが録画セッションとFFmpeg子プロセスを所有し、約2秒ごとに再生可能なMP4を確定して標準パッケージの各アングルへ追加する。USB入力は専用RendererでgetUserMedia / MediaRecorderを使い、順序付き・容量制限付きIPCでMainへ渡す。IP入力はMainのFFmpegが直接取得する。録画URLや認証情報は保存モデルへ含めない。

通常の映像・Timeline・Code Windowと共通時刻を再利用する。再生済み・保存済みの時計をコードの基準とし、プレビューや壁時計を新たな状態源にしない。過去へのシークは録画を止めず、ライブへの移動だけを追加する。再接続は経過時間に基づく空白を残す。録画中の配置同期は排他とし、終了後の標準同期機能へ委ねる。

カメラ権限は専用の非永続sessionに閉じ込め、録画操作IPCのsenderとmain frameを検証する。書込・再接続・終了は直列化し、他の文書のTimeline保存を変更しない。新規パッケージ作成は排他的に行う。

## Consequences

録画中の分析結果を通常の保存・Playlist・書き出しへ継続利用でき、接続が切れても確定済みの区間を保護できる。サーバーや専用モバイルアプリは不要だが、取り込み元のプロトコル、機器ドライバ、ネットワーク条件に依存する。デバイス側の変換とH.264化に処理負荷・遅延があり、原画の無再圧縮取り込みや機器間の自動同期は保証しない。

[操作・対応条件・検証](../live-coding.md)を仕様の正本とする。
