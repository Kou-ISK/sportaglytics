import { BrowserWindow, app } from 'electron';
import { applyWindowSecurity } from './windowSecurity';

let helpWindow: BrowserWindow | null = null;

type HelpSection = {
  id: string;
  title: string;
  summary: string;
  steps: string[];
};

const sections: HelpSection[] = [
  {
    id: 'packages',
    title: 'パッケージ管理',
    summary: '新規作成・既存パッケージを開く・最近開いたパッケージへ再アクセス',
    steps: [
      'ホーム画面または ファイル > 新規 > 映像パッケージ… からウィザードを開始し、映像・角度・チーム名を登録すると .metadata/config.json と timeline.json が生成されます。',
      '既存パッケージはホーム画面の「既存パッケージを開く」または ファイル > 開く > 映像パッケージ… で選択。メニューの「最近開いた映像パッケージ」から再開することもできます。',
      'パッケージフォルダをドラッグ&ドロップしても開けます。映像パスは相対パスで保存されるためフォルダ移動に強い構造です。',
    ],
  },
  {
    id: 'playback',
    title: '映像再生と同期',
    summary: '2映像の同期再生とオフセット調整',
    steps: [
      'パッケージ読込時に角度情報からプライマリ/セカンダリを自動割り当て。再生はプレイヤーのコントロール、Space、矢印キー（スロー/戻し/高速）で操作できます。',
      '音声同期コマンド: Cmd/Ctrl+Shift+S 再実行、Cmd/Ctrl+Shift+R リセット、Cmd/Ctrl+Shift+M 現在位置を採用。メニュー（同期）またはホットキーから呼び出します。',
      '手動モード (Cmd/Ctrl+Shift+T) をオンにすると各プレイヤーを個別シークでき、細かなオフセット調整が可能です。',
    ],
  },
  {
    id: 'tagging',
    title: 'タグ付け（コードウィンドウ）',
    summary: 'アクション記録とラベル付け、コードウィンドウのホットキー操作',
    steps: [
      'メイン画面右側のコードウィンドウでボタンを押すと録画開始/終了。同時に複数アクションを記録できます（プレースホルダー ${Team1}/${Team2} はチーム名に置換されます）。',
      'ホットキーは各コードウィンドウのボタンに設定したものが有効です（デフォルト例では2チーム目に Shift+キーを割り当てていますが任意に設定可能）。',
      'レイアウトは独立コードウィンドウの編集モードで編集します。複数ボタンのまとめ移動・サイズ調整、フォントサイズ変更、色やリンク（排他/連動/無効化）も行えます。',
    ],
  },
  {
    id: 'timeline',
    title: 'タイムライン編集',
    summary: 'イベントの編集・移動・複製・プレイリスト追加',
    steps: [
      '画面下部のビジュアルタイムラインでクリックジャンプ、ホイールズーム、ドラッグ範囲選択が可能。範囲選択後に一括操作できます。',
      'イベントを右クリックして編集/削除/重複/移動/ラベル付与/プレイリスト追加を実行。選択中のイベントは Cmd/Ctrl+Shift+P でもプレイリストに追加できます。',
      '編集ダイアログで時間・メモ・ラベルをまとめて更新。Undo/Redo は Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z で呼び出します。',
    ],
  },
  {
    id: 'stats',
    title: '統計ダッシュボード',
    summary: 'ポゼッション・結果・種別・モメンタム・クロス集計の可視化',
    steps: [
      'メニュー（分析）またはショートカット Cmd/Ctrl + Shift + A で開きます。',
      'ダッシュボード・モメンタム・クロス集計・AI分析を切り替え、チーム/アクション/ラベルでフィルタできます。',
      'クロス集計では軸を自由に切り替えられ、セルをクリックすると該当イベントへジャンプします。',
    ],
  },
  {
    id: 'export',
    title: 'エクスポート / インポート',
    summary: 'タイムラインとクリップの入出力',
    steps: [
      'ファイル > エクスポート から、タイムラインを JSON / CSV（YouTube） / Raw CSV / SCTimeline 形式で出力できます。',
      'クリップ書き出しは ファイル > エクスポート > 映像クリップ から。単一/インスタンスごと/行ごと、1-2アングル結合、オーバーレイ表示の有無を選択して FFmpeg で出力します。書き出し中は実処理に連動する専用進捗ウィンドウで状態を確認でき、メインウィンドウの操作も継続できます。',
      '分析ウィンドウのエクスポートメニューでは、構造化サマリーをコピー / 現在タブをPNGで保存（全内容） / 分析レポートをPDFで保存 を実行できます。',
      'クロス集計タブでは、現在表示中の表のみをCSV / XLSXで出力できます（異なる種類の表は同じファイルに混在しません）。',
      'ファイル > インポート から JSON/SCTimeline を読み込みタイムラインへ反映（JSON優先で自動判定）します。取り込み後はタイムラインで内容を確認してください。',
    ],
  },
  {
    id: 'playlist',
    title: 'プレイリスト',
    summary: 'プレイリスト専用ウィンドウで再生・メモ・描画',
    steps: [
      'タイムラインでイベントを複数選択し、右クリック、ツールバーのプレイリストボタン、または Cmd/Ctrl+Shift+P から追加。追加後はドラッグで順序を並べ替えできます。',
      'メニュー「ウィンドウ > プレイリストウィンドウを開く」で専用ウィンドウを表示し、再生/フリーズフレーム/簡易描画/ノート編集、ループ設定（なし/単一/全体）が可能です。',
      'プレイリストからメインプレイヤーへシーク・再生できます。ウィンドウを閉じてもメニューから再度開き直せます。',
    ],
  },
  {
    id: 'settings',
    title: '設定とコードウィンドウ',
    summary: 'テーマ・オーバーレイ・ホットキーの設定と .stcw の編集',
    steps: [
      'メニューの「設定...」または Cmd/Ctrl + , で開きます（未保存検知あり）。',
      '一般: テーマ（ライト/ダーク/システム）、クリップオーバーレイの表示項目・テンプレートを編集できます。',
      'ホットキー: 再生/同期/分析/Undo/Redoなどのグローバルキーを編集。',
      'コードウィンドウ: ファイル > 新規 > コードウィンドウ… から空の .stcw を作成し、ファイル > 開く > コードウィンドウ… から既存ファイルを選択します。ボタン配置・色・フォントサイズ・ホットキー・リンクの編集と保存は独立コードウィンドウで行います。',
      '設定ファイルの保存先: macOS は ~/Library/Application Support/sportaglytics/settings.json（アプリ側で自動保存・読込）。',
    ],
  },
  {
    id: 'shortcuts',
    title: 'キーボードショートカット',
    summary: '再生・同期・分析・Undo/Redoなどの主要ショートカット',
    steps: [
      'Space: 再生/停止、Right/Left: スロー/戻し、Cmd/Ctrl+Right: 高速再生（押下中）。',
      'Cmd/Ctrl+Shift+S/R/M/T: 音声同期再実行 / リセット / 現在位置で手動同期 / 手動モード切替。',
      'Cmd/Ctrl+Shift+A: 統計ダッシュボードを開く。Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z: Undo / Redo。タグ付けのホットキーは 設定 > ホットキー で確認・変更できます。',
      'コードウィンドウのボタンに割り当てたホットキーは任意に設定できます（2チーム目に Shift+キーを使うのはデフォルト例）。',
    ],
  },
  {
    id: 'troubleshooting',
    title: 'トラブルシューティング',
    summary: '再生・同期・保存周りのヒント',
    steps: [
      '映像再生不可: MP4/MOV (H.264/AAC) を推奨。権限とファイルパス、コーデックを確認してください。',
      '同期ずれ: 音声有無を確認後、同期リセット→再実行。必要なら手動同期や手動モードで微調整します。',
      '書き出し/保存エラー: 保存先の権限と空き容量を確認し、別ディレクトリで再試行。クリップ書き出し失敗時は元映像のパス存在も確認してください。',
    ],
  },
];

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

