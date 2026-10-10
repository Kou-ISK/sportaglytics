# OSS監査の限定点検（2026-10）

確認日: 2026-10-10。基準はアプリ0.17.3の公開treeです。全履歴・全artifact・private R&Dの再監査ではありません。

## 公開境界

[モデル台帳](../model-distribution.md)へ3系統のカード情報を整理しました。eventの学習・評価・exportはprivate、appはconsumerという既存設計を維持します。現行packのbase checkpoint、weight license、配布URL、再現可能なrecipe、独立Testの完全な記録は未照合です。CodeProcessor画像は比較候補として扱い、採用候補のtraining dataには数えません。

## 第三者告知とsource

従来のbuilderは`build/**/*.LICENSE.txt`を除外し、renderer/preloadはlicense inventoryを生成していませんでした。この設定だけを根拠に既存installer全体の違反を断定しません。実bundleに由来する告知生成とResourcesへの同梱、FreeType FTL本文、次回Releaseの固定対応source添付を追加しました。[配布手順と既存版の不足](../third-party-distribution.md)。

npmのVictory vendorはwrapperのMIT本文がtarballにないため、同じ上流tagの本文を固定して補完します。videojs-youtubeは配布JS先頭のMIT全文を抽出し、MediaPipeは既存のApache本文・NOTICEを使います。version不一致や本文欠落を黙認する汎用fallbackは設けません。

## 履歴・PR・ログの範囲

| 対象                                                                  | 確認結果・状態                                                                                                                                |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `550a227`の直前の`research/rugby-event-detection/SOURCE_DISCOVERY.md` | チーム識別につながる例を確認。現在のtreeからR&Dディレクトリは除去済み。履歴は保持                                                             |
| `0f88eb8a663cd43e7ff0db532aecd15db35a5dbc`の差分                      | 旧ファイル名2例とテストのチーム名例が削除側に残る。現在の該当ファイルは架空名へ変更済み                                                       |
| 現在の追跡ファイル                                                    | 上記のチーム識別語を起点とする一致は0件。全固有名詞・画像の安全性を証明する検査ではない                                                       |
| PR #89 / #168                                                         | 本文・差分・コメント一覧を限定確認。コメント一覧は空。旧例は差分経由でも閲覧可能。private R&Dの所在への言及は、内容公開や公開化の証拠ではない |
| quality-check run `32073284194` / `35527839023`                       | 対応job logを限定点検。代表的なcredential形式・私的ユーザーディレクトリ形式に一致なし。全秘密形式や過去の全runを保証しない                    |

識別例の文字列、実ファイル名、私的repo名、秘密値をこの報告へ転載しません。認証情報の実漏洩・違法性は確認していません。履歴を書き換えず、新たに秘密を失効させる操作やPR/logの削除も行いません。必要になれば対象・根拠・影響を具体化して別承認を受けます。

## ローカル検証

- renderer/preloadの直接buildとpreload検査、生成inventoryのlicense本文を確認。rendererは76依存、license不明のentryは0件。
- directory packageでResourcesのアプリLICENSE・第三者告知・renderer/preload JSON、ASAR内のrenderer inventory、Electron/Chromium告知を確認。環境に準備済みのLinux Electron 43.3.0を使った配置検証で、0.17.3の正式runtime 43.5.1やmacOS/Windowsの動作検証を代替しない。
- アプリのVitestは241ファイル・944成功・1 skip。既存のdownload回帰は環境の未適用patchで失敗したため、pnpm 9.1.0でlockfile固定の依存を再準備し、対象だけを再検証し、追加回帰を含む10件すべての成功を確認した。
- renderer/Electron型検査、lint、architecture、ADR検査、追加した告知・source identity・packaging欠落の回帰はすべて成功。

Storybookの開発用bundleがアプリのinventoryへ混入しないよう、Storybook側で当該pluginを除外し、Storybook直接buildの成功を確認しました。

## 確認待ち

- v0.17.3の既存配布binaryに対応するsource補足の公開と、installer内部の全native告知の実査。
- event packの出所・重み許諾・学習情報・独立評価。
- この環境では固定Paintモデルとmedia sourceの取得がHTTP 403で停止。通常の`build`とsource archiveの実生成は、download可能なCIで確認する。renderer/preloadの直接buildとdirectory packageの告知検証は独立して実施する。

通常のアプリ修正とモデル/データの新規公開を分けます。公開済み版を上書きせず、次のReleaseはその版の署名・公証・Windows検証を通してから公開します。
