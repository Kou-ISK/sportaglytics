# 0080 Apple player playback

## Status

Accepted

Supersedes [0078 Native playback authority](0078-native-playback-authority.md).

## Date

2026-10-27

## Context

独自FFmpeg復号・全fieldフィルタ・PCM窓・供給回復は、Appleの標準再生で原本を快適に扱うという目的に対して処理と保守の負担を増やした。画面の方式選択・コピー操作・常時警告も元の分析作業を妨げる。非公開の他製品内部を模倣したと主張せず、公開APIと原本の実測を判断根拠にする。

## Decision

AVPlayerへ読み出し・復号・音声・時計を委譲する。AVPlayerItemVideoOutputのclock-selected画像を既存の有界IOSurface橋渡しへ渡し、DOM overlay・全画面・分析UIを保持する。Mainの文書/IPC/終了所有権と安全な内部fallbackは維持し、独自供給pipelineと全field処理を再生の前提にしない。

通常スクラブは近傍画像を高速表示し、離した後は実際の確認時刻から進む。zero-tolerance seekはコマ送りや明示時刻指定に限定する。タグ・保存は要求値でなく確認時刻を使用する。方式や診断は通常操作として表示しない。

逆方向キー解放では新しい入力を止め、最後の要求を完了させる旧操作を維持する。表示画像へ戻す方式は、押下中に復号が完了しないと全入力を消す退行を生じた。表示枚数によって停止先を変える例外も操作を不定にするため採用しない。操作revisionと開いているownerを確認し、別操作・文書交代・復帰を妨げない。解放専用の画像時刻保持とpreload APIを除去し、時計は確認応答でのみ進める。これは要求消失の修正であり、押下中の表示不足や解放後の復号待ちを解消する判断ではない。

## Consequences

Macの現表示profileから段階的に適用し、非対応構成とWindowsの既存機能を保持する。Apple内部bufferや物理画面品質は自前queue上限だけでは保証できない。原本の実操作、音声・長時間品質、既存描画/export、署名packageを別々に確認する。旧releaseと原本を保持し、新経路のbuild成功を公開合格と扱わない。詳細は[仕様](../native-playback.md)を正本とする。
