# 0063 Independent macOS release

## Status

Accepted

## Date

2026-10-14

## Related ADRs

- Supersedes: N/A
- Superseded by: N/A
- [0032 Immutable release artifacts](0032-immutable-release-artifacts.md)
- [0060 Distribution License Evidence](0060-distribution-license-evidence.md)

## Context

Windowsのnative runtime検証とMacの署名・公証が一つのRelease jobで直列化されている。片方の準備中に、既に検証できる別OSの新しい版を配布できない。またtag pushだけで公開まで開始され、未署名の候補検査と本番認証を使う実行の違いが分かりにくい。

## Decision

既存のMac署名・公証Secretsを消費するworkflowをMac単独または両OSを選べる手動dispatchへ変更する。versionとレビュー済みmainの完全SHAを必須にし、tagとの同一性とRelease未作成を確認する。既定では署名・公証と最終DMG検証まで行ってActions artifactを保存し、明示したpublish入力だけがReleaseとHomebrewを更新する。未署名・未公証のMac artifactは公開ゲートを通さない。

対応sourceは配布するtarget集合に限定し、Macでは2 targetのmanifestと3上流sourceを必須にする。列挙したsource bundleのarchive metadataを正規化し、既存出力を上書きしない。署名前の同梱内容と、read-onlyでmountした最終DMGの署名・公証・payloadをそれぞれ検査する。

詳細reportのActions artifactは90日保持し、公開に必要な値を許可リストで抽出した`release-verification.json`を新規Releaseへ含める。最終DMGとWindows installerの実bytes、source commit/tree、version、検査状態を再照合し、source archiveを含むhashとworkflow run URLを残す。要約自体もSHA256SUMSの対象にする。runner pathやraw logは要約へ含めない。これは既存reportの要約であり、独立attestationや品質・E2Eの再実行結果ではない。

WindowsのCIは独立して継続する。`include_windows=true`では既存のreusable workflowを同じdispatchから呼び、新規installerの通常・インストール後検査を必須にする。そのrunのartifactだけを使い、source commit/tree・version・installer hash・同梱manifestを照合してWindows source archiveとともに同じ新規Releaseへ含める。既定falseではMacがWindowsを待たずに配布できる。公開済みReleaseへの後付けや置換はしない。Windowsの実Authenticode状態を明示し、新しい証明書や権限は追加しない。Homebrewは両Mac DMGのあるReleaseだけを候補にする。既存Secretsの通常利用と、新しいcredential取得・権限変更を区別する。

## Consequences

Macだけの公開はWindowsの配布準備を待たずに実行でき、両OSを選んだ場合はWindowsの成功も公開条件になる。Release title/noteとassetで対象OSを明示し、0.17.5は両OSを同一commitから公開する。publish=falseでもApple送信と署名が発生するため、未署名検査には専用のローカル手順を使う。各本番runは全ゲートを実行し、先行runの公証済みbytesをそのまま再利用しない。

ADR 0032のtag・公開artifactの不変性は変更しない。本変更の初回本番検証はmainへの統合後に実施し、それまでは配布済み・公証済みとは記録しない。

公開要約の追加も新規版から適用し、旧Releaseへ後付けしない。GitHubのimmutable Release設定、branch protection、権限は変更しない。workflowによる同版再公開拒否と管理者設定は別の保証として扱う。

Macのelectron-builder publisherは`mac.publish: null`で明示的に無効化する。`--publish never`だけでは既存GH_TOKENから更新用`app-update.yml`が自動生成されるため、DMG出力そのもので署名前の同梱物検査を実行する。公開は検証後の既存`gh release create`工程だけで行い、同梱物の許可リストは緩めない。
