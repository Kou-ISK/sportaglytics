# Legacy project folder → `.stpkg` migration

## 目的

`.stpkg` 導入前の SporTagLytics project folder を、元データを破壊せずに現在の正式 package format へ移行します。

## Legacy project の判定

拡張子が `.stpkg` ではない directory を開いた場合、最低限次を検証します。

- `.metadata/config.json` が存在し、JSON object として読める
- `timeline.json` が存在し、JSON として読める

検証に失敗した folder は migration target を作成しません。

## Open flow

package picker、Recent Packages、Finder/OS file open、drag/drop はすべて renderer の `loadPackageDirectory()` 直前で `package:prepare-open` を通ります。

1. legacy source を validation する
2. sourceのreal path、全ファイルの状態から厳密なfingerprint、再利用用revision、コピー検証用fingerprintを計算する
3. 端末内索引と同じ親フォルダから、同一source/revisionの完成済みpackageを探索・検証して再利用する
4. なければ sibling の `<folder>.stpkg`、競合時は `<folder>-2.stpkg` 以降を選ぶ
5. targetと同じparentに、通常は開けない`.sportag-migrating-<uuid>`を作成し、legacy source全体をrecursive copyして内容を比較する
6. source 内を指す旧 absolute media path を copied package 内の relative path へ変換する
7. copied `.metadata/config.json` に既存 current-config migration を適用する
8. copied package を再 validation する
9. `.metadata/legacy-migration.json` を書く
10. 原本が変化していないことを確認し、temporary directoryをtargetへrenameして完成をatomicに確定する
11. 端末内索引へ完成先を記録し、生成された`.stpkg`をcurrent projectとして開く

source folder は成功・失敗・キャンセルのいずれでも変更・削除しません。

## Migration marker

生成 package は次の provenance を保持します。

```json
{
  "schemaVersion": 1,
  "sourceRealPath": "/path/to/legacy-project",
  "sourceFingerprint": "sha256...",
  "sourceRevision": "sha256...",
  "migratedAt": "2026-08-19T00:00:00.000Z"
}
```

source real pathとrevisionが一致するpackageを検証して再利用します。旧markerにrevisionがない場合だけ、厳密なfingerprintの一致を要求します。Finderの補助情報やフォルダmtimeだけの変化で移行し直しません。同名`.stpkg`が別sourceのものなら上書きしません。

## 書き込み権限がない場合

sibling directory へ書き込めない場合は Save As dialog を表示し、ユーザーが選んだ保存先にだけ migration します。既存の無関係な target は上書きしません。

## 保持対象

legacy source 全体を copy するため、少なくとも次を維持します。

- `timeline.json`
- `.metadata/config.json` の team / sync / media metadata
- package 内の Code Window / label / auxiliary metadata
- package 内 media files
- clip placement / angle metadata

package 外を指す absolute media reference は勝手に移動・削除せず、従来どおり reference として保持します。

## Test contract

automated migration tests では次を固定します。

- source config/timeline が byte-level で変わらない
- media / auxiliary metadata が copied package に残る
- source 内 absolute media path が target 内 relative path へ変換される
- 同一 source の再 open で duplicate package を増やさない
- unrelated target を上書きしない
- explicit destination migration が可能
- malformed legacy source では target を作らない

共通picker・端末内索引・staging拒否・失敗時の状態は[パッケージ互換](package-compatibility.md#開くと再試行の状態)を正本とします。別保存先と連番の欠番を含めて完成コピーを再利用します。
