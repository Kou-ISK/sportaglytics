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
    summary: '最近の作業を再開・既存パッケージを開く・新規作成',
    steps: [
      'ホーム画面では、最近開いたパッケージがある場合は最初に表示されます。続きから作業するときは対象のカードを選択してください。',
      '別の既存パッケージは「パッケージを開く」または ファイル > 開く > パッケージ… から選択できます。.stpkg をホーム画面へドラッグ&ドロップして開くこともできます。',
      '新しい分析を始める場合は「新しいパッケージを作成」または ファイル > 新規 > パッケージ… から、映像・アングル・チーム名を登録します。',
    ],
  },
  {
    id: 'playback',
    title: '映像再生と同期',
    summary: '複数アングルの再生と同期位置の調整',
    steps: [
      'パッケージ読込後は共通タイムライン上で各アングルを再生します。Spaceで再生/停止、左右の矢印キーと修飾キーで低速・高速・逆再生を操作できます。',
      '同期メニューでは、自動同期（Cmd/Ctrl+Shift+S）、手動同期モード（Cmd/Ctrl+Shift+T）、同期オフセットのリセット（Cmd/Ctrl+Shift+R）を実行できます。',
      '「今の位置で同期」は既定で Cmd/Ctrl+Shift+M です。設定 > ホットキー で現在の割り当てを確認・変更できます。',
    ],
  },
  {
    id: 'tagging',
    title: 'タグ付け（コードウィンドウ）',
    summary: 'アクション記録・ラベル付け・コードウィンドウの編集',
    steps: [
      'コードウィンドウのアクションボタンを押すと記録を開始し、同じアクションをもう一度実行すると終了します。ボタンに割り当てたホットキーからも同じ処理を実行できます。',
      'コードウィンドウは映像画面とは独立したウィンドウです。コード / ラベルを切り替えながら操作し、必要な場合だけ編集モードへ切り替えます。',
      '編集モードではボタンの位置・サイズ・文字サイズ・色・ホットキー・リンクを変更できます。編集モード中は通常のコーディング用ホットキーを無効化します。',
    ],
  },
  {
    id: 'timeline',
    title: 'タイムライン編集',
    summary: '行・インスタンス・表示倍率を編集する',
    steps: [
      'ウィンドウ > タイムラインを開く で独立タイムラインを表示します。下部フッター左の「＋」で行を追加し、右側の「− 100% ＋」で表示倍率を変更できます。Cmd/Ctrlを押しながらホイール操作でも拡大・縮小できます。',
      'インスタンスをクリックすると選択し、ドラッグすると別の行へ移動できます。Option/Altを押しながらドラッグするとコピーします。複数選択した状態では選択中のインスタンスをまとめて移動・コピーできます。',
      '空いている範囲をドラッグすると範囲選択できます。インスタンスを右クリックすると、編集・削除・複製・ジャンプ・プレイリスト追加などの操作を開けます。Delete/Backspaceでは選択中のインスタンスを削除します。',
      'macOSでは、選択中のインスタンスに対して Command+Option を押しながら左右端をドラッグすると開始・終了位置を調整できます。同じ修飾キーを押しながら再生ヘッドからドラッグすると、その行に新しい区間を作成できます。',
      '行はドラッグまたは右クリックで並べ替え・編集できます。上部の並べ替えメニューでは、色・名前・インスタンス数で行をまとめて並べ替えられます。Undo/Redo は Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z です。',
    ],
  },
  {
    id: 'stats',
    title: '分析',
    summary: 'ダッシュボード・モメンタム・クロス集計を確認する',
    steps: [
      'ウィンドウ > 分析を開く、または既定の Cmd/Ctrl+Shift+A で分析を開きます。',
      'ダッシュボード・モメンタム・クロス集計を切り替え、チーム / アクション / ラベルで対象を絞り込めます。',
      'クロス集計では軸を切り替えられ、セルから該当インスタンスへ移動できます。',
    ],
  },
  {
    id: 'export',
    title: 'エクスポート / インポート',
    summary: 'タイムラインと映像クリップを入出力する',
    steps: [
      'ファイル > エクスポート から、タイムラインを JSON / YouTube用CSV / 分析用CSV / Sportscode XML（SCTimeline）で出力できます。',
      '映像クリップは ファイル > エクスポート > 映像クリップ（オーバーレイ付き）から書き出します。書き出し中は専用進捗ウィンドウで進行状況を確認できます。',
      '書き出しに失敗した場合は、まず元映像の場所、保存先の書き込み権限、空き容量を確認してください。進捗ウィンドウの「エラー詳細を表示」から技術情報も確認できます。',
      'ファイル > インポート から JSON / Sportscode XML（SCTimeline）を読み込み、通常のタイムラインとして編集できます。',
    ],
  },
  {
    id: 'playlist',
    title: 'プレイリスト',
    summary: '選択した映像区間をまとめて再生・提示する',
    steps: [
      'タイムラインでインスタンスを選択し、右クリックまたは既定の Cmd/Ctrl+Shift+P からプレイリストへ追加します。',
      'ウィンドウ > プレイリストを開く で専用ウィンドウを表示し、再生順の並べ替え、フリーズフレーム、描画、ノート編集、ループ設定を行えます。',
      'プレイリストからメインプレイヤーへ再生位置を連携できます。',
    ],
  },
  {
    id: 'settings',
    title: '設定とコードウィンドウ',
    summary: 'テーマ・オーバーレイ・ホットキー・コードウィンドウを管理する',
    steps: [
      'SporTagLytics > 設定… または Cmd/Ctrl+, で設定を開きます。未保存の変更がある状態でタブを切り替える場合は確認が表示されます。',
      '一般ではテーマとクリップオーバーレイ、ホットキーでは再生・同期・分析・Undo/Redoなどの割り当てを編集できます。',
      'コードウィンドウは ファイル > 新規 > コードウィンドウ… で作成し、ファイル > 開く > コードウィンドウ… から既存の .stcw を開きます。レイアウトの編集・保存はコードウィンドウ内の編集モードで行います。',
    ],
  },
  {
    id: 'shortcuts',
    title: 'キーボードショートカット',
    summary: '高速に分析するための主要操作を確認する',
    steps: [
      'Space: 再生/停止。Right / Left: 0.5倍速の順再生 / 逆再生。Shift、Command/Ctrl、Option/Altとの組み合わせで速度を切り替えます。',
      '既定では Cmd/Ctrl+Shift+S: 自動同期、Cmd/Ctrl+Shift+R: 同期リセット、Cmd/Ctrl+Shift+M: 今の位置で同期、Cmd/Ctrl+Shift+T: 手動同期モードです。',
      'Cmd/Ctrl+Shift+A: 分析、Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z: Undo / Redo。実際の割り当ては 設定 > ホットキー が正本です。',
      'コードウィンドウのボタン用ホットキーはレイアウトごとに設定できます。チームやアクションごとの割り当てもコードウィンドウ設定に従います。',
    ],
  },
  {
    id: 'troubleshooting',
    title: 'トラブルシューティング',
    summary: '再生・同期・書き出し・保存の問題を切り分ける',
    steps: [
      '映像を再生できない場合は、元ファイルが移動・削除されていないか、アプリから参照できる場所にあるかを確認してください。',
      '同期が合わない場合は、自動同期を再実行し、必要に応じて同期オフセットをリセットしてから手動同期を行います。',
      '画面下部にエラーが表示された場合、対処方法を先に確認してください。「エラー詳細を表示」がある場合は、原因調査に必要な技術情報を展開できます。エラー表示は内容を確認して閉じるまで残ります。',
      '映像書き出しに失敗した場合は、元映像の場所、保存先の権限、空き容量を確認します。FFmpeg等の詳細は進捗ウィンドウの詳細表示から確認してください。',
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
      (section) =>
        `<button class="nav-item" type="button" role="tab" aria-selected="false" aria-controls="${escapeHtml(section.id)}" data-target="${escapeHtml(section.id)}" data-search="${escapeHtml(`${section.title} ${section.summary} ${section.steps.join(' ')}`)}">
          <span class="nav-title">${escapeHtml(section.title)}</span>
          <span class="nav-summary">${escapeHtml(section.summary)}</span>
        </button>`,
    )
    .join('');

  const contentItems = sections
    .map(
      (section) => `
        <section id="${escapeHtml(section.id)}" class="content-section" role="tabpanel" tabindex="-1">
          <h2>${escapeHtml(section.title)}</h2>
          <p class="summary">${escapeHtml(section.summary)}</p>
          <ol>
            ${section.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
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
      <title>SporTagLytics ヘルプ</title>
      <style>
        :root {
          color-scheme: light dark;
          --bg: #f5f5f5;
          --sidebar: #ffffff;
          --surface: #ffffff;
          --text: #000000;
          --secondary: #666666;
          --divider: rgba(0,0,0,.12);
          --accent: #1e90ff;
          --selected: rgba(30,144,255,.12);
          --hover: rgba(0,0,0,.05);
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #0d0d0d;
            --sidebar: #121212;
            --surface: #121212;
            --text: #ffffff;
            --secondary: #e0e0e0;
            --divider: rgba(255,255,255,.12);
            --accent: #1e90ff;
            --selected: rgba(30,144,255,.16);
            --hover: rgba(255,255,255,.08);
          }
        }
        * { box-sizing: border-box; }
        body {
          font-family: Inter, "Noto Sans JP", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          margin: 0;
          background: var(--bg);
          color: var(--text);
          font-size: 14px;
        }
        h1, h2 { margin: 0; letter-spacing: -.015em; }
        h1 { font-size: 22px; }
        h2 { font-size: 24px; }
        .layout { display: grid; grid-template-columns: minmax(250px, 310px) minmax(0, 1fr); min-height: 100vh; }
        .sidebar { border-right: 1px solid var(--divider); background: var(--sidebar); min-width: 0; }
        .sidebar-header { position: sticky; top: 0; z-index: 2; padding: 20px 16px 12px; background: var(--sidebar); }
        .subtitle { margin: 3px 0 14px; color: var(--secondary); font-size: 12px; }
        .search { width: 100%; min-height: 36px; padding: 7px 11px; border: 1px solid var(--divider); border-radius: 12px; background: var(--surface); color: var(--text); font: inherit; }
        .search:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
        .nav { padding: 4px 8px 20px; }
        .nav-item { width: 100%; display: block; text-align: left; background: transparent; color: var(--text); border: 0; border-radius: 12px; padding: 9px 10px; margin: 1px 0; cursor: pointer; }
        .nav-item:hover { background: var(--hover); }
        .nav-item:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
        .nav-item[aria-selected="true"] { background: var(--selected); color: var(--accent); }
        .nav-item[hidden] { display: none; }
        .nav-title, .nav-summary { display: block; }
        .nav-title { font-weight: 700; }
        .nav-summary { margin-top: 2px; font-size: 12px; color: var(--secondary); line-height: 1.35; }
        .content { min-width: 0; padding: clamp(24px, 5vw, 54px); }
        .content-section { display: none; max-width: 760px; }
        .content-section.active { display: block; }
        .summary { color: var(--secondary); margin: 8px 0 28px; font-size: 15px; }
        ol { margin: 0; padding-left: 24px; }
        li { margin-bottom: 16px; padding-left: 4px; line-height: 1.65; }
        .empty { display: none; padding: 18px 10px; color: var(--secondary); text-align: center; }
        .empty.active { display: block; }
        @media (max-width: 720px) {
          .layout { grid-template-columns: 1fr; }
          .sidebar { border-right: 0; border-bottom: 1px solid var(--divider); }
          .sidebar-header { padding-top: 14px; }
          .nav { max-height: 210px; overflow: auto; }
          .content { padding: 24px 20px 40px; }
        }
        @media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto !important; } }
      </style>
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h1>ヘルプ</h1>
            <p class="subtitle">機能名・操作・ショートカットを検索できます</p>
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
          navButtons.forEach((button) => {
            button.hidden = !button.dataset.search.toLocaleLowerCase().includes(query);
          });
          const firstVisible = navButtons.find((button) => !button.hidden);
          empty.classList.toggle('active', !firstVisible);
          if (firstVisible) showSection(firstVisible.dataset.target);
          else contentSections.forEach((section) => section.classList.remove('active'));
        });
        search.addEventListener('keydown', (event) => {
          if (event.key === 'Escape' && search.value) {
            search.value = '';
            search.dispatchEvent(new Event('input'));
          }
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
    backgroundColor: '#0d0d0d',
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
