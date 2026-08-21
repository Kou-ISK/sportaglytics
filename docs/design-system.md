# SporTagLytics Design System (NEON / Dark-first)

このドキュメントは SporTagLytics の UI 実装における単一の参照点です。実装上の色・タイポグラフィ・spacing の正本は MUI theme (`src/theme.ts`) とし、本書は「どのトークンを、どの意味で使うか」を定義します。

SporTagLytics はスポーツ分析者が長時間操作する desktop application です。装飾性よりも、映像・Timeline・Code Window といった作業対象の視認性、情報密度、操作の安定性を優先します。

## Design principles

1. **作業対象を主役にする**
   - 映像、Timeline、Code Window、分析結果よりも UI chrome を目立たせない。
   - Toolbar / Footer は compact に保ち、操作を増やすためだけに常時表示領域を広げない。
2. **高度操作は隠してよいが、ヘルプには隠さない**
   - 熟練者向けの modifier key、drag、context menu、hotkey をすべてボタン化する必要はない。
   - UI から発見しづらい操作は、アプリ内ヘルプで検索可能かつ具体的に説明する。
   - UI には現在値や最小限の基本操作を置き、速度を上げる操作は help / hotkey で補完する。
3. **Surface は境界で分け、装飾的な elevation に依存しない**
   - `background.default` と `background.paper`、`divider` を基本とする。
   - カードを浮かせるための大きな shadow や hover translate は原則使用しない。
   - overlay など前後関係そのものに意味がある場合のみ glass / elevation 表現を使う。
4. **色には意味を持たせる**
   - Primary blue は主要操作、選択、focus。
   - `success / warning / error / info` は状態の意味に限定する。
   - team / action color は分析データそのものを識別する色であり、一般 UI の装飾色として流用しない。

## Tokens

### Palette (dark)

- `primary`: `#1E90FF` (Electric Blue)
- `secondary`: `#00FF85` (Neon Green)
- `team1`: `#1E90FF`
- `team2`: `#FF6F61`
- `background.default`: `#0D0D0D`
- `background.paper`: `#121212`
- `text.primary`: `#FFFFFF`
- `text.secondary`: `#E0E0E0`
- `text.disabled`: `rgba(255,255,255,0.5)`
- `divider`: `rgba(255,255,255,0.12)`

### Typography

- Font: `Inter`, `Noto Sans JP`, `system-ui`, `sans-serif`
- 本文・UIラベルは日本語を基本とする。
- `button` は `textTransform: none`, `fontWeight: 700`。
- 数値を連続比較する Timeline 時刻・倍率などは tabular numerals を優先する。

### Shape / spacing / elevation

- `spacing(1) = 8px` を基準とする。
- `shape.borderRadius = 12px` を標準 radius とする。
- Toolbar / Footer の高さは 32–40px 程度を基準とし、分析画面を不必要に圧迫しない。
- application の標準 shadow は `none`。意味のない drop shadow は追加しない。
- 小さな group control 内では 12px radius をそのまま重ねず、外枠が shape を所有して内部 control は連続した形状にしてよい。

### Custom tokens (`theme.custom`)

- `rails.timelineBg`, `rails.laneBg`
- `bars.team1`, `bars.team2`, `bars.selectedBorder`
- `glass.panel/hover/hoverStrong`
- `accents.hoverPink`

`glass` / accent は用途を限定する。標準 Paper / Card を glass 化しない。

## Surface hierarchy

原則として次の3層で構成します。

1. **Application background** — `background.default`
2. **Work surface** — `background.paper` + `divider`
3. **Temporary overlay** — Dialog / Menu / playback controller 等。必要な場合のみ glass token を利用

Timeline の header / footer、Settings の header、Code Window toolbar のような固定 chrome は同じ work surface と divider で統一します。

## Toolbar / Footer

- Toolbar は「その window 全体に作用する操作」を置く。
- Footer は「viewport / document の状態と軽量な編集操作」を置く。
- Timeline Footer の基準:
  - 左: row 追加など document structure 操作
  - 右: `− 100% ＋` のような viewport 操作
- アイコンのみの操作には必ず `aria-label` と Tooltip を付ける。
- クリック可能領域と視覚上のアイコンサイズを同一視せず、操作領域を確保する。

## Desktop menu bar

macOS / Windows の native desktop menu として、項目名は短く安定した語彙を使います。

