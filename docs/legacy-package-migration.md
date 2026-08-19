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
2. source の real path と config/timeline fingerprint を計算する
3. 同一 source の既存 migrated package があれば再利用する
4. なければ sibling の `<folder>.stpkg`、競合時は `<folder>-2.stpkg` 以降を選ぶ
5. target と同じ parent に temporary directory を作成し、legacy source 全体を recursive copy する
6. source 内を指す旧 absolute media path を copied package 内の relative path へ変換する
7. copied `.metadata/config.json` に既存 current-config migration を適用する
8. copied package を再 validation する
9. `.metadata/legacy-migration.json` を書く
10. temporary directory を target へ rename し、完成を atomic に確定する
11. 以降は生成された `.stpkg` を current project として開く

source folder は成功・失敗・キャンセルのいずれでも変更・削除しません。

## Migration marker

生成 package は次の provenance を保持します。

```json
{
  "schemaVersion": 1,
  "sourceRealPath": "/path/to/legacy-project",
  "sourceFingerprint": "sha256...",
  "migratedAt": "2026-08-19T00:00:00.000Z"
}
```

source real path と fingerprint が一致する package を見つけた場合、同じ migration を繰り返さず既存 `.stpkg` を再利用します。同名 `.stpkg` が別 source のものなら上書きしません。

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
