# 0006 Application Document Formats and File Associations

## Status

Accepted

## Date

2026-05-05

## Context

SporTagLytics は project package、playlist、code window、dashboard をユーザーがファイルとして保存・共有できる desktop application です。これらの拡張子と OS file association はユーザー操作、Finder / Explorer 表示、配布設定に影響します。

保存形式や関連付けを実装詳細として扱うと、互換性、アイコン、document role、package directory の扱いが drift しやすくなります。また `.stpkg` 導入前に作成された project folder を直接開き続けると、旧構造をその場で書き換える migration と正式 package format が混在し、元データを壊す危険があります。

## Decision

`.stpkg`, `.stpl`, `.stcw`, `.stad` を application document format として扱い、OS file association は public contract として維持します。

- `.stpkg` は SporTagLytics package とし、映像、タイムライン、設定を含む project package として扱う。
- `.stpl` は playlist package とし、playlist data と必要に応じた video assets を含む。
- `.stcw` は code window layout document とし、JSON document として扱う。
- `.stad` は analysis dashboard package とし、dashboard import/export の document format として扱う。
- `.metadata/config.json` と `timeline.json` を持つ拡張子なしの legacy project folder を開いた場合は、その folder を直接更新しない。内容を検証して sibling の `.stpkg` へ一時 copy し、copy 側だけを現行構造へ migration した後、atomic rename で完成を確定する。
- legacy source の real path と config/timeline fingerprint を `.metadata/legacy-migration.json` に記録する。同じ source が未変更のまま再度開かれた場合は既存 migration target を再利用し、同名の無関係な `.stpkg` は上書きしない。
- sibling location に書き込めない場合は Save As で明示的な保存先を選び、source は成功・失敗・キャンセルを問わず変更・削除しない。
- package picker、recent package、Finder/OS open、drag/drop は renderer の package load gateway で同じ preparation service を通す。
- macOS では UTI / document type / icon / package directory の扱いを `electron-builder.json` と `public/icons` で維持する。
- Windows / Linux では `electron-builder.json` の file association を維持する。
- 拡張子、内部構造、document role、package directory 扱いを変更する場合は user guide、custom file icon docs、requirement、必要なら migration docs を同じ PR で更新する。

## Consequences

- ファイル形式と OS 連携を user-facing contract としてレビューできる。
- legacy project を開いても元 folder は immutable source として残り、migration 失敗時にも復旧元を失わない。
- 正式な current project は生成・再利用された `.stpkg` となるため、その後の保存は legacy source ではなく `.stpkg` に対して行われる。
- 保存形式変更時に backward compatibility と migration の検討が必須になる。
- packaging config、icons、docs の同期コストは増えるが、配布後の document association 破壊を防ぎやすい。
