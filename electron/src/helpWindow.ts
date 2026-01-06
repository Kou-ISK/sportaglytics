import { BrowserWindow, app } from 'electron';

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
      'ホーム画面や ファイル > 新規パッケージ作成 からウィザードを開始し、映像・角度・チーム名を登録すると .metadata/config.json と timeline.json が生成されます。',
      '既存パッケージはホーム画面の「既存パッケージを開く」または ファイル > 開く... で選択。メニューの「最近開いたパッケージ」から再開することもできます。',
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
      'レイアウトは 設定 > コードウィンドウ で編集（複製/インポート/エクスポート）。複数ボタンのまとめ移動・サイズ調整、フォントサイズ変更、色やリンク（排他/連動/無効化）も設定できます。',
    ],
  },
  {
    id: 'timeline',
    title: 'タイムライン編集',
    summary: 'イベントの編集・移動・複製・プレイリスト追加',
    steps: [
      '画面下部のビジュアルタイムラインでクリックジャンプ、ホイールズーム、ドラッグ範囲選択が可能。範囲選択後に一括操作できます。',
      'イベントを右クリックして編集/削除/重複/移動/ラベル付与/プレイリスト追加を実行。ツールバーにも主要操作ボタンがあります。',
      '編集ダイアログで時間・メモ・ラベルをまとめて更新。Undo/Redo は Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z で呼び出します。',
    ],
  },
  {
    id: 'stats',
    title: '統計ダッシュボード',
    summary: 'ポゼッション・結果・種別・モメンタム・クロス集計の可視化',
    steps: [
      'メニュー（分析）またはショートカット Cmd/Ctrl + Shift + A で開きます。',
      'ポゼッション・結果・種別・モメンタム・クロス集計を切り替え、チーム/アクション/ラベルでフィルタできます。',
      'クロス集計では軸を自由に切り替えられ、セルをクリックすると該当イベントへジャンプします。',
    ],
  },
  {
    id: 'export',
    title: 'エクスポート / インポート',
    summary: 'タイムラインとクリップの入出力',
    steps: [
      'ファイル > エクスポート から、タイムラインを JSON / CSV / SCTimeline 形式で出力できます。',
      'クリップ書き出しは ファイル > エクスポート > 映像クリップ から。単一/インスタンスごと/行ごと、1-2アングル結合、オーバーレイ表示の有無を選択して FFmpeg で出力します。',
      'ファイル > インポート から JSON/SCTimeline を読み込みタイムラインへ反映（JSON優先で自動判定）します。取り込み後はタイムラインで内容を確認してください。',
    ],
  },
  {
    id: 'playlist',
    title: 'プレイリスト',
    summary: 'プレイリスト専用ウィンドウで再生・メモ・描画',
    steps: [
      'タイムラインでイベントを複数選択し、右クリックまたはツールバーのプレイリストボタンから追加。追加後はドラッグで順序を並べ替えできます。',
      'メニュー「ウィンドウ > プレイリストウィンドウを開く」で専用ウィンドウを表示し、再生/フリーズフレーム/簡易描画/ノート編集、ループ設定（なし/単一/全体）が可能です。',
      'プレイリストからメインプレイヤーへシーク・再生できます。ウィンドウを閉じてもメニューから再度開き直せます。',
    ],
  },
  {
    id: 'settings',
    title: '設定とコードウィンドウ管理',
    summary: 'テーマ・オーバーレイ・ホットキー・コードウィンドウ（レイアウト/ホットキー）の編集',
    steps: [
      'メニューの「設定...」または Cmd/Ctrl + , で開きます（未保存検知あり）。',
      '一般: テーマ（ライト/ダーク/システム）、クリップオーバーレイの表示項目・テンプレートを編集できます。',
      'ホットキー: 再生/同期/分析/Undo/Redoなどのグローバルキーを編集。',
      'コードウィンドウ: アクティブなコードウィンドウの選択、レイアウトの新規/複製/削除/インポート/エクスポート、ボタンの配置・色・フォントサイズ・ホットキー・リンクを編集できます（複数選択でまとめ移動・サイズ変更が可能）。設定保存後にメイン画面の表示とホットキーが即時切り替わります。',
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

const buildHelpHtml = () => {
  const navItems = sections
    .map(
      (s) =>
        `<button class="nav-item" data-target="${s.id}">
          <div class="nav-title">${s.title}</div>
          <div class="nav-summary">${s.summary}</div>
        </button>`,
    )
    .join('');

  const contentItems = sections
    .map(
      (s) => `
        <section id="${s.id}" class="content-section">
          <h2>${s.title}</h2>
          <p class="summary">${s.summary}</p>
          <ol>
            ${s.steps.map((step) => `<li>${step}</li>`).join('')}
          </ol>
          <button class="back-to-list" data-target="list">一覧に戻る</button>
        </section>
      `,
    )
    .join('');

  return `
  <html>
    <head>
      <meta charset="UTF-8" />
      <title>ヘルプ / 機能一覧</title>
      <style>
        :root { color-scheme: dark; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; background: #0b1224; color: #e2e8f0; }
        h1, h2 { color: #cbd5e1; margin: 0; }
        h1 { font-size: 22px; }
        h2 { font-size: 20px; }
        p, ol, ul { margin: 0; padding: 0; }
        .layout { display: grid; grid-template-columns: 320px 1fr; min-height: 100vh; }
        .sidebar { border-right: 1px solid rgba(255,255,255,0.08); padding: 20px; background: #0f172a; }
        .content { padding: 24px; }
        .nav-item { width: 100%; text-align: left; background: rgba(255,255,255,0.04); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; margin-bottom: 10px; cursor: pointer; transition: all 0.15s ease; }
        .nav-item:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
        .nav-title { font-weight: 600; margin-bottom: 4px; }
        .nav-summary { font-size: 13px; color: #a5b4fc; line-height: 1.4; }
        .content-section { display: none; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 20px; max-width: 960px; }
        .content-section.active { display: block; }
        .summary { color: #a5b4fc; margin: 12px 0 12px; }
        ol { padding-left: 20px; color: #e2e8f0; }
        li { margin-bottom: 10px; line-height: 1.6; }
        .back-to-list { margin-top: 16px; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.06); color: #e2e8f0; cursor: pointer; }
        .back-to-list:hover { background: rgba(255,255,255,0.1); }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .home-link { color: #a5b4fc; cursor: pointer; text-decoration: underline; font-size: 13px; }
      </style>
    </head>
    <body>
      <div class="layout">
        <aside class="sidebar">
          <div class="header">
            <h1>機能一覧</h1>
          </div>
          ${navItems}
        </aside>
        <main class="content">
          <div id="placeholder" class="content-section active" style="display:block;">
            <h2>使い方ガイドへようこそ</h2>
            <p class="summary">左の一覧から知りたい機能を選ぶと、使い方の手順が表示されます。</p>
            <p>各ページで、操作方法やショートカット、設定のポイントを確認できます。</p>
          </div>
          ${contentItems}
        </main>
      </div>
      <script>
        const navButtons = Array.from(document.querySelectorAll('.nav-item'));
        const sections = Array.from(document.querySelectorAll('.content-section'));
        const placeholder = document.getElementById('placeholder');

        const showSection = (id) => {
          sections.forEach((sec) => {
            sec.classList.remove('active');
            sec.style.display = 'none';
          });
          const target = document.getElementById(id);
          if (target) {
            target.classList.add('active');
            target.style.display = 'block';
          }
        };

        navButtons.forEach((btn) => {
          btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-target');
            showSection(target);
          });
        });

        document.querySelectorAll('.back-to-list').forEach((btn) => {
          btn.addEventListener('click', () => {
            sections.forEach((sec) => {
              sec.classList.remove('active');
              sec.style.display = 'none';
            });
            placeholder?.classList.add('active');
            if (placeholder) placeholder.style.display = 'block';
          });
        });
      </script>
    </body>
  </html>
  `;
};

export const openHelpWindow = () => {
  if (helpWindow && !helpWindow.isDestroyed()) {
    helpWindow.focus();
    return;
  }

  helpWindow = new BrowserWindow({
    width: 960,
    height: 920,
    autoHideMenuBar: true,
    backgroundColor: '#0b1224',
    webPreferences: { contextIsolation: true },
  });

  helpWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(buildHelpHtml())}`,
  );
  helpWindow.on('closed', () => {
    helpWindow = null;
  });
};

app.on('window-all-closed', () => {
  helpWindow = null;
});
