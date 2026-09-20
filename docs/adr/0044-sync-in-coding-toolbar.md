# 0044 Sync in the Coding toolbar

## Status

Accepted

## Date

2026-09-21

## Related ADRs

- Supersedes: [0041 Angle sync point workflow](0041-angle-sync-point-workflow.md)

## Context

アングル単位の同期でも、専用の大きな操作バーとアングル配置行を追加すると、通常のCodingタイムラインとの視覚的な連続性を失う。また、同期専用の数字キーは再生用に変更したホットキーと一致しない。

公式Hudl Supportの同期記事とMoviesのホットキー記事では、通常のタイムラインにあるSync Point / Align Anglesと、設定したアングル切替キーを使う。確認範囲と参照先は[操作仕様](../angle-synchronization.md#hudl-sportscodeとの対応)を参照する。

## Decision

- ADR 0041の共通時計、元動画境界の内部解決、欠落区間、フレームPTS、ドラフトと保存の契約を継承する。
- 同期開始・Sync Point / Align Angles・コマ送りをCodingタイムラインの既存ツールバーへ統合する。同期専用のアングル行は削除し、同期点は既存時間目盛り上へ表示する。
- 追加の映像シークバーと固定の案内バーを設けない。リセット・音声補正・破棄などの副操作はメニューへまとめ、結果・エラーは必要なときだけ表示する。
- 再生と同期のアングルID・表示モードをsharedへ集約する。Settingsの割り当てとdisabled状態を両ウィンドウで同じキー照合関数に渡す。アングル3〜8も同じ設定に追加し、既存のユーザー設定を保持する。
- 通常再生の表示中アングルを同期開始時に引き継ぐ。同じアングルキーを再度押すと全表示へ戻る。
- Controllerと型付きTimeline IPCを状態の正本とし、props-only Viewへ表示とcallbackを渡す。描画は既存semantic tokenを使用する。

## Consequences

Coding行と再生ヘッドの配置を維持したまま同期できる。設定したキーを覚え直す必要がなくなり、前後半や本数の違うアングルの同期・出力契約も維持される。

同期専用の配置トラックは表示しないため、映像のない区間は映像面の黒表示で確認する。リセット等の副操作にはメニューを開く操作が必要になる。
