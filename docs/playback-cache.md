# 再生用コピーの基盤と有効化条件

本書は CACHE-1 の設計・実装範囲を記録する。現時点ではジョブ制御・検証契約・propsだけで描画するViewに加え、取消可能な全体hashとMain用filesystem保存adapterを実装している。保存adapterは一時ファイルによる回帰でjobへ接続し、通常アプリからは呼んでいない。本番FFmpeg・全列validator・IPC・再生ソースへのadapterは未接続であり、通常アプリは変換を開始せず原本を再生する。再生改善・実音声同期・物理scrubを確認済みとは扱わない。[ADR 0073](adr/0073-verified-playback-cache-foundation.md)。

## 原本と時計

原本のパス、パッケージのconfig、タグ、同期補正、Playlist参照、書き出し元を変更しない。再生用コピーは端末内の削除・再生成可能な派生物とする。既存の `sourceTime = globalTime + angleOffset - timelineStartSeconds` をそのまま適用できるコピーだけを受け入れる。blob録画・YouTube・収録中の可変ファイルは対象外とする。

フィールド符号化は全フィールドの表示時刻を保持したprogressive動画へ変換する。固定fpsへの間引き、タグ時刻の倍率変更、音声の再サンプルで辻褄を合わせない。fpsの有理数、表示フレーム数、全表示PTS/duration列（末尾フレームの終了時刻を含む）を正規化した有理秒で比較する。音声は全trackを順序と対応を保ってcopyし、全packetのPTS/DTS/duration、payload、codec設定・channel layout・sample rate・言語/既定track属性を比較する。`CacheTimingProof`のdigestはこの完全な列の証明であり、先頭・末尾・平均fpsだけで生成してはならない。

原本の全体hash・サイズとrecipe版、実行環境を期待値へ固定する。検証はMainが実データから計算し、原本が処理中に変わった場合、track欠落、時刻不一致、ソフトウェアfallback、runtime変更を拒否する。JSONに書かれた成功値やRendererから渡されたboolを検証結果としない。実装済みpolicyは信頼できるvalidatorの結果を照合する境界であり、validator自体やHW再生の実装ではない。

## 容量・取消・失敗

- サンプルの実測時間・容量を尺へ比例換算して「推定」と表示する。検証に必要な追加読込時間、素材によるbitrate変動、他処理の負荷は別途見込む。全長の保証値・完了予定時刻としない。
- 明示した容量上限と空き容量のreserveを先に確認する。runnerは同じ上限/reserveを受け取り、実際の出力増加と空き容量を監視して停止する。推定だけで容量を保証しない。既存コピーや原本を自動削除して容量を捻出しない。
- Mainが専用cache root内にjob固有のstagingを作る。原本、package、外部指定pathを出力先にしない。symlinkを追わず、失敗時は自分のstagingだけを片付ける。
- 取消は変換・検証へ伝える。所有するworker/processの終了を確認するまで次のjobを開始せず、遅い成功やprogressを無視する。片付けが失敗したら状態を保持し、明示的な片付け再試行が成功するまで再変換しない。
- 全検証後、immutableなartifactとmanifestを同じ単位でatomicに公開する。公開中は取消を受けず、公開完了だけで再生対象を変更しない。公開失敗・途中終了のstagingは採用不可とする。再起動時にready以外を採用せず、原本hash/recipe/runtimeが一致しないreadyも無効とする。保存adapterは同じroot内のrenameでmediaとmanifestを一緒に公開する。電源断後の永続性を保証するものではなく、消失・不完全な候補は再生へ採用しない。

## 実装済みの保存adapterと境界

`sourceIdentity.ts`は既存Sessionが許可した、録画中ではない通常ファイルをread-onlyで1MiBずつ全体hashする。中止時はhandleを閉じ、読込中のサイズ・inode・mtime/ctime変更、パス差替え、symlinkを拒否する。hash対象の権限・録画中判定はMainの呼出側が行う。原本を再度識別する工程を省略しない。

`openPlaybackCacheStorage`のparentはMainが選ぶアプリ専用data領域に限定し、packageやRenderer入力を渡さない。`playback-cache-v1`内で同Mainの複数Window/adapterを通じて1writerとし、別Main processは別rootを使う。上限と空き容量reserveは必須引数であり、無制限の既定値は持たない。既存readyと中断stagingを総容量へ数え、自動削除しない。`capacity`は生成前に、`checkBudget`は生成中の所有runnerが定期的に確認する。**runnerによる監視・停止はまだ未接続**であり、保存adapter単体を実変換中の容量強制保証としない。

生成先はjob固有の固定名だけをMainに渡す。停止済みworkerの出力に対し、取消可能な`seal`で時刻/音声/HW proofと実出力の全体SHA-256を結合し、media/manifestをsyncする。validatorの`outputSha256`は同じ出力から計算する。長いhash検査を取消できない公開段階へ移さない。`publish`はseal後の変更と容量を再確認してrenameし、既存の公開先は置換しない。公開後はそのjobの`discard`でも削除しない。

失敗時は所有するstaging内の既知2ファイルだけをunlinkし、再帰削除しない。未知ファイルやdirectory差替えで片付けを拒否した場合、writer所有を保持し、片付け再試行が成功するまで新jobを受けない。中断した別jobのstagingは採用・自動削除せず、容量へ数える。再起動後の中断jobの所有確認と明示的な削除UIは未実装である。

`inspectCandidate`はopaque IDのreadyだけを読み、期待原本/recipe/runtimeキーと実bytes/hashを照合する。これは**候補の整合検査**であり、書換え可能なmanifestを時刻・音声・HWの証明として信頼しない。再生へ採用する前にMain validatorが実内容を検証する。candidateの一覧・再起動時の自動再利用・既存readyの削除はまだ接続していない。ここでの差替え防止はアプリ所有のprivate領域を前提とし、同じOSユーザーによる敵対的な全path操作を原子的に隔離する仕組みではない。

## 操作

準備中も原本で作業でき、進行・取消・失敗・片付けの再試行を表示する。完成後の明示選択は一時停止中に行い、共通時刻と音声選択を保持する。選択後は「原本へ戻す」を常設する。ドラッグ中の映像フレーム表示を維持し、waiting表示を隠したり固定待機時間を増やしたりして合格としない。

## CACHE-1 activation gate

この作業票の担当はmaintainers、基盤だけを置く期限は2026-10-30（merge/release前に再確認）とする。

1. 同梱FFmpegのfield-rate filter/encoder/全track copy能力と配布由来を確認し、容量監視・所有process取消を実装し、実装済み保存adapterを接続する。任意コマンド/pathを受けるIPCは追加しない。
2. 全列を計算するvalidatorと、原本identity・再起動復旧・削除/再生成・同時job/複数Windowのテストを追加する。source指定は既存Sessionの許可された動画だけに限定する。
3. 合成field/VFR/非ゼロPTS/複数音声/多角度/複数clip/blob除外を検査し、既存タグ・出力・保存の不変を確認する。
4. 調整済み実機試験でHW継続、再生drop/waiting/underflow、停止seek・押下中フレーム・最終位置・再開、実音声同期を比較する。計測APIによる合成入力と物理操作の成績を区別する。
5. 全長作成の実行範囲・所要時間・容量を別途確認する。通常のコード/合成テストの承認を、全長変換・原本置換・新アクセス権限・外部送信の許可と解釈しない。

本番adapter未接続の基盤はこの作業票に紐づく一時的な段階実装である。[例外台帳](architecture-exceptions.md)を参照。再生効果が未確認のまま通常リリースしない。
