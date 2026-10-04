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

入力を正規化する前に、既知の形・version・ID・有限時刻・ラベルを検証します。未知versionや読み込み失敗を空の有効文書へ変換しません。Timelineのload完了は「読取と検証に成功した」場合だけとし、成功前は変更・autosaveを抑止します。保存失敗ではdirty snapshotと持続するerror/retryを保持し、補助Timelineにも同期します。

ファイル単位の順序付きtext writeは、同じディレクトリの一時ファイルへ書込・sync・close後にrenameします。これで途中の空/部分ファイルを読者へ見せる期間をなくします。終了時のdebounce flush、全形式のtransaction、電源断後の耐久性とは別の契約です。[原本保護と制限](../package-compatibility.md)。

## Consequences

- 主要な domain logic は最新 contract 前提で実装でき、分岐が減る。
- 既存データ互換は loader / normalizer に集中し、テスト対象が明確になる。
- 保存モデルを変更する場合は migration と docs 更新が必須になる。
- facade の段階廃止中は、移行状況を `docs/system-overview.md` と PR で説明する必要がある。

現行version 2文書とXML由来のラベルは、旧group名のマイグレーション対象にしない。旧配列入力だけで既知groupを変換し、未知のgroupをprototypeのkeyとして扱わない。読込失敗・文書切替時は編集入口、履歴、保留中のコードセッションを停止/リセットする。書込中にUndoした希望状態は、古い保存済みsnapshotと同じ場合にもwrite queueへ保持する。
