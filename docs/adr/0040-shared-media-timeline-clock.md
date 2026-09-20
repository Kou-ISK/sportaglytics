# 0040 Shared media timeline clock

## Status

Superseded

Superseded by: [0041 Angle sync point workflow](0041-angle-sync-point-workflow.md)（共通時計の判断は継承し、同期編集の操作単位を更新）

## Date

2026-09-20

## Related ADRs

- Builds on: [0015 Clip timeline placement and audio-assisted sync](0015-clip-timeline-placement-and-audio-assisted-sync.md)
- Builds on: [0016 Multi-angle audio sync offset persistence](0016-multi-angle-audio-sync-offset-persistence.md)

## Context

複数クリップのメイン再生は配置を解決していたが、Playlistはアングルの先頭ファイルに共通時刻を直接指定していた。書き出しも配置だけを合成し、別に保存されたアングル補正を反映していなかった。この違いにより、前半と後半を別々に撮影した映像で、画面と出力の内容が一致しなかった。

再生のために長い連結動画を生成する方法は、追加容量・待ち時間・同期変更時の再生成が必要になる。Playlistへ配置のコピーを永続化する方法も、元パッケージの同期変更と食い違うため採用しない。

## Decision

- ADR 0015/0016の保存契約を維持し、`sourceTime = globalTime + angleOffset - timelineStartSeconds` を共通の `shared/media/mediaTimeline` で解決する。アングル補正は `isAnalyzed` が有効な場合に適用する。
- パッケージの元映像参照から、Mainの `mediaTimelineSource` が現在の配置と同期補正を取得する。読み取り専用の型付き `media:resolve-timelines` IPCでPlaylistへ渡し、sender、件数、パス、配置、重複を検証する。構成が破損している場合は先頭映像にフォールバックせずエラーにする。
- メイン・Playlistとも、元クリップを切り替えて再生する。Playlistは全ソースの読込を待って共通時計を進め、空白を黒画面・無音として扱う。クリップの読込完了、シーク、再生再開で各ファイルの時計を補正する。
- 参照Playlistではアイテムの切替とウィンドウの再フォーカス時に配置を再読込する。遅れて届いた別ソースの結果を破棄する。保存形式やPlaylistの注釈時刻は変えない。
- Paintのフレーム描画は、DOMアダプターがその映像要素・ソースに結び付けた時刻差から共通時刻へ戻す。追尾は元ファイル内の時刻でフレームを読むが、位置キーは従来どおり共通時刻を基準に保つ。別の元クリップへ切り替わる境界を越えて追尾しない。
- 書き出しは同じ配置・補正を使用し、必要な場合だけ一時映像を生成する。正の補正は先頭を切り詰め、負の補正は先頭を黒画面・無音で補う。出力範囲まで映像が足りない場合も末尾を補い、一時ファイルは成功・失敗時とも削除する。
- クリップの手動配置を適用したとき、背後のプレイヤーのローカル時刻からアングル補正を再計算しない。基準と対象に別々の補正がある場合も、共通時刻を経由して配置する。

- 同期編集は通常プレイヤーをunmountした専用ワークスペースで行う。ソースの個別時計を使って同じ瞬間を合わせ、配置の共通時刻に従う連動プレビューで確認する。読込済みdurationと未保存配置を別管理し、metadata通知や組合せ変更で配置を失わない。保存操作だけがパッケージを変更する。

## Consequences

A→B、C→Dの構成で前半・後半の同期差が異なっても、メイン再生、参照Playlist、Paint、単一・全アングル・2画面出力が同じ時刻契約を使う。追加サーバー・有料API・再生用の連結ファイルは不要。

前半・後半の対応の自動判定、同一アングル内で重なる元クリップの自動トリム、録画機器の時計ドリフトの時間伸縮補正は行わない。部分欠落は共通時刻を維持して黒画面・無音で表現する。YouTube自体の動画書き出し制限は変わらない。

回帰試験は合成映像だけで、別々の配置、正負の同期補正、元ファイル境界の切替、Paintのシーク、出力画素・尺を検査する。
