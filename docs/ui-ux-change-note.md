# Desktop UI / UX change note

この変更では、UIを説明的にしすぎず、熟練者向けの操作密度を維持したまま、基本操作とヘルプ・エラー回復を整理します。

ユーザー向けの操作説明はアプリ内 `SporTagLytics ヘルプ` を正本として更新しています。デザイン原則・用語・Menu / Toolbar / Footer の実装方針は [design-system.md](design-system.md) を参照してください。

## 変更点

- Timeline下部に固定Footerを追加
  - 左: 行追加
  - 右: `− 100% ＋` の表示倍率操作
  - 従来の Cmd/Ctrl + wheel zoom は継続
- 初期画面の優先順位を `最近開いたパッケージ → パッケージを開く → 新しいパッケージを作成` へ整理
- 一般UI文言を日本語へ統一し、JSON / CSV / SCTimeline / YouTube 等のformat・固有名詞は維持
- Error表示を自動消去せず、ユーザー向け説明 → 対処方法 → 展開可能な技術詳細の順で表示
- 映像書き出し失敗時も、raw FFmpeg errorより先に確認事項を案内
- native menuの動詞・ellipsis・window zoom表現を統一
- Helpを現行の独立Timeline / Code Window構成へ更新し、modifier + drag等の高度操作も検索可能な説明へ追加

このファイルは変更内容のサマリーであり、恒久的なUI規約の正本ではありません。