export const buildHelpHtml = (): string => {
  const navItems = sections
    .map(
      (s) =>
        `<button class="nav-item" type="button" role="tab" aria-selected="false" aria-controls="${escapeHtml(s.id)}" data-target="${escapeHtml(s.id)}" data-search="${escapeHtml(`${s.title} ${s.summary} ${s.steps.join(' ')}`)}">
          <span class="nav-title">${escapeHtml(s.title)}</span>
          <span class="nav-summary">${escapeHtml(s.summary)}</span>
        </button>`,
    )
    .join('');

  const contentItems = sections
    .map(
      (s) => `
        <section id="${escapeHtml(s.id)}" class="content-section" role="tabpanel">
          <h2>${escapeHtml(s.title)}</h2>
          <p class="summary">${escapeHtml(s.summary)}</p>
          <ol>
            ${s.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
          </ol>
        </section>
      `,
    )
    .join('');

  return `
  <html>
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>ヘルプ</title>
      <style>
        :root { color-scheme: light dark; --bg: #f5f5f7; --sidebar: rgba(246,246,248,.92); --surface: #fff; --text: #1d1d1f; --secondary: #6e6e73; --divider: rgba(0,0,0,.12); --accent: #0066cc; --selected: rgba(0,102,204,.12); }
        @media (prefers-color-scheme: dark) { :root { --bg: #1e1e1e; --sidebar: rgba(38,38,40,.94); --surface: #2b2b2d; --text: #f5f5f7; --secondary: #a1a1a6; --divider: rgba(255,255,255,.14); --accent: #64a8ff; --selected: rgba(100,168,255,.18); } }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: var(--bg); color: var(--text); font-size: 14px; }
        h1, h2 { margin: 0; letter-spacing: -.015em; }
        h1 { font-size: 22px; }
        h2 { font-size: 24px; }
        .layout { display: grid; grid-template-columns: minmax(250px, 310px) minmax(0, 1fr); min-height: 100vh; }
        .sidebar { border-right: 1px solid var(--divider); background: var(--sidebar); min-width: 0; }
        .sidebar-header { position: sticky; top: 0; z-index: 2; padding: 20px 16px 12px; background: var(--sidebar); backdrop-filter: blur(18px); }
        .subtitle { margin: 3px 0 14px; color: var(--secondary); font-size: 12px; }
        .search { width: 100%; min-height: 32px; padding: 6px 10px; border: 1px solid var(--divider); border-radius: 7px; background: var(--surface); color: var(--text); font: inherit; }
        .search:focus { outline: 3px solid color-mix(in srgb, var(--accent) 28%, transparent); border-color: var(--accent); }
        .nav { padding: 4px 8px 20px; }
        .nav-item { width: 100%; display: block; text-align: left; background: transparent; color: var(--text); border: 0; border-radius: 7px; padding: 9px 10px; margin: 1px 0; cursor: default; }
        .nav-item:hover { background: color-mix(in srgb, var(--text) 7%, transparent); }
        .nav-item[aria-selected="true"] { background: var(--selected); color: var(--accent); }
        .nav-item[hidden] { display: none; }
        .nav-title, .nav-summary { display: block; }
        .nav-title { font-weight: 600; }
        .nav-summary { margin-top: 2px; font-size: 12px; color: var(--secondary); line-height: 1.35; }
        .content { min-width: 0; padding: clamp(24px, 5vw, 54px); }
        .content-section { display: none; max-width: 760px; }
        .content-section.active { display: block; }
        .summary { color: var(--secondary); margin: 8px 0 28px; font-size: 15px; }
        ol { margin: 0; padding-left: 24px; }
        li { margin-bottom: 16px; padding-left: 4px; line-height: 1.65; }
        .empty { display: none; padding: 18px 10px; color: var(--secondary); text-align: center; }
        .empty.active { display: block; }
        @media (max-width: 720px) { .layout { grid-template-columns: 1fr; } .sidebar { border-right: 0; border-bottom: 1px solid var(--divider); } .sidebar-header { padding-top: 14px; } .nav { max-height: 210px; overflow: auto; } .content { padding: 24px 20px 40px; } }
        @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
      </style>
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h1>ヘルプ</h1>
            <p class="subtitle">操作や機能を検索できます</p>
            <input id="help-search" class="search" type="search" placeholder="機能や操作を検索" aria-label="ヘルプを検索" autocomplete="off" />
          </div>
          <nav class="nav" role="tablist" aria-label="ヘルプトピック">
            ${navItems}
            <div id="empty" class="empty">一致する項目はありません</div>
          </nav>
        </aside>
        <main class="content">
          ${contentItems}
        </main>
      </div>
      <script>
        const navButtons = Array.from(document.querySelectorAll('.nav-item'));
        const contentSections = Array.from(document.querySelectorAll('.content-section'));
        const search = document.getElementById('help-search');
        const empty = document.getElementById('empty');

        const showSection = (id) => {
          contentSections.forEach((section) => section.classList.toggle('active', section.id === id));
          navButtons.forEach((button) => button.setAttribute('aria-selected', String(button.dataset.target === id)));
          const target = document.getElementById(id);
          if (target) target.focus({ preventScroll: true });
        };

        navButtons.forEach((button) => {
          button.addEventListener('click', () => showSection(button.dataset.target));
          button.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            event.preventDefault();
            const visible = navButtons.filter((candidate) => !candidate.hidden);
            const index = visible.indexOf(button);
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            visible[(index + delta + visible.length) % visible.length]?.focus();
          });
        });

        search.addEventListener('input', () => {
          const query = search.value.trim().toLocaleLowerCase();
          navButtons.forEach((button) => { button.hidden = !button.dataset.search.toLocaleLowerCase().includes(query); });
          const firstVisible = navButtons.find((button) => !button.hidden);
          empty.classList.toggle('active', !firstVisible);
          if (firstVisible) showSection(firstVisible.dataset.target);
          else contentSections.forEach((section) => section.classList.remove('active'));
        });
        search.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && search.value) { search.value = ''; search.dispatchEvent(new Event('input')); }
        });
        showSection(navButtons[0]?.dataset.target);
      </script>
    </body>
  </html>
  `;
};

export const openHelpWindow = (): void => {
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.focus();
    return;
  }

  helpWindow = new BrowserWindow({
    width: 980,
    height: 760,
    minWidth: 620,
    minHeight: 480,
    autoHideMenuBar: true,
    backgroundColor: '#f5f5f7',
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  applyWindowSecurity(helpWindow);

  helpWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildHelpHtml())}`,
  );
  helpWindow.on('closed', () => {
    helpWindow = null;
  });
};

if (app?.on) {
  app.on('window-all-closed', () => {
    helpWindow = null;
  });
}
