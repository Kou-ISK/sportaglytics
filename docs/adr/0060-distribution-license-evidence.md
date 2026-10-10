# 0060 Distribution License Evidence

## Status

Accepted

## Date

2026-10-10

## Context

アプリのMITと外部componentの条件は異なる。buildのLICENSE.txt除外を消しても、bundle依存の告知を生成しなければ必要な本文が届かない。FFmpegは固定sourceからbuildしているが、従来のReleaseには対応source添付がなかった。

## Decision

実際のrenderer/preload出力moduleからversion・license・LICENSE/COPYING/NOTICE本文を生成し、Resourcesへ同梱する。packaging hookで存在を確認し、既存のevent runner署名境界を維持する。native componentは各prepare/build処理で上流告知を保持する。

FFmpeg等の対応sourceは固定archiveと公開build scriptを明示的に列挙し、3 targetのbinary/source manifestとともに同じReleaseへ添付する。workspaceやcache全体をarchiveしない。過去Releaseの不足は明示し、公開済みartifactの差し替えは行わない。

## Consequences

告知と対応sourceを配布工程で検証できる。license inventoryは完全なSBOMや法的判断の代わりではなく、モデル重みの公開承認とも独立している。sourceの追加downloadとRelease assetは増えるが、source準備だけのためのnative再buildは不要。詳細は[第三者配布](../third-party-distribution.md)と[モデル台帳](../model-distribution.md)を参照する。
