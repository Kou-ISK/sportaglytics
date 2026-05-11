# 0003 Shared Type Contracts and Load-Time Migration

## Status

Accepted

## Date

2026-05-04

## Context

SporTagLytics は timeline、playlist、settings、analysis、package metadata など複数の保存・共有データを扱います。旧フィールドを型へ残し続けると、新旧モデルの分岐が UI、集計、export、IPC に広がり、保存形式の一貫性が崩れます。

一方で、既存ユーザーのデータ互換は維持する必要があります。

## Decision

共有型は最新モデルを正とし、互換処理はロード時マイグレーションで吸収します。

- 保存・共有型は `src/types/<domain>/` または `src/shared/<domain>/` にユースケース単位で配置する。
- root 直下の legacy type facade は段階的に廃止し、新規実体は domain 配下へ追加する。
- 旧フィールドは原則として公開型へ残さず、normalizer / migration / converter で受ける。
- 保存時は最新モデルに統一する。
- IPC や file import では `unknown` を受け、型ガードまたは正規化関数で絞り込む。

## Consequences

- 主要な domain logic は最新 contract 前提で実装でき、分岐が減る。
- 既存データ互換は loader / normalizer に集中し、テスト対象が明確になる。
- 保存モデルを変更する場合は migration と docs 更新が必須になる。
- facade の段階廃止中は、移行状況を `docs/system-overview.md` と PR で説明する必要がある。
