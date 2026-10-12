# Event packの配布前レビューと由来記録

この契約は、アプリへ同梱するevent-detection packの**署名前の入力**を検査します。`scripts/after-pack.mjs`がResources内の全packに対して実行し、成功後に既存のmacOS runner署名へ進みます。ネットワーク取得、runner実行、checkpointのロードは行いません。

packなしの配布、既存のuserDataへのローカルpack配置、manifest schema 1/2の実行時契約は維持します。既存packをアプリに同梱して再配布する場合には本記録が必要です。`verified` / `experimental`は推論品質の状態であり、配布許諾を表しません。

## 管理者が確認するもの

1. 実際に採用するpackを固定し、ID/version、runnerと重みのhash、学習・export記録を照合する。比較候補を採用モデルとして記載しない。
2. 基盤checkpointから追加学習・head・補正重み・exportまでの関係を確認する。上流repositoryのcommitと、上流checkpointそのもののSHA-256を分ける。
3. コード、基盤重み、追加学習結果、runner内の依存ごとに、公開再配布を認める条件、表示・source提供義務、利用制限を確認する。アプリや学習libraryのMIT/Apache宣言から重みの条件を推定しない。
4. 学習データの取得・加工・学習利用の権限、派生重みの配布への制約、プライバシーを確認する。動画の所有や私的利用許可を、すべての権利の確認や動画公開の許可へ読み替えない。
5. 公開可能なレビュー要約を作成し、人が配布範囲を承認する。契約解釈等が未解決なら`approved-for-public-distribution`を記録せず、pack同梱を保留する。

レビュー記録には、確認者の公開handleまたは役割、確認日、適用条件と判断根拠、componentの系譜、依存の網羅性、source/NOTICEの提供方法、残る制限を記載します。データ記録は匿名化した取得区分・利用根拠・split/recipeの識別情報・制約を要約します。非公開契約の本文、個人名、試合名、絶対パス、private repo URL、動画や学習用checkpointは含めません。根拠原本は権限を持つ管理者が別管理します。

## `distribution-provenance.json` schema 1

各packの`manifest.json`と同じdirectoryへ置きます。型の正本は[scripts/event-pack-provenance.mjs](../scripts/event-pack-provenance.mjs)、合成例は[テストfixture](../scripts/tests/event-pack-provenance.mjs)です。fixtureの承認値を実packへ転用しないでください。

| フィールド | 内容 |
| --- | --- |
| `schemaVersion` | 整数`1` |
| `manifestSha256` | 署名前の`manifest.json`全bytesの小文字SHA-256。ID/versionだけでなくruntime設定全体を固定 |
| `review.decision` | 管理者レビュー完了時だけ`approved-for-public-distribution` |
| `review.reviewedBy` / `review.reviewedAt` | 公開可能な確認者識別子、`YYYY-MM-DD`の実在日付 |
| `review.record` | 同梱する公開レビュー要約の相対path |
| `trainingData.status` / `trainingData.record` | 確認完了時だけ`reviewed`、公開可能なデータ利用根拠の要約path。既製モデルのデータに関する確認範囲も記録 |
| `components` | 下記componentの非空配列。少なくとも`model`と`runner`が必要 |
| `files` | pack内の全通常ファイルを`相対path: SHA-256`で列挙。`manifest.json`と本JSONだけを除く |

各componentは次の全フィールドを持ちます。

| フィールド | 内容 |
| --- | --- |
| `id` / `kind` | 一意の英小文字・数字・ハイフンID、`model` / `runner` / `dependency` |
| `source.url` | 公開可能なHTTPS出典URL。認証情報・query・fragmentを含めない。原bytesを識別できる場所を選ぶ |
| `source.revision` | 固定commit、release版、checkpoint版等。検査時は前後空白を除き、`main` / `master` / `develop` / `latest` / `HEAD`、明示的branch参照`refs/heads/…` / `refs/remotes/…`を拒否。無版の配布では`sha256:<64桁digest>`を使い、`source.sha256`との一致を必須とする（hexの大小文字は区別しない） |
| `source.sha256` | 元checkpoint/ソースarchive等のSHA-256。出力packのhashやrepository commitとの代用不可 |
| `license` | 確認したSPDX式または独自条件の識別子。`unknown`等の仮値不可 |
| `licenseFiles` / `noticeFiles` | 同梱する全文のpath配列。LICENSEは1件以上、NOTICE不要の場合は明示的な空配列 |
| `usageRestrictions` | 確認した制限の文字列配列。追加制限なしと判断した場合だけ空配列 |
| `artifactPaths` | component由来の同梱ファイルのpath配列。埋込重みならrunnerのpathも指定でき、複数componentが同一ファイルを参照できる |

`files`のすべてのpathは、componentのartifact/LICENSE/NOTICEまたはレビュー記録から参照します。全manifest runnerを`runner` componentへ対応付け、manifest内hashも実ファイルと一致させます。追加・欠落・変更ファイル、空の告知/記録、未知schema/field、絶対path・親directory参照・symlink・特殊ファイルを拒否します。pack rootにはpack directoryと空の`.gitkeep`だけを認めます。staging全体を無条件にhash登録して不要データを配布しないでください。

ゲートは宣言・ファイル集合・bytesの整合を検査します。commit ID、通常のrelease/checkpoint版、`refs/tags/…`は有効なrevision表記として扱いますが、任意の略記がbranchではないことやtagの実際の固定性までは判定しません。出典レビューで確認してください。上流URLの到達性、license式の法的妥当性、レビュー内容や確認者の真実性、全依存・学習データの権利を自動認定しません。署名された権利証明でもありません。人のレビューとPRの確認を省略できません。

## 署名と検証

`distribution-provenance.json`は署名前の証拠として保持します。macOSでは既存の署名hookがrunnerを署名し、`manifest.json`のrunner SHA-256を署名後の値へ更新します。本記録のhashを「再承認済み」の値へ自動更新しません。署名済み出力をそのまま新しいstaging入力にするとゲートは失敗します。

配布担当者は署名前のpackとレビュー記録、署名後manifest、最終installerのchecksumを保管し、署名後bytesと署名前hashを区別して照合します。署名・公証と実OSの試験は通常のRelease工程で確認します。

ローカルでstagingだけを検査する場合:

```bash
node --input-type=module -e "import { validateEventPackDistribution } from './scripts/event-pack-provenance.mjs'; await validateEventPackDistribution('resources/event-detection-models');"
node --test scripts/tests/event-pack-provenance.mjs
```

後者は合成ファイルによる欠落・改変・path境界・署名前停止・署名後hash更新の検査で、モデルを実行しません。通常の`test:run` / `test:ci`にも含みます。この契約追加は、現行の私有packの配布承認や公開モデル採用を意味しません。
