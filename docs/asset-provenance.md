# 画像・アイコン・fixtureの由来記録

確認日: 2026-10-12。公開版v0.17.4のcommitは
`ab89af2a50721acf1a4183a3cf3d7a8de270f8fc`です。
[ファイルごとのSHA-256・導入commit](asset-inventory.json)を固定しました。
これは権利の包括的承認ではなく、確認済みの出典と不足する証拠の区別です。

| 対象 | 確認できたこと | 残る確認 |
| --- | --- | --- |
| `public/icon.png/.svg/.icns/.ico` と `public/icons/` の12ファイル | 管理者からアイコンはAI生成との申告あり。各bytesと公開Gitの導入/更新履歴を記録。SVGは1024px PNGの埋込みで、現行PNGは512px。元の編集可能なvectorや生成ログではない | 申告が該当するファイル、生成サービス/モデルと時期、入力素材の有無・出所、当時の出力利用条件。変換履歴だけでこれらを埋めない |
| UX/density文書の13 PNG | 自アプリの画面。対応するE2Eは`testsrc2`合成映像・架空データ・独立profileで生成。[UX記録](reports/2026-10-ux-review.md)と[密度検証](reports/2026-10-compact-density.md)に条件を記載 | 再生成時も合成データを使用。今回の既存資料・hash照合を、全過去画像・全pixelの個人情報検査とは扱わない |
| `tactics-motion.webm` | 4秒・320×180・20fpsのVP9。[fixture](../src/features/playlist/fixtures/TacticsVideoFixture.tsx)は合成映像と明記。過去の静的点検でも幾何学パターンを確認。実試合映像をこのファイルの出所と認定していない | 最初の生成コマンド・作者記録は見つからず、完全な再生成recipeは未確認。管理者の「自分の動画」という申告との対応も未特定 |
| MUI等のアイコン、Windows Notoフォント | npm由来の告知inventoryと、固定フォントhash/OFLは[由来台帳](provenance-review.md)で確認済み | AI生成の申告を第三者由来のアイコン・フォントへ拡張しない。OS提供フォントも別扱い |
| `src/logo.svg`（旧Reactロゴ） | source/configの参照がなく、初期テンプレート由来の未使用ファイルとして現行treeから除去 | 過去tag/履歴のファイルは保持。削除は過去の許諾や告知の確認を代替しない |

公開Gitで追跡される動画は上記の合成fixtureのみです。管理者が保有する
実動画や利用者のローカル動画を、今回の配布物・学習データとして追加していません。
動画の保有・撮影者であることと、映り込む人・音楽・配信素材の公開条件は分けて
確認し、私的映像や実試合名を証拠として公開PRへ添付しません。

## 合成画像の再確認経路

- [UX E2E](../scripts/e2e-ux-review.mjs)と[density E2E](../scripts/e2e-ux-density.mjs)は、FFmpegの`testsrc2=size=320x180:rate=24:duration=60`から一時動画を生成します。外部の実試合を入力しません。
- 上記文書画像の導入commitと各画像hashはinventoryから辿れます。画面やencoderを変更した再生成物は別hashとしてレビューします。
- `tactics-motion.webm`は別のfixtureです。UX E2Eの生成コマンドをその原recipeとして転記しません。

## 互換形式の資料について

管理者から、Sportscodeが出力したファイルの内容を参照したとの申告があります。
これは形式・出力sampleの調査に関する情報です。既存docsにある公開マニュアル・
動画等の参照記録を否定するものでも、製品コード・画面資産の複製を示すものでも
ありません。現在のXML取り込みは[対応subsetと合成fixture](package-compatibility.md)
で検証しています。出力sampleを取得した経緯・適用条件や、実データをfixtureへ
転用した有無の最終確認は管理者側で行います。

## 管理者の事実確認が必要なもの

1. 12個の独自アイコンとAI生成申告の対応、生成元/時期、入力素材、出力の利用条件。
2. 合成fixtureの元recipeが残っているか。将来実動画を公開する場合は、その対象と公開許可の範囲。
3. 参照したSportscode出力sampleの取得経緯と適用条件。契約原本・私的ログ・実データは非公開で管理する。

未確認という理由だけで侵害を断定せず、AI生成・所有という申告だけで全素材を
権利確認済みにもしません。出典が確認できない公開用素材は、対象を限定して
置換案をレビューします。
