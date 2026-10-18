# 画像・アイコン・fixtureの由来記録

確認日: 2026-10-12。公開版v0.17.4のcommitは
`ab89af2a50721acf1a4183a3cf3d7a8de270f8fc`です。
[ファイルごとのSHA-256・導入commit](asset-inventory.json)を固定しました。
これは権利の包括的承認ではなく、確認済みの出典と不足する証拠の区別です。

2026-10-13にdevelop commit `36dfec8afa8ade78c52dd29bc16285c72ea161dc`の
対象26ファイルを再照合し、inventoryの全hashと一致しました。
この一致は過去の取得条件を補完しません。次版の判断は
[由来台帳の候補確認](provenance-review.md#次版候補の確認状態)を参照してください。

| 対象 | 確認できたこと | 残る確認 |
| --- | --- | --- |
| `public/icon.png/.svg/.icns/.ico` と `public/icons/` の12ファイル | 各bytesと公開Gitの導入/更新履歴を記録。SVGは1024px PNGの埋込みで、現行PNGは512px。元の編集可能なvectorや生成ログではない | 原作者、元素材、取得・生成方法と時期、適用される利用条件。変換履歴だけでこれらを埋めない |
| UX/density文書の13 PNG | 自アプリの画面。対応するE2Eは`testsrc2`合成映像・架空データ・独立profileで生成。[UX記録](reports/2026-10-ux-review.md)と[密度検証](reports/2026-10-compact-density.md)に条件を記載 | 再生成時も合成データを使用。今回の既存資料・hash照合を、全過去画像・全pixelの個人情報検査とは扱わない |
| `tactics-motion.webm` | 4秒・320×180・20fpsのVP9。[fixture](../src/features/playlist/fixtures/TacticsVideoFixture.tsx)は合成映像と明記。過去の静的点検でも幾何学パターンを確認。実試合映像をこのファイルの出所と認定していない | 最初の生成コマンド・作者記録は見つからず、完全な再生成recipeは未確認 |
| MUI等のアイコン、Windows Notoフォント | npm由来の告知inventoryと、固定フォントhash/OFLは[由来台帳](provenance-review.md)で確認済み | 独自アイコンとは別に、各上流の利用条件を確認する。OS提供フォントも別扱い |
| `src/logo.svg`（旧Reactロゴ） | source/configの参照がなく、初期テンプレート由来の未使用ファイルとして現行treeから除去 | 過去tag/履歴のファイルは保持。削除は過去の許諾や告知の確認を代替しない |

公開Gitで追跡される動画は上記の合成fixtureのみです。
動画の保有・撮影者であることと、映り込む人・音楽・配信素材の公開条件は分けて
確認し、私的映像や実試合名を証拠として公開PRへ添付しません。

## 合成画像の再確認経路

- [UX E2E](../scripts/e2e-ux-review.mjs)と[density E2E](../scripts/e2e-ux-density.mjs)は、FFmpegの`testsrc2=size=320x180:rate=24:duration=60`から一時動画を生成します。外部の実試合を入力しません。
- 上記文書画像の導入commitと各画像hashはinventoryから辿れます。画面やencoderを変更した再生成物は別hashとしてレビューします。
- `tactics-motion.webm`は別のfixtureです。UX E2Eの生成コマンドをその原recipeとして転記しません。

## 互換形式の資料について

現在のXML取り込みは[対応subsetと合成fixture](package-compatibility.md)
で検証しています。公開docsにはマニュアル・動画・操作画像等を参照した記録も
あります。資料の参照と、製品コード・画面資産そのものの複製は区別して確認します。

SCTimeline JSONはXML取り込みとは別の実装です。
[2025-11-21の導入記録](https://github.com/Kou-ISK/sportaglytics/blob/d63f570a853dd008fa6093858e2d45ea8511fa61/docs/sctimeline-implementation.md#L184)
には、実際のファイルを分析した旨と、`labels`、任意の`group`、`packagePath`、
`currentPlaybackTime`の観察が記されています。これは出力構造を調べた技術記録で、
実際の出力・閲覧日や適用契約を確定するものではありません。
古い文書には実例の識別情報も残るため、値を新しい文書やfixtureへ転載しません。
現行は[JSON converterの対応範囲と外部実機往復未検証](sctimeline-implementation.md)
を明記しています。

## 管理者の事実確認が必要なもの

1. 12個の独自アイコンの原作者・元素材、取得または生成方法と時期、適用される利用条件。
2. 合成fixtureの元recipeが残っているか。将来実動画を公開する場合は、その対象と公開許可の範囲。
3. 参照したSportscode出力sampleの出力・閲覧時期、取得経緯と当時の利用条件。契約原本・私的ログ・実データは非公開で管理する。

未確認という理由だけで侵害を断定せず、出典の根拠が揃わない素材を
権利確認済みにもしません。出典が確認できない公開用素材は、対象を限定して
置換案をレビューします。

## 再生成可能な初回サンプル

`samples/synthetic-first-run.stpkg.zip`は、`scripts/generate-synthetic-sample.py`内の図形・線・動きの式だけで生成する新規の合成資料です。外部映像・画像・フォント・モデル・生成AIサービスは入力にしません。recipeとサンプルの許諾はリポジトリのMIT Licenseを使い、ZIPへ`LICENSE.txt`を同梱します。動画・metadataを含む全ファイルのhashと使用したFFmpeg版は[専用manifest](../samples/synthetic-first-run.manifest.json)、再生成・検査は[quickstart](quickstart.md#サンプルの由来と再生成開発者向け)を参照してください。

このZIPはソースリポジトリから別途取得する練習資料で、アプリ本体へ追加同梱しません。既存の`tactics-motion.webm`の初出recipeが不明である状態を、この新しいrecipeで確認済みに変更するものではありません。
