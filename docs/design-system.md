# SporTagLytics Design System (Native Analysis / Dark-first)

このドキュメントは SporTagLytics の UI 実装における単一の参照点です。実装上の色・タイポグラフィ・spacing の正本は semantic token と MUI theme (`src/design-system/`; `src/theme.ts` は互換export) とし、本書は「どのトークンを、どの意味で使うか」を定義します。

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

- `primary`: `#64A9FF` (Signal Blue; light は `#0067CE`)
- `secondary`: `#00FF85` (Neon Green)
- `team1`: `#1E90FF`
- `team2`: `#FF6F61`
- `background.default`: `#18181B`
- `background.paper`: `#242426`
- `text.primary`: `#F5F5F7`
- `text.secondary`: `#B3B3BA`
- `text.disabled`: `rgba(255,255,255,0.5)`
- `divider`: `rgba(255,255,255,0.12)`

- `surface.raised`: `#303034`。canvas → work → raised の明度を段階的に上げる。
- チームのデータ色は従来どおり。操作のSignal Blueと分離する。

### Typography

- Font: `-apple-system`, `BlinkMacSystemFont`, `system-ui`, `Inter`, `Noto Sans JP`, `sans-serif`
- 本文・UIラベルは日本語を基本とする。
- `button` は `textTransform: none`, `fontWeight: 700`。
- 数値を連続比較する Timeline 時刻・倍率などは tabular numerals を優先する。

### Shape / spacing / elevation

- `spacing(1) = 8px` を基準とする。
- `shape.borderRadius = 8px` を標準 radius とする。
- Toolbar / Footer の高さは 32–40px 程度を基準とし、分析画面を不必要に圧迫しない。
- application の標準 shadow は `none`。意味のない drop shadow は追加しない。
- 小さな group control 内では 8px radius をそのまま重ねず、外枠が shape を所有して内部 control は連続した形状にしてよい。

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

SporTagLytics は熟練者の速度を優先するため、すべての interaction を常時 UI に露出しません。高度操作は機能別仕様書を正本とし、アプリ内ヘルプに検索できる操作の要約を掲載します。変更時には両方を同期します。

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
   - Paper / Card: `background.paper`, `divider`, radius 8。
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

`pnpm run storybook` で確認し、`pnpm run build:storybook` をCIで実行します。a11y addonはerrorを失敗として扱います。`pnpm run check:design-system` は移行済みUIの色、数値z-index、数値shadowの再導入を検知します。canvas、ユーザー設定、分析データの色は対象外です。

## 運用ルール

- 新規 UI はテーマ色のハードコード禁止が原則。
- 既存画面に色指定を追加する場合は、まず theme で代替できるか確認し、できない場合だけ semantic token を追加する。
- UI の用語を追加する場合は Terminology の原則に従う。
- UI から意図的に隠す高度操作を追加・変更した場合は同じ変更で Help を更新する。
- ダークモードを基準に設計し、ライトモードでも foreground / background / divider が theme 依存で成立することを確認する。

## Native Analysis の作業画面

Sportscodeの映像・コード・Timeline中心の作業モデルを参考に、角を抑えたパネル、細い境界、コンパクトな操作列で構成する。macOSに馴染むニュートラルなsurfaceとシステムフォントを使用し、常時発光や装飾的アニメーションを増やさない。

- 開始画面は開始操作と最近のパッケージを横並びにし、狭い幅では縦並びにする。履歴なし・有効／無効dropも明示する。
- 再生時刻は等幅の専用領域、速度presetは選択状態を明示する。ライトモードでも固定白文字を使わない。
- Timelineは行名を左揃えにし、行色は薄い背景、選択は輪郭と状態で示す。クリップ本体は保存された色を不透明で表示し、文字は背景とのコントラストに応じた白／黒を選ぶ。Footerに行数と選択件数を表示する。
- Playlistは未保存を文字で表示し、長い名称を省略、操作列は必要に応じて折り返す。
- `Workspace/*` storiesで開始画面、再生バー、Timeline行とFooter、Code Window、分析Toolbar、Playlist、設定Headerを確認する。
- ファイル選択・ウィザードとShortcutGuideの外部イベント購読は組み立て側が所有し、対象Viewへcallbackまたはslotを渡す。

## Native Playlist と Paint

