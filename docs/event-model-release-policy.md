# 将来リリースへの最新適格モデルの取り込み

追跡課題: [#243](https://github.com/Kou-ISK/sportaglytics/issues/243)。通常installerへ、そのリリース時点で配布条件・対応環境・評価を満たす最新のevent modelを取り込む方針です。**v0.17.11はモデルなしで続行し、この基盤は同版のtag・配布内容を変更しません。**

## 実装した範囲

公開可能な候補metadataとアプリ版ごとの選定lockを照合する、ネットワーク不要の検査基盤です。初期catalogは空で、lockは明示的な`none`です。実packの取得・展開・runner実行、既存Mac/Windowsのevent pack不在ゲートの解除、更新UIは実装していません。検査成功を実モデルの同梱・公開完了と扱わないでください。

```bash
pnpm run check:event-model-release
node --test scripts/tests/event-model-release-policy.mjs
```

後者は`test:run` / `test:ci`にも含み、checked-in metadataを実際に検査します。既存のUbuntu/Windows CIと将来のRelease品質ゲートが同じ試験を通します。v0.17.11の固定commitにはこの後続変更は入りません。新料金・権限・Secrets・workflow triggerは追加しません。

## 候補台帳と選定lock

正本は`resources/event-model-release/catalog.json`、`lock.json`、`evidence/`です。検査契約は[scripts/event-model-release-policy.mjs](../scripts/event-model-release-policy.mjs)、実ファイル照合は[check-event-model-release.mjs](../scripts/check-event-model-release.mjs)にあります。fixtureの承認値を実モデルへ転用しないでください。

catalog schema 1は`modelId`（空台帳ではnull）と`candidates`を持ち、1つのモデル系列を扱います。公開未承認のR&D一覧ではありません。metadata自体も公開可能か確認し、私的path・動画名・契約原本・秘密URLは含めません。

各候補は次を固定します。

| 項目          | 内容                                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `version`     | `major.minor.patch`と任意のprerelease。浮動名、先頭ゼロの数値、build metadataは拒否。同じ版を重複登録しない |
| `state`       | `approved` / `pending` / `withdrawn`。管理者が以下の全レビューを完了したときだけapproved                    |
| `appVersions` | 互換確認した正確なアプリ版の非空配列。範囲やlatestは使わない                                                |
| `quality`     | `experimental` / `verified`。配布許諾の代わりではない                                                       |
| `evidence`    | `upstream`, `distribution`, `runtime`, `evaluation`, `build`の公開要約。それぞれ`path`とSHA-256             |
| `targets`     | OS/archごとの署名前archive SHA-256とbytes、manifest/provenance SHA-256、実環境qualification記録のpath/hash  |

承認レビューでは、元checkpointの出典・取得時条件・派生関係、匿名化した学習利用根拠、全runtime/native依存と告知/source、固定recipeを照合します。[既存の配布前由来契約](event-pack-provenance.md)を再利用し、台帳へのapproved記入だけでそれを代替しません。

評価要約には、対象版/hash、評価方法とsplitの匿名化識別子、クラス別結果・失敗例・処理時間/RAM/容量、実行環境、人確認かAIによる判定か、比較対象、受入判断と限界を記載します。experimentalは人が候補を確認する前提と既知の限界を明示し、verified向け独立評価基準を実験版配布の絶対条件に追加しません。verifiedの主張は[既存評価ゲート](testing.md#automatic-event-detection-tests)とR&D qualificationを満たす必要があります。

**機械は記録とhashの整合だけを確認します。文書が事実か、法的条件を満たすか、精度が実用的かを自動認定しません。** 全記録は空でない1 MiB以下の通常ファイルに限定し、相対path境界・symlink・hash改変・欠落を拒否します。pending/withdrawnの公開済み記録も改変を黙認しません。

lock schema 1は正確な`appVersion`、catalog全bytesのSHA-256、`darwin-arm64` / `darwin-x64` / `win32-x64`の全対象、`mode`、`selection`、選定理由の`decision` path/hashを持ちます。

- `latest`: approved、アプリ版一致、全対象OS/archが揃う候補を版の意味順で比較し最大を選ぶ。配列順・mtime・可変URLで選ばない。selectionへmodelId/versionと、候補JSONのobject keyを再帰的にsortしてUTF-8 JSON化したSHA-256を固定する。配列順はhashの一部。
- `none`: 適格候補がない場合だけ許容し、selectionはnull。自動fallbackではなく、理由記録付きの明示判断。後から適格候補が増えれば古いlockは失敗する。
- 最新候補が対象不足/未承認なら適格な旧版が選択対象になるが、選定理由に除外根拠を残す。選択済み候補のbytesや検証に失敗した後に古いモデルへ切り替える動作は実装しない。

catalog/lockは人がPRで更新し、検査は自動書換えや出力物作成をしません。アプリ版変更時はlockも明示的に更新します。既存appとローカルuserData packの探索順・runtime manifest schemaは変更しません。

## 次の実装と受入条件

1. 管理者が実候補の公開可能な根拠を確認する。配布対象の重み・runner・runtime・資料と配布先を具体化する。未確認モデルや私的動画を公開しない。
2. 取得元と固定archive hashを結び、target別の空stagingへ必要bytesだけを配置する。署名前の全pack inventoryを既存provenance gateで照合し、manifest ID/version/targetをlockと突き合わせる。一般stagingからの余分なpackや別archの混入は拒否する。
3. 現行のevent pack不在ゲートを、選定されたpackだけを認める検査へ更新する。Macの全native依存署名、公証、最終DMG、Windows native依存/署名状態とinstallerを検査する。ゲートの単純削除はしない。
4. cleanな各対象OSで、専用profile・外部Pythonなしの発見→実推論→人による候補確認→保存再開を通す。cancel、無GPU経路、通信観測、容量/メモリ/時間を記録する。stub E2Eを実モデル精度の証拠にしない。
5. 公開Release証拠へapp commit/tree、catalog/lock、署名前入力・固定runtime/recipe、署名後manifest、最終asset hashを結び付ける。署名・公証・timestampで変わる出力を署名前の再現性と混同しない。署名前の再build比較と最終配布物の動作検査を分ける。

## 失敗時停止とrollback設計

選定・取得・hash・由来・実モデル試験・署名公証・最終配布照合のいずれかで失敗したら公開を停止します。既存Release/tag/assetは変更しません。別candidateへの自動fallbackや`none`への自動変更もしません。

rollbackは、問題の候補をwithdrawnにし、**新しいアプリ版**のPRで以前の検証済みモデルまたはモデルなしへ戻す明示操作として設計します。以前の公開Release URL、app/lock/pack hash、理由、現在の配布許諾とアプリ互換性の再確認を記録し、全対象OSで再検証します。権利上撤回した旧モデルへ戻すことはできません。ユーザーのTimeline・由来情報を削除せず、既存の手動機能は維持します。

基盤schema 1にはrollback例外を実装せず、`mode: rollback`を拒否します。既知の公開済みlockと新アプリ版を照合する例外契約・CI負例を、実同梱を有効化する前に別実装します。旧版の再選択をlatestと偽って通したり、未実装rollbackを現機能として案内したりしません。
