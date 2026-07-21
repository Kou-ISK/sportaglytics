# 0013 Multi-angle media source model

## Status

Accepted

## Date

2026-07-19

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A

## Context

従来のパッケージは `tightViewPath` / `wideViewPath` と、各アングルにつき1本の `relativePath` を前提としていた。この形では3アングル以上、収録が分割された複数クリップ、YouTube URLを同じパッケージ契約で扱えない。Renderer 側だけで断片を切り替える方式は、共通シーク、音声同期、クリップ書き出しの時刻契約を複雑にする。

## Decision

- `.metadata/config.json` の `angles[]` を正本とし、各要素に順序付き `clips[]` を保存する。
- 1パッケージは最大8アングル、1アングルは最大16クリップとする。
- ローカル複数クリップは main process の media composition service で1本の再生用映像へ正規化する。`gapBeforeSeconds` は黒画面と無音で埋め、元クリップのコピーも `videos/sources/` に保持する。
- YouTube はダウンロードせず `sourceKind: youtube` と URL を保存し、Video.js の YouTube tech で再生する。YouTube アングルは1 URLに限定し、自動音声同期は2アングルともローカル映像の場合に限定する。3アングル以上は各先頭クリップの `gapBeforeSeconds` で共通時刻軸へ合わせる。
- `tightViewPath` / `wideViewPath` は旧パッケージ互換の派生フィールドとして保存する。旧形式はロード時にアングル配列へ変換する。

## Consequences

- 3アングル以上でも既存の共通再生面に表示でき、ローカル断片は既存タイムラインの単一時刻軸を維持する。
- 複数クリップのパッケージ作成は FFmpeg 再エンコードを伴うため、時間と追加容量が必要になる。
- YouTube の可用性はネットワーク、動画の公開状態、埋め込み許可に依存する。複数YouTubeクリップの連結、YouTubeとローカルの混在シーケンス、自動音声同期は対象外とする。
