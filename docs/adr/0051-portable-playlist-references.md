# 0051 Portable playlist references

## Status

Accepted

## Date

2026-09-22

## Context

絶対パスだけの参照Playlistは、元パッケージを整理・改名すると切れ、従来のロードは見つからないパスを捨てていた。映像の複製を必須にせず、別の同名試合への誤接続と、配布文書への端末情報混入を避ける必要がある。

## Decision

パッケージの `.metadata/package-id.json` に不変のUUIDを置く。Playlist v5は映像ごとにpackage ID・パッケージ内相対パス・Playlistからの相対位置を持つ。コピー先の相対位置を優先し、元位置、端末内の登録位置、同じフォルダのID一致候補を解決する。全ディスクの再帰走査やファイル名だけの自動照合を行わない。

MacのNSURL bookmarkを、固定Foundationスクリプトへ引数としてデータを渡す小さなAdapterで取得する。OS標準のosascriptをshellなしで起動し、UI・ボリュームマウントなし、タイムアウト付きで解決する。第三者アプリの操作やApple Eventsを使わない。bookmarkと現在地はアプリのuserData内にのみ保存する。OS機能が利用できなくても相対位置・ID照合と明示再接続は動く。

保存・読込、実行中の再フォーカス、明示再接続は同じMainの解決サービスを使う。Mainだけがファイル・OSを扱い、Playlist専用の型付きIPCで結果を渡す。再接続はID一致を検証し、同じ参照元のクリップを一括更新する。未接続の参照を保持する。RendererはIPC中のノート等の編集を保持し、Undo履歴の参照も更新して、Undoで壊れたパスに戻さない。

## Consequences

元パッケージへ小さなIDファイルを書き込む。読み取り専用・旧ファイルを移動済みの状態・別ボリューム・Windowsで未登録の任意の移動は、明示再接続が必要になり得る。パッケージのコピーは同じIDを保持し、文書に近いコピーを優先する。複数候補を一意に判断できない場合は選択を求める。Macのネイティブbookmarkを実ファイル移動で試験し、Windowsには必須依存を追加しない。

[Apple NSURL bookmark仕様](https://developer.apple.com/documentation/foundation/nsurl) / [Playlistの操作契約](../playlist-features.md)。
