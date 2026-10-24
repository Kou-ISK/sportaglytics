# 0077 Demand-driven playback ranges

## Status

Proposed

## Date

2026-10-24

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- Related: [0073](0073-verified-playback-cache-foundation.md), [0074](0074-bounded-cache-hardware-compatibility.md), [0054](0054-continuous-capture-playback.md)

## Context

全尺の派生動画を生成し、内容を全走査してから使う方式は、長い原本の初回待ち時間と容量を尺に比例させる。既存の短尺制限を外すだけでは、通常利用の開始時間を改善できない。内容proofの再利用は既存候補の待ちを減らすが、初回生成や原本・候補の全hashは残る。

## Decision

必要な再生・seek範囲と近傍だけを準備し、一つのMediaSourceへ検証済みfragmentを供給する方式を検討する。製品への有効化はまだ行わない。既存の原本保持、全表示field、全音声、原本時計、タグ・保存・exportの契約は維持する。

| 選択肢                           | 判断                                                                                   |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| 全尺MP4を先に作る                | 任意の事前準備には使えるが、長尺再生開始の必須条件にしない                             |
| 区間MP4のsrcを繰り返し切り替える | decoder・音声・ready状態が境界で再初期化されるため、連続再生の本線にしない             |
| 単一MSEと有界な区間キャッシュ    | まず同じElectronで複数音声・時刻・境界再生の成立を確認する                             |
| OSネイティブ再生面               | 既存の接続実装がなく、時計・音声・表示・配布の変更が大きい。能力を推定せず別途評価する |

実装順序は以下とする。

1. 検証済み短尺を無再圧縮でfragment化し、全packet・codec設定・音声track・side data・edit listによる時計を照合する。隔離したMSEで先頭の隣接fragmentとbuffer内seekを確認する。これはfield変換速度や実音声同期の試験ではない。
2. 元のfield符号化短尺から隣接2区間を生成し、要求範囲とdecode依存範囲を分離する。参照frame、deinterlacerの前後依存、AAC packetの所有を証明し、結合時の全field/音声の重複・欠落を拒否する。
3. 初回表示時間と持続生成速度の成立後に、世代付き要求集約・先読み・容量制限と共通時計への接続を実装する。最遅の工程が1倍速に届かなければ、先読み量だけで解決したとしない。

既存captureの`timestampOffset=clipStart`を絶対PTSのfragmentへ転用すると時計が二重加算される。captureの待機除外も、新しいcacheの未準備範囲に流用しない。原本durationが時間幅の場合と絶対提示終端を区別し、観測結果に合わせた未知offset補正で合格にしない。

最初の基盤は`cacheMp4Boxes`の有界box先頭読込と`cacheFragmentLayout`の連続byte範囲に限定する。整数overflow、範囲外、未知配置、開放長、過大init/fragmentを拒否する。これは構造だけの型であり、内容・時刻・ランダムアクセス・HW・採用proofとして扱わない。既存closed-MP4検査でも同じheader readerを使う。

将来の範囲proofは、対象packet/config/indexと依存閉包を結合し、未読領域を全尺検証済みと宣言しない。fd/pathのrevisionを使用前後で照合し、workerが実際に読むbytesへ結合する。変更・交換・不完全記録・build/recipe/runtime差は無効化する。statだけの永続proof再利用は認めない。

最新seek要求と生成jobの所有を分け、同じ範囲の要求は集約する。別範囲への移動は旧workerの終了・片付け確認後に最新1件へ進む。stale結果は選択状態を更新しない。依存入力、出力、ready cache、SourceBufferのbytesを合わせて制限し、使用中範囲をevictionしない。取消やcloseの結果不明時は所有を保持し、新jobと終了を止める。

## Consequences

- UI、IPC、保存形式、既存短尺制限は今回変更しない。未準備時に待機を隠す、frame rateを下げる、ドラッグ中のコマ表示を止める対応はしない。
- 未準備/生成失敗は状態を明示し、原本へ戻せることが必要。最後のframeを保持するだけではドラッグ中の更新や滑らかさの合格にならない。
- 初回5秒以内、準備済みseek p95 250ms以内、未準備seek 5秒以内、1倍再生に対し生成1.25倍以上、5分連続の追加waiting/drop/underflowなしを暫定の工学目標とする。未測定であり、保証値・達成値ではない。実音声同期、物理scrub、多アングル、長尺は別の実機ゲートである。
- パッケージ履歴directoryのI/O遅延は別の阻害要因として扱い、取消の成功を読込速度の改善に数えない。

## References

- [ISO BMFF byte stream format](https://www.w3.org/TR/mse-byte-stream-format-isobmff/): init/media segmentとedit listの要件。bundled runtimeの能力保証ではない。
- [Media Source Extensions](https://www.w3.org/TR/media-source-2/): track/時刻/SourceBufferの仕様。実装対応は別に検証する。

## Controller foundation

区間transportの寿命とseek要求の寿命を分ける。`SourceBufferTaskQueue`はappend/removeの端末イベントを所有し、error・abort・期限だけで次の操作へ所有を渡さない。期限後も`updateend`または実`sourceclose`までdrainを待つ。`PlaybackRangeBuffer`は検証済みindexとID指定readerを受け、最新要求へ集約する。読込中とnative処理中のbytesを容量に含め、現在映像と必要依存区間をevictionから保護する。容量不足・native coverage喪失は有限の失敗とし、同じ処理の無制限再試行をしない。

共通時計との境界はvideo要素と正確なblob URLに束縛したregistryである。停止中も要求を配送し、再生中は元のsource時刻に対応するcoverageとnative decode状態を確認する。captureの既存blob例外を再利用しない。registryのcleanupは後継登録を解除できず、原本URLや他アングルには適用しない。

これはRenderer側の基盤であり、通常の採用操作からの有効化はまだ行わない。Mainの検証済みartifact/read lease、IPCのSession束縛、MSEの作成・切替ACK・原本復帰と結び付くまでは製品統合の完了ではない。source generationはindexと同じ寿命を持ち、採用ticketを読込leaseの代わりに使わない。既存の原本・タグ・保存・書き出しは引き続き変更しない。
