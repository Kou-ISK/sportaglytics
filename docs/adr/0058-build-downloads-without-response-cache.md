# 0058 Build downloads without HTTP response caching

## Status

Accepted

## Date

2026-10-04

## Context

Releaseは`pnpm audit && pnpm audit --prod`を必須とする。builder 26.16.1は`@electron/get` 3.1.0 → got 11.8.6 → cacheable-request 7.0.4 → http-cache-semantics 4.2.0を解決する。[GHSA-ch52-4w7c-c8xp](https://github.com/advisories/GHSA-ch52-4w7c-c8xp)には公開修正版がなく、[上流PR #58](https://github.com/kornelski/http-cache-semantics/pull/58)も未マージで追加のstale再利用経路への対応が議論されている。

builderのダウンロードはgotのproxy agent・timeout・streamingを使うが、HTTP response cacheは指定しない。Electronのzipを再利用するchecksum付きファイルキャッシュは`@electron/get`の別機能である。builder 26.17.0もget 3系列に依存する。get 5への単純overrideはgot用agent/timeoutオプションをfetchへ渡し、ビルドの通信・timeout契約を失うため採用しない。

## Decision

- got 11.8.6だけにpnpmの内容hash付きパッチを適用し、未使用のHTTP response cacheのimport・構築・request・error経路とmanifest依存を除去する。cache指定、またはbeforeRequest hookによる再有効化は通信前に拒否する。
- pnpm 9の`.pnpmfile.cjs`の`readPackage`で同じversionのmanifestを補正し、cacheable-requestとhttp-cache-semanticsを実際の解決グラフから除去する。監査結果の除外、advisory ignore、severity変更は行わない。
- Electron/get/builderのversionと、proxy・timeout・TLS・checksum・ファイルキャッシュ・progress・redirectの処理を維持する。
- ビルド依存の回帰は`scripts/tests/build-downloader.mjs`で、合成bytesとloopback HTTPを使って検証する。`test:run` / `test:ci`は既存Vitest完了後にこの検査も実行する。

## Consequences

配布アプリ、IPC、文書形式、モデル、UIは変わらない。`electronDownload.cache`は従来通りzipの保存先として使える。gotの`downloadOptions.cache`によるHTTP response cacheはビルドで利用できない。新しいHTTP cache consumerを導入する場合はこの制約を再検討する。

限定した第三者パッチを保守する責任が増える。担当はKou-ISK、次回確認期限は2026-10-31。上流の正式修正版または互換性を保つbuilder/get移行が利用可能になったら、パッチとmanifest hookを一緒に除去し、full/prod audit、frozen install、合成ダウンロード、Windows/macOS packagingを再検証する。対象versionやpatch内容の変更はlockfileのhashとテストで検出し、未検証の別majorへ拡大しない。

`@types/jest`はVitestのテスト・型設定から使われないため除去し、bracesへの唯一の経路も除去する。undici、fast-uri、brace-expansionとwait-onのaxiosは既存major内の修正版へ固定する。必要な監査を満たす実際の依存修正として扱い、dev依存であることを免除理由としない。