- ニュートラルなグレー、システムフォント、控えめな角丸、連続した分割ペインを使用する。青は操作・選択・focusに限定し、ネオンや色付きの背景で分析対象を競わせない。
- Playlist の Organizer / Sorter / Paint は同じツールバーから切り替える。Paint は映像、編集インスペクタ、下部クリップ列で構成する。
- Timeline の行間余白は0。rulerと行を同じスクロールコンテンツに配置し、再生位置線はコンテンツ全体に1本だけ描画する。シークのドラッグ領域は上部つまみだけとし、目盛りと行内の線はシークを受け付けない。行内は修飾キーによる区間作成時だけ操作可能とし、端の編集ハンドルを優先する。伸縮はローカルプレビューとし、pointer終了で1回確定、Escで取消する。Paintの数値入力もEnter/blurで確定・Escで取消し、空欄を0へ変換しない。空白クリックでは選択とフォーカス枠を同時に解除する。アクションのツールチップは情報表示専用とし、下の行・空白・つまみへのポインター入力を遮らない。
- 初期行色はアクションボタンの色を引き継ぐ。既存の行色は行モデルが所有する。
- Paint の図形色・線幅・不透明度は注釈データであり、UI chromeのsemantic tokenとは区別する。描画ツール、プロパティ、レイヤー、再生操作は独立したprops-only Viewで構成する。

### 再生操作・Paintの配置

`MovieTransportView` と `mediaChromeSx` を共通使用します。再生操作面は角丸、82%不透明のmedia色、背景ぼかしで構成します。Playlistでは映像端から8px離し、内側のボタン群は透明にします。時刻は等幅表示とし、送り量は呼び出し元の実際の秒数でラベルを付けます。

Paintは左にツール、右に設定、映像下部に再生→目盛り→描画行を置きます。タブ名はスタイル・動き・ピッチ・素材、説明時の簡略表示はプレゼンです。位置キーは24pxの操作領域に菱形を描き、選択を色と輪郭で示します。操作・上限の正本は[Paint](tactics.md)です。

選手リンクは足元のクリックで点を追加します。人数のプルダウンは使いません。ディスクの陰影・光沢は注釈データの描画表現であり、UI chromeのsurface/elevationとは区別します。

固定操作ラベルはボタン内で改行せず、操作群をwrapとgapで段分けします。可変長の素材名・レイヤー名は一行省略します。右パネルの開閉操作はスクロール本文の外に置き、aria-expanded/aria-controlsを付けます。

右クリックメニューは共通Menu/MenuItem tokenを使い、13px相当の文字、30pxの行、17pxのアイコン、細い境界と控えめな角丸を統一します。ListItemTextは親の文字サイズを継承し、hoverとキーボードfocusは同じ選択色を使います。

### 起動画面

製品名は初回案内の完了後も表示します。開く・新規作成・dropの操作面と、検索可能な履歴を分け、狭い幅では縦に並べます。履歴はコンパクトな行に名称・チーム・保存場所・最終利用を示します。読み込み中と再試行可能なエラーは同じ画面に表示します。状態と操作の正本は[起動画面](start-workspace.md)です。

### 参照資料の扱い

2026-09-10に確認した[Hudl Sportscode製品ページ](https://www.hudl.com/products/sportscode)の `HSC_explainer_video_202603` と[Hudl Studio製品ページ](https://www.hudl.com/products/studio)は操作配置の参考資料です。公開画像を特定版の実行画面と断定せず、その後のユーザー指定（角丸・半透明、クリックによるリンク作成）を現行仕様へ反映しています。参照時の試行過程や旧デザインを実装規約として併記しません。

映像操作面の `mediaChromeSx` は、ライトテーマでも子のボタン・文字・入力に `media.foreground` を明示します。中間のMUIコンポーネントが持つ通常画面用の文字色を継承させず、暗い半透明面上の可読性を保ちます。

### 戦術盤

ピッチ面・白線には `data.pitchSurface` / `data.pitchLine` を使用します。選手の所属は `team1` / `team2`、未分類は通常surface、選択はprimaryで表します。周囲のダイアログ・ツールバーは既存surfaceとdividerを共有し、操作ラベルは折り返さず、必要な場合は操作群を折り返します。

## アングル同期ワークスペース

- [アングル同期仕様](angle-synchronization.md)を操作の正本とします。映像面はプレビューのみとし、Sync Point / Align Anglesとコマ送り・保存を独立タイムラインへ置きます。既存の再生ヘッドを使い、アングル表示は数字キーで切り替えます。元ファイルのセレクターや配置カードを置きません。
- 同期中も映像面の比率を管理します。1アングル、2アングル横並び、3〜4アングル2×2へ切り替え、操作バーの実寸を除外してOSウィンドウを調整します。固定の最低420pxや、検証時にウィンドウを縦へ広げる前提を置きません。
- `AngleSyncWorkspaceView` / `AngleSyncPreviewView` / `AngleSyncTransportView` / `SyncTimecodeView`はpropsで描画します。動画の時計・IPC・保存はhook/Screenへ分離します。native controlsは無効にし、Video.js公式CSSで内部ダイアログの露出を防ぎます。
- 時刻はtabular numerals、同期点は◆とラベル、選択アングルはタイムライン上部の名前とアングル行の強調で示します。ボタンの文字は折り返さず、狭いタイムラインでは操作群と状態文の高さを増やします。
- Storybook `Features/VideoPlayer/AngleSync`で単一・2・4アングル、空、エラー、保存中、狭幅を確認します。公式資料との対応と確認限界は同期仕様に記録します。