Top level:

- ファイル
- 編集
- 同期
- 分析
- ウィンドウ
- ヘルプ

命名ルール:

- Window を開く操作は `〜を開く` に統一する。
- native window zoom は `ウィンドウを拡大/縮小` とし、Timeline の表示倍率と混同させない。
- 新規 / 開く配下では対象名を `パッケージ…`, `コードウィンドウ…` のように簡潔にする。
- dialog を開く menu label の末尾は Unicode ellipsis `…` を使用する。
- format 名 (`JSON`, `CSV`, `SCTimeline`) は翻訳せず、用途を日本語で補足する。

## Terminology

### 日本語を基本にするもの

通常の操作・navigation・状態:

- 最近開いたパッケージ
- パッケージを開く
- 新しいパッケージを作成
- 行を追加
- 表示倍率
- エラー詳細を表示

### Product / domain vocabulary として維持するもの

ユーザー間・外部ツールとの互換性上、名称そのものに意味がある語:

- SporTagLytics
- Timeline / タイムライン
- Code Window / コードウィンドウ
- Sportscode
- SCTimeline
- JSON / CSV
- YouTube
- `.stpkg` / `.stcw`
- FFmpeg（技術詳細として表示する場合）

英語を使う場合も `Recent`, `Package workspace`, `Drop package` のような一般UI文言を理由なく混在させない。

## Error and recovery UX

Error UI は次の順序で情報を出します。

1. **何ができなかったか** — ユーザー向けの短い説明
2. **次に何を確認・実行すべきか** — recovery guidance
3. **技術詳細** — expandable details。stderr / FFmpeg exit 等はここに置く

原則:

- actionable な error を短時間で自動消去しない。
- raw exception / stderr を primary message として表示しない。
- 技術詳細は選択・コピーできる状態にする。
- retry が同じ画面で安全に行える場合は action を付ける。別 workflow を再実行する必要がある場合は、戻る場所を明示する。

## Help as discovery layer

SporTagLytics は熟練者の速度を優先するため、すべての interaction を常時 UI に露出しません。その代わりアプリ内ヘルプを高度操作の正本とします。

Help に必ず含めるもの:

- menu からの到達経路
- current default hotkey と、設定画面が最終的な正本であること
- modifier + drag 等の mouse interaction
- Timeline の zoom / selection / move / copy / range edit
- error recovery と技術詳細の開き方
- UI 文言と同じ用語

ヘルプ自体も application theme と同じ palette / typography / radius / divider を使い、別製品のような visual language を持たせません。

## Component implementation

1. **テーマ経由で取得**
   - 色: `theme.palette.*` / `theme.custom.*` を利用し、ハードコード色を避ける。
   - 文字: `theme.typography` / `theme.typography.fontFamily` を利用。
   - 余白: 8px scale を基準とする。
2. **共通 Surface**
   - Paper / Card: `background.paper`, `divider`, radius 12。
   - 一般操作に team color や error color を装飾目的で使わない。
3. **State / accessibility**
   - hover だけで操作可能性を伝えず、focus-visible でも状態を確認できるようにする。
   - text は `text.primary / secondary` を使いコントラストを維持する。
4. **直接編集と実行表示の一致**
   - Code Window のように実行対象を直接編集するUIは、実行・編集で同じ props-only surface を共有する。
   - 編集選択、drag cursor、handle は overlay として追加し、保存対象の色・文字・輪郭・位置・寸法を編集専用表現で置き換えない。
   - `CodeWindowButtonSurface` は `src/components/ui/composites/` に置き、Electron API や feature state へ依存させない。

## Storybook

Storybook を導入・利用する場合は `ThemeProvider` + `CssBaseline` を共通 decorator とし、実アプリと同じ theme を適用します。Token、Toolbar / Footer、error surface、Code Window button など、再利用する View を優先して story 化します。

## 運用ルール

- 新規 UI はテーマ色のハードコード禁止が原則。
- 既存画面に色指定を追加する場合は、まず theme で代替できるか確認し、できない場合だけ semantic token を追加する。
- UI の用語を追加する場合は Terminology の原則に従う。
- UI から意図的に隠す高度操作を追加・変更した場合は同じ変更で Help を更新する。
- ダークモードを基準に設計し、ライトモードでも foreground / background / divider が theme 依存で成立することを確認する。
