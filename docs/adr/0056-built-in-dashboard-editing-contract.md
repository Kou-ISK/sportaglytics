# 0056 Built-in Dashboard Editing Contract

## Status

Accepted

## Date

2026-10-02

## Context

基本分析テンプレート（`template-basic`）は既存の設定正規化で毎回既定widgetへ復元され、欠落時は補完され、削除も禁止されている。一方、UIには通常の編集・保存入口があり、編集結果が保存時に失われるため、保存できたと誤認させていた。既存の正常な複製と`.stad`読み書きを活かし、組み込みテンプレートの更新・移行契約を維持する必要がある。

[ADR 0011](0011-dashboard-widget-system-and-analysis-consolidation.md)の共有dashboard contractを補足する。

## Decision

- `template-basic`との完全一致だけを組み込み・読み取り専用として扱う。テンプレートの正規化と補完は維持し、編集保存による上書きを認めない。
- テンプレートには「複製して編集」を表示する。新しいIDのコピーの保存に成功してからコピーを選択して編集に入る。コピー作成後のキャンセルは編集差分を破棄し、保存済みコピーは残す。
- 通常の複製・新規作成・import結果は編集できる。`template-basic-1`のような採番されたimportコピーを、ID prefixだけで固定扱いにしない。
- widget dialogの保存は編集中のdraftへの反映であり、dashboard上部の保存で設定へ確定する。永続化が成功した場合だけ編集終了・切替・削除完了・import成功通知へ進む。失敗は画面内に残し、draftやdialog入力を維持する。
- 保存中の重複操作を抑止し、編集中・保存中の外部importは受け付けない。importファイル読取後も状態を確認し、最新のdashboard一覧へ追加する。
- 正規化は有効な`count`と`duration`をともに保持する。未知のmetricのfallback、旧label group移行、固定team名除去、旧default除去、欠落template補完は維持する。文書version・IPCは変更しない。

## Consequences

固定テンプレートの更新と利用者の編集をIDで分離でき、既存のコピー・共有形式を維持できる。テンプレートを直接編集できていたように見える入口は変わるため、読み取り専用表示と明示的な複製入口が必要になる。

過去に正規化で失われたタイトルや、既に`duration`として保存された意図不明のmetricは推測で復元しない。正常な既存設定を一括で書き換えず、以後の編集・保存・再読込で有効値を保持する。
