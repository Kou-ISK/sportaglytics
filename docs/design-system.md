# SporTagLytics Design System (NEON / Dark-first)

このドキュメントは UI 実装の単一の参照点です。実装は MUI テーマ（`src/theme.ts`）をソースオブトゥルースとし、すべての画面・コンポーネントはテーマ経由で色/タイポグラフィ/スペーシングを取得してください。

## トークン
- Palette (dark)
  - `primary`: `#1E90FF` (Electric Blue)
  - `secondary`: `#00FF85` (Neon Green)
  - `team1`: `#1E90FF`, `team2`: `#FF6F61`
  - `background.default`: `#0D0D0D`, `background.paper`: `#121212`
  - `text.primary`: `#FFFFFF`, `text.secondary`: `#E0E0E0`, `text.disabled`: `rgba(255,255,255,0.5)`
  - `divider`: `rgba(255,255,255,0.12)`
- Typography
  - Font: `Inter`, `Noto Sans JP`, `system-ui`, `sans-serif`
  - Scale: 8px基準、`button` は `textTransform: none`, `fontWeight: 700`
- Shape / Elevation
  - `shape.borderRadius`: 12
  - ボタン/アイコンボタンも 12px 丸み、ホバー時のみ微量の影
- Custom tokens (`theme.custom`)
  - `rails.timelineBg`, `rails.laneBg`
  - `bars.team1`, `bars.team2`, `bars.selectedBorder`
  - `glass.panel/hover/hoverStrong`
  - `accents.hoverPink` (`#FF0099`)

## 実装指針
1) **テーマ経由で取得**  
   - 色: `theme.palette.*` / `theme.custom.*` を利用し、ハードコード色を避ける。  
   - 文字: `theme.typography` / `theme.typography.fontFamily` を利用。  
   - 余白: 8pxスケール（`theme.spacing(1)` = 8px）を基準。
2) **コンポーネント共通スタイル**  
   - Paper/カード: `bgcolor=theme.palette.background.paper`, `borderColor=theme.palette.divider`, radius=12。  
   - ボタン: `color="primary"`/`"secondary"` を優先し、独自色は `sx` でテーマ経由。  
   - Badge/Chip: 可能な限り `color` プロップを使用。
3) **レイアウト/背景**  
   - 画面背景: `theme.palette.background.default`。  
   - セクション: Paperを使い `background.paper` を基調に統一。  
   - 枠線: `theme.palette.divider`。
4) **状態・アクセシビリティ**  
   - ホバー/フォーカスは `theme.custom.glass.hover` 等を用い、コントラスト確保。  
   - テキストは `text.primary/secondary` を使用し、背景とのコントラストを担保。

## Storybook 運用推奨（未セットアップの場合のガイド）
1) 追加パッケージ  
   - `@storybook/react`, `@storybook/addon-essentials`, `@storybook/theming` などを devDependencies に追加。  
2) プロバイダーを共通化  
   - `.storybook/preview.tsx` で `ThemeProvider`+`CssBaseline` をラップし、実アプリと同じテーマを適用。  
3) サンプルストーリー  
   - `Theme tokens` を確認できる `Tokens.stories.tsx` を作成（色チップ、タイポサンプル、spacingサンプル）。  
   - 主要コンポーネント（ボタンバリエーション、カード、リスト、タイムラインのパーツ）をストーリー化し、デザイン崩れを検出。  
4) CI連携（任意）  
   - `storybook build` を CI で回し、ビルド可否をチェック。  
   - 将来的に Visual Regression (Chromatic など) を導入すると配色/レイアウト差分を検知しやすい。

## 運用ルール（必読）
- 新規UIは「テーマ色のハードコード禁止」が原則。`sx` でテーマオブジェクトを参照する。  
- 既存画面の色指定を追加変更する際は、まず `theme` で代替できるか確認し、できない場合は `theme.custom` にセマンティックトークンを追加してから使う。  
- デザイン検証は Storybook か、アプリ内の「デザインガイド」ページ（未実装の場合は Storybook を優先）で確認する。  
- ダークモードをベースとし、ライトモードは `mode: 'light'` でも崩れないか軽く確認する（背景色/テキスト色がテーマ依存になっていれば問題が出にくい）。
