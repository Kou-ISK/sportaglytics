# 0079 Qualified native clip export

## Status

Accepted

## Date

2026-10-27

## Context

macOSの既存exportはVideoToolboxを使用するが、音声付き部分区間やB-frameでは正確さを優先して再圧縮している。合成不要な区間で不要な映像再圧縮を避けたい。一方、passthroughの完了やcontainer durationは、表示frameやAACの境界一致を保証しない。元映像と別時計のprepared source、複数区間の結合、音声選択も維持する必要がある。

## Decision

Main専用のoptional exporterをprepared source確定後に差し込み、native helperの完了と独立qualificationを分離する。macOS arm64の署名済み固定helperの独立exportモードへproviderを接続する。検証済みの入力条件と提示区間のmetadata照合を通常の適格判定とし、開発時の画像・PCM照合を毎回の処理へ持ち込まない。対象は合成なしの単一区間の最終出力に限定し、既存concatへのnative中間出力は認めない。その他は従来のFFmpeg経路を保持する。

source revision確認、子プロセスclose、資格検査、非上書き公開を順に所有する。source変更、公開の失敗、終了未確認をfallbackで隠さない。音声indexは選択source基準で両経路へ渡し、準備合成で失うindexは明示的に拒否する。開発時の全画像照合を通常再生・exportの毎回全尺走査へ導入しない。

## Consequences

[設計・制限・公式資料](../native-export.md)を正本とする。Appleのpassthroughを利用できる余地を検証できる一方、複数区間の連結、未確認形式、合成が必要な条件は既存経路を維持する。AACの生decode末尾とplayerの提示区間は区別し、元の圧縮品質・時刻を保った対応範囲で有効化する。境界だけの再圧縮が可能とは断定せず、未適格入力は既存encoderへ戻す。

### 再生音声との接続

選択音声は一時的なsource単位の状態として既存Timeline同期に含め、書き出すangle/sourceを解決した後でclipへ適用する。nativeの要求だけを実行済みと見なさず、準備済み観測またはHTMLの実選択を使用する。未確定・競合は明示エラーとし、別sourceの同じ番号へ置換しない。package/playlist永続形式は変更しない。既存stream-copyの適格性を保ち、確認済み単一音声0を指定した全体出力でも不要な再圧縮を増やさない。

同一hostの別モードと既存FIFOを使い、新しいユーザー操作やbinaryを増やさない。native同時数、候補容量、期限を制限する。取消とQuitはprobeを含むchild close・cleanupまで所有し、取消後のfallbackや部分公開は行わない。
