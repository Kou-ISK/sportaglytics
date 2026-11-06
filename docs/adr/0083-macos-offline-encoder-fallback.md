# 0083 macOS offline encoder fallback

## Status

Accepted

## Date

2026-11-06

## Context

配布版FFmpegは外部H.264 encoderを含まず、macOSのVideoToolboxを使う。従来の設定はハードウェアを必須にするため、利用できない環境では動画書き出しと新規のPlaylist埋め込み変換が失敗する。録画はリアルタイム性と資源条件が異なる。

## Decision

オフラインの書き出し・埋め込み変換では、固定版FFmpegの`-allow_sw 1`を使い、VideoToolboxのハードウェアを有効に保ちながらソフトウェアの使用も許可する。実際の選択はOSに委ね、ソフトウェアを強制しない。既存のbitrate、profile、画素形式、出力検証とエラー処理を維持する。録画のencoder設定は変更しない。

## Consequences

ハードウェアが使えない環境でもOSのソフトウェアencoderがあれば処理を続行できる。CPU使用量と処理時間は増える場合があり、encoderの出力画質や速度は実測する。どちらも利用できない場合は従来どおり失敗し、部分出力を正常な最終結果として扱わない。`allow_sw`の指定だけでは実際にどちらが選ばれたかや、全環境で使えることを証明しない。
