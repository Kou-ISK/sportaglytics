# コードウィンドウ編集機能 実装ドキュメント

## 概要

SporTagLyticsのコードウィンドウは、`.stcw` ドキュメントとして作成・保存し、独立ウィンドウ上でボタン配置をカスタマイズします。ドラッグ&ドロップによるボタン配置、ボタン間のリンク設定、Undo/Redo履歴管理を行えます。

## アーキテクチャ

### コンポーネント構成

```
src/
├── features/
│   ├── videoPlayer/app/
│   │   ├── CodingPanelWindowScreen.tsx     # 独立ウィンドウ
│   │   └── CodingPanelWindowEditPane.tsx   # 編集ペイン
│   └── settings/components/CodeWindowSettings/
│       ├── FreeCanvasEditor.tsx               # 自由配置プリミティブ
│       └── ButtonPropertiesEditorNew.tsx      # Inspector用プリミティブ
├── types/
│   └── settings/coreTypes.ts                  # layout型定義
└── electron/src/ipc/codeWindowHandlers.ts             # .stcw 入出力
```

### データ構造

```typescript
// コードウィンドウレイアウト
interface CodeWindowLayout {
  id: string;
  name: string;
  canvasWidth: number; // 400-2000px
  canvasHeight: number; // 300-1500px
  buttons: CodeWindowButton[];
  buttonLinks?: ButtonLink[];
  splitByTeam?: boolean;
  team1Area?: TeamArea;
  team2Area?: TeamArea;
}

// ボタン定義
interface CodeWindowButton {
  id: string;
  type: 'action' | 'label';
  name: string;
  labelValue?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  textColor?: string;
  fontSize?: number;
  borderRadius?: number;
  hotkey?: string;
  showHotkey?: boolean;
  team?: 'team1' | 'team2' | 'shared';
}

// ボタンリンク
interface ButtonLink {
  id: string;
  fromButtonId: string;
  toButtonId: string;
  linkType: 'exclusive' | 'activate' | 'deactivate' | 'sequence';
}
```

## 主要機能

### 2026-06-17 更新メモ

- `.stcw` の `canvasWidth` / `canvasHeight` は、独立ウィンドウのボタン配置編集ペインに実寸で適用する。
- ボタン単位で `showHotkey` を保持する。`hotkey` が設定されているボタンでは、基本タブからショートカットキーの表示/非表示を切り替えられる。
- コードパネル実表示と自由配置エディタの両方で、`showHotkey: true` のボタンにショートカットキーを小さく表示する。
- 複数選択済みのボタンをドラッグする場合、クリックしたボタンだけに選択を戻さず、選択中のボタン群をまとめて移動する。
- コードパネルはメイン動画ウィンドウ内のペインとしては表示せず、Sportscode と同様に独立したコードウィンドウとして開く。コードウィンドウ側は表示状態とクリック command のみを扱い、タグ付け時刻・押下状態・タイムライン更新はメイン動画ウィンドウ側で確定する。
- コードウィンドウにフォーカスがある状態でも再生/停止、早送り、巻き戻し、コードボタン hotkey などを受け取り、メイン動画ウィンドウへ command として転送する。
- `.stcw` を OS から開いた場合は設定画面ではなく独立コードウィンドウとして読み込み、開いている映像パッケージに対してタグ付けできる。
- 開発起動中や brew 版とのファイル関連付け競合がある場合でも、「ファイル > 開く > コードウィンドウ…」から起動中アプリへ直接 `.stcw` を読み込める。
- 独立コードウィンドウはコード / ラベル / 編集モードを同一ウィンドウ内で切り替える。編集モードでは設定画面を経由せず、開いているコードウィンドウ上でボタン配置、ボタンプロパティ、リンクを編集する。
- 編集モード中も保存済みキャンバスサイズを維持し、コードウィンドウのリサイズでは変更しない。表示領域を超えるキャンバスはスクロールして編集し、保存時は現在の runtime layout を `.stcw` へ保存してメイン動画ウィンドウ側と同期する。
- 実行表示と編集表示は同じボタンsurfaceを使い、色、輪郭、文字サイズ、位置、寸法を一致させる。編集時は選択輪郭と操作handleだけを追加する。
- 独立コードウィンドウ編集では右側の常設編集ペインを表示しない。Sportscode の Inspector 導線に合わせ、ボタンを右クリックまたはダブルクリックした時だけボタン Inspector ダイアログを開く。

### 1. 自由配置エディタ（FreeCanvasEditor）

#### キャンバス描画

```typescript
const FreeCanvasEditor: React.FC<FreeCanvasEditorProps> = ({
  layout,
  onLayoutChange,
  selectedButtonIds,
  onSelectButtons,
  availableActions,
  availableLabelGroups,
  showLinks = true,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [history, setHistory] = useState<CodeWindowLayout[]>([layout]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // グリッドスナップ（10px）
  const gridSize = 10;
  const snapToGrid = (value: number) => Math.round(value / gridSize) * gridSize;

  return (
    <Box
      ref={canvasRef}
      sx={{
        position: 'relative',
        width: layout.canvasWidth,
        height: layout.canvasHeight,
        border: '2px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        backgroundImage: `
          linear-gradient(0deg, rgba(255,255,255,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)
        `,
        backgroundSize: `${gridSize}px ${gridSize}px`,
      }}
    >
      {/* ボタンとリンクのレンダリング */}
    </Box>
  );
};
```

#### ドラッグ&ドロップ

```typescript
const handleMouseDown = (e: React.MouseEvent, button: CodeWindowButton) => {
  if (e.button !== 0) return; // 左クリックのみ

  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const startX = e.clientX - rect.left;
  const startY = e.clientY - rect.top;

  setDragState({
    isDragging: true,
    draggedButton: button,
    dragOffset: { x: startX - button.x, y: startY - button.y },
  });
};

const handleMouseMove = (e: MouseEvent) => {
  if (!dragState.isDragging || !dragState.draggedButton) return;

  const rect = canvasRef.current?.getBoundingClientRect();
  if (!rect) return;

  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;

  const newX = snapToGrid(mouseX - dragState.dragOffset.x);
  const newY = snapToGrid(mouseY - dragState.dragOffset.y);

  // ボタン位置を更新
  updateButtonPosition(dragState.draggedButton.id, newX, newY);
};
```

#### 複数選択

```typescript
// Shift/Cmd+クリックで複数選択
const handleButtonClick = (e: React.MouseEvent, buttonId: string) => {
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    // 追加選択
    if (selectedButtonIds.includes(buttonId)) {
      onSelectButtons(selectedButtonIds.filter((id) => id !== buttonId));
    } else {
      onSelectButtons([...selectedButtonIds, buttonId]);
    }
  } else {
    // 単一選択
    onSelectButtons([buttonId]);
  }
};

// 選択したボタンをまとめて移動
const moveSelectedButtons = (dx: number, dy: number) => {
  const newButtons = layout.buttons.map((b) => {
    if (selectedButtonIds.includes(b.id)) {
      return {
        ...b,
        x: snapToGrid(b.x + dx),
        y: snapToGrid(b.y + dy),
      };
    }
    return b;
  });
  onLayoutChange({ ...layout, buttons: newButtons });
};
```

### 2. ボタンリンク

#### リンク作成

```typescript
const [linkDraftState, setLinkDraftState] = useState<{
  fromButtonId: string | null;
  mousePos: { x: number; y: number } | null;
}>({ fromButtonId: null, mousePos: null });

// 右クリック+ドラッグでリンク作成
const handleRightMouseDown = (e: React.MouseEvent, buttonId: string) => {
  if (e.button !== 2) return; // 右クリック
  e.preventDefault();

  setLinkDraftState({
    fromButtonId: buttonId,
    mousePos: { x: e.clientX, y: e.clientY },
  });
};

const handleRightMouseUp = (e: React.MouseEvent, buttonId: string) => {
  if (!linkDraftState.fromButtonId) return;

  // リンクを作成
  const newLink: ButtonLink = {
    id: ulid(),
    fromButtonId: linkDraftState.fromButtonId,
    toButtonId: buttonId,
    linkType: 'activate', // デフォルト
  };

  const newLinks = [...(layout.buttonLinks || []), newLink];
  onLayoutChange({ ...layout, buttonLinks: newLinks });

  setLinkDraftState({ fromButtonId: null, mousePos: null });
};
```

#### リンク描画

```typescript
const renderLink = (link: ButtonLink) => {
  const fromButton = layout.buttons.find(b => b.id === link.fromButtonId);
  const toButton = layout.buttons.find(b => b.id === link.toButtonId);
  if (!fromButton || !toButton) return null;

  // ボタンの端点を計算（getButtonEdge関数）
  const fromEdge = getButtonEdge(fromButton, toButton);
  const toEdge = getButtonEdge(toButton, fromButton);

  // リンク種別による色分け
  const linkColor = {
    exclusive: '#EF4444',   // 赤
    activate: '#10B981',    // 緑
    deactivate: '#F59E0B', // オレンジ
    sequence: '#3B82F6',   // 青
  }[link.linkType];

  return (
    <g key={link.id}>
      <line
        x1={fromEdge.x}
        y1={fromEdge.y}
        x2={toEdge.x}
        y2={toEdge.y}
        stroke={linkColor}
        strokeWidth={2}
        markerEnd={link.linkType !== 'exclusive' ? 'url(#arrowhead)' : undefined}
      />
      {/* 選択時のハイライト */}
      {selectedLinkId === link.id && (
        <circle cx={(fromEdge.x + toEdge.x) / 2} cy={(fromEdge.y + toEdge.y) / 2} r={6} fill={linkColor} />
      )}
    </g>
  );
};
```

#### リンク端点計算

```typescript
// ボタンの端点（上下左右の中央）を取得
const getButtonEdge = (
  fromButton: CodeWindowButton,
  toButton: CodeWindowButton,
): { x: number; y: number } => {
  const fromCenterX = fromButton.x + fromButton.width / 2;
  const fromCenterY = fromButton.y + fromButton.height / 2;
  const toCenterX = toButton.x + toButton.width / 2;
  const toCenterY = toButton.y + toButton.height / 2;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  // 角度に応じて上下左右の端点を選択
  if (Math.abs(dx) > Math.abs(dy)) {
    // 左右
    return dx > 0
      ? { x: fromButton.x + fromButton.width, y: fromCenterY }
      : { x: fromButton.x, y: fromCenterY };
  } else {
    // 上下
    return dy > 0
      ? { x: fromCenterX, y: fromButton.y + fromButton.height }
      : { x: fromCenterX, y: fromButton.y };
  }
};
```

### 3. Undo/Redo機能

```typescript
const [history, setHistory] = useState<CodeWindowLayout[]>([layout]);
const [historyIndex, setHistoryIndex] = useState(0);
const isUndoRedoRef = useRef(false);

// レイアウト変更時に履歴追加
const updateLayoutWithHistory = useCallback(
  (newLayout: CodeWindowLayout) => {
    if (isUndoRedoRef.current) {
      isUndoRedoRef.current = false;
      onLayoutChange(newLayout);
      return;
    }

    // 現在位置より先の履歴を削除
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newLayout);

    // 最大50件まで
    if (newHistory.length > 50) {
      newHistory.shift();
    }

    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    onLayoutChange(newLayout);
  },
  [history, historyIndex, onLayoutChange],
);

// Undo
const handleUndo = useCallback(() => {
  if (historyIndex > 0) {
    isUndoRedoRef.current = true;
    setHistoryIndex(historyIndex - 1);
    onLayoutChange(history[historyIndex - 1]);
  }
}, [historyIndex, history, onLayoutChange]);

// Redo
const handleRedo = useCallback(() => {
  if (historyIndex < history.length - 1) {
    isUndoRedoRef.current = true;
    setHistoryIndex(historyIndex + 1);
    onLayoutChange(history[historyIndex + 1]);
  }
}, [historyIndex, history, onLayoutChange]);

// Cmd+Z / Cmd+Shift+Z のキーバインド
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
      e.preventDefault();
      handleRedo();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [handleUndo, handleRedo]);
```

### 4. ボタンプロパティエディタ

```typescript
const ButtonPropertiesEditorNew: React.FC<ButtonPropertiesEditorProps> = ({
  button,
  onUpdate,
  onDelete,
  availableActions,
  availableLabelGroups,
  canvasWidth,
  canvasHeight,
}) => {
  if (!button) {
    return <Typography color="text.secondary">ボタンを選択してください</Typography>;
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Stack spacing={2}>
        {/* ボタン名 */}
        <TextField
          label="ボタン名"
          value={button.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          fullWidth
        />

        {/* プレースホルダー挿入ボタン */}
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => onUpdate({ name: button.name + '${Team1}' })}>
            ${Team1}
          </Button>
          <Button size="small" onClick={() => onUpdate({ name: button.name + '${Team2}' })}>
            ${Team2}
          </Button>
          <Button size="small" onClick={() => onUpdate({ name: button.name + ' ' })}>
            スペース
          </Button>
        </Stack>

        {/* 色設定 */}
        <TextField
          label="ボタン色"
          type="color"
          value={button.color || '#1976d2'}
          onChange={(e) => onUpdate({ color: e.target.value })}
        />

        {/* フォントサイズ */}
        <TextField
          label="フォントサイズ (px)"
          type="number"
          value={button.fontSize || 14}
          onChange={(e) => onUpdate({ fontSize: parseInt(e.target.value, 10) })}
          inputProps={{ min: 8, max: 32 }}
        />

        {/* ホットキー */}
        <TextField
          label="ホットキー"
          value={button.hotkey || ''}
          onChange={(e) => onUpdate({ hotkey: e.target.value })}
          placeholder="例: a, 1, Shift+B"
        />

        {/* 削除ボタン */}
        <Button variant="outlined" color="error" onClick={onDelete} startIcon={<DeleteIcon />}>
          削除
        </Button>
      </Stack>
    </Paper>
  );
};
```

### 5. レイアウト管理

#### エクスポート/インポート

```typescript
// エクスポート
const handleExportLayout = useCallback(() => {
  if (!currentLayout) return;

  const safeName = currentLayout.name.replace(/\s+/g, '_');
  const fileName = `${safeName}.codewindow`;
  const data = {
    version: 1,
    layout: currentLayout,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}, [currentLayout]);

// インポート
const handleImportLayout = useCallback(() => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.codewindow,.json';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data.layout && data.version === 1) {
        const importedLayout = {
          ...data.layout,
          id: createLayout('').id, // 新しいIDを生成
          name: `${data.layout.name} (インポート)`,
        };
        setCodeWindows((prev) => [...prev, importedLayout]);
        setActiveCodeWindowId(importedLayout.id);
        setHasChanges(true);
      }
    } catch {
      console.error('Failed to import layout');
    }
  };
  input.click();
}, []);
```

#### 複製

```typescript
const handleDuplicateLayout = useCallback((layout: CodeWindowLayout) => {
  const duplicated = createLayout(
    `${layout.name} (コピー)`,
    layout.canvasWidth,
    layout.canvasHeight,
  );
  duplicated.buttons = layout.buttons.map((b) => ({
    ...b,
    id: createButton('action', b.name, 0, 0).id, // 新しいIDを生成
  }));
  duplicated.buttonLinks = layout.buttonLinks?.map((l) => ({ ...l })) || [];
  setCodeWindows((prev) => [...prev, duplicated]);
  setActiveCodeWindowId(duplicated.id);
  setHasChanges(true);
}, []);
```

## 使用例

### レイアウト作成

1. 「ファイル > 新規 > コードウィンドウ…」を選択
2. 保存先と `.stcw` ファイル名を指定
3. 開いた独立コードウィンドウで編集モードへ切り替え
4. ボタンとリンクを追加して保存

設定画面は `.stcw` の作成・選択・インポート・エクスポートに使用しない。

### 標準プリセット

- `デフォルト`: チーム別の基本アクション記録レイアウト
- `Rugby Labels`: `ActionList` 由来のラベル専用レイアウト。各アクション内で `Type`、`Result` の順にラベルボタンを配置する

### ボタン配置

1. キャンバス上をクリックしてボタンを追加
2. ドラッグ&ドロップで位置調整
3. 右パネルでプロパティ（色/サイズ/ホットキー）を設定

### 独立コードウィンドウ

1. 「ファイル > 新規 > コードウィンドウ…」で作成するか、「ファイル > 開く > コードウィンドウ…」で対象の `.stcw` を選択
2. コードウィンドウ側でボタンを押下
3. メイン動画ウィンドウが現在の映像時刻を読み取り、既存のコードパネル処理と同じ経路でタグ付けする

コードウィンドウはパッケージ選択前でも開ける。開いている映像がある場合は、そのメイン動画ウィンドウの現在時刻に対してタグ付けする。コードウィンドウ側は `activeRecordings` / `activeLabelButtons` / `primaryAction` などの押下状態を IPC sync で受け取って描画する。押下状態の正本はメイン動画ウィンドウ側に置く。

`.stcw` ファイルをダブルクリックして開いた場合は、現在の runtime code window layout として反映する。ダブルクリックが brew 版など別のインストールへ紐付いている場合は、「ファイル > 開く > コードウィンドウ…」から `.stcw` を選ぶ。ユーザーはアクション用コードウィンドウ、ラベル用コードウィンドウなどを用途ごとに切り替えながら、同じ映像パッケージへタグ付けできる。

### 独立コードウィンドウ編集

1. コードウィンドウ上部の編集アイコンを押して編集モードへ切り替える
2. キャンバス上でボタン配置、サイズ、リンクを編集する
3. ボタンを右クリックまたはダブルクリックして Inspector ダイアログを開き、アクション / ラベル、色、表示名、hotkey、hotkey 表示有無を編集する
4. コードウィンドウをリサイズしてもキャンバス寸法は維持され、収まらない範囲はスクロールして編集する
5. 保存または別名保存で `.stcw` に書き出す

編集モードの変更は `coding panel window` command としてメイン動画ウィンドウ側 controller へ返し、runtime layout として即時同期する。タグ付け時刻、押下状態、timeline 更新は引き続きメイン動画ウィンドウ側で確定し、編集 UI は Electron API に直接依存しない。

### リンク作成

1. Control / Option / Shift + 右クリックドラッグでボタン間を接続
2. リンクをクリックして選択
3. プロパティパネルでリンク種別を変更
4. Delete/Backspace で削除

### エクスポート/インポート

1. レイアウトを選択
2. エクスポートアイコンをクリック → .codewindow ファイルをダウンロード
3. インポートアイコンをクリック → ファイルを選択 → インポート

## 制限事項

1. **キャンバスサイズ**: 幅400-2000px、高さ300-1500px
2. **履歴件数**: Undo/Redo履歴は最大50件
3. **ホットキー重複**: 同一コードウィンドウ内でホットキーが重複しても警告されない
4. **リンク数**: 大量のリンクがあるとパフォーマンスが低下する可能性

## 今後の拡張案

- **Live Notes / Code Notes**: コードボタンの開始時または終了時にメモ入力を促し、インスタンスへ紐づける。Sportscode 公式機能比較では Live Notes と Code Notes on Activation/Deactivation が Coding 機能として示されている。
- **全画面コードモード**: 動画を全画面表示したままコードウィンドウを重ねて操作する。Sportscode 公式機能比較では Full Screen Code Mode として示されている。
- **Batch Rename**: 複数ボタンの名前を一括リネームする。現状の複数選択一括編集は主にスタイル/配置向けなので、命名規則や接頭辞/接尾辞変換を追加候補にする。
- **Alternate Names**: ボタン表示名と記録名、または相手チーム別の別名セットを切り替える。Sportscode 公式機能比較では Alternate Names が Coding 機能として示されている。
- **リンク機能の拡張**: 既存の exclusive / activate / deactivate に加え、ラベルとコードのリンク条件、リンクの inspector、リンク一覧管理を追加候補にする。Sportscode 公式機能比較では Exclusive Link がラベルとコードの紐づけにも触れている。
- **ボタンレイヤー操作**: 重なったボタンの前面/背面移動、1段階ずつのレイヤー上下移動を追加候補にする。公開されている旧 SportsCode マニュアル系資料では Button Layers 操作が説明されている。
- **Option ドラッグ複製**: 選択ボタンまたは選択グループをドラッグ複製する。公開されている旧 SportsCode マニュアル系資料では Option ドラッグによるボタン複製、Option+Command ドラッグによる選択グループ複製が説明されている。
- **透明度/操作履歴表示**: コードウィンドウ透明度の調整、直近のボタン押下履歴ラインを追加候補にする。旧 SportsCode マニュアル系資料では Code Window Transparency と Code Button History が説明されている。
- **Code Window Scripting / Action Buttons**: コードウィンドウ内に再生制御や集計出力などのスクリプト実行ボタンを配置する。Sportscode 公式機能比較では Code Window Scripting と Code Window Action Buttons が Reporting 機能として示されている。
- **コードウィンドウ内チャート/レポート表示**: コードウィンドウ上に棒/積み上げ/円グラフなどを配置し、クリックで対象動画へ遷移する。Sportscode 公式機能比較では Charts と Report Mode on Timeline/Database が示されている。
- **ホットキー重複検知**: 同一コードウィンドウ内のボタン hotkey 重複を保存前に警告する。Sportscode 系資料では hotkey はコードウィンドウ内で一意である前提が示されている。
- **グループ化**: 複数ボタンをグループ化して一括移動/編集
- **レイヤー**: ボタンの重なり順序を管理
- **テンプレート**: よく使うボタン配置をテンプレートとして保存
- **AI配置提案**: アクションリストからボタン配置を自動提案
- **コラボレーション**: 複数ユーザーでレイアウトを共同編集

### 調査元

- Hudl Sportscode Comparison: https://www.hudl.com/products/sportscode/tiers
- Hudl Support - Code Window Modes: https://support.hudl.com/s/article/code-window-modes-sportscode
- Hudl Support - Create a Code or Label Button in a Code Window: https://support.hudl.com/s/article/create-code-and-label-buttons-in-a-code-window-sportscode
- Hudl Support - Label Instances While in Code Mode: https://support.hudl.com/s/article/labeling-instances-in-code-mode-sportscode
- Hudl Support - Keyboard Shortcuts: https://support.hudl.com/s/article/keyboard-shortcuts-sportscode
- Hudl SportsCodeManual-2.pdf: https://static.hudl.com/craft/SportsCodeManual-2.pdf

## 関連ドキュメント

- [system-overview.md](./system-overview.md): 全体アーキテクチャ
- [requirement.md](./requirement.md): 機能要件
- [coreTypes.ts](../src/types/settings/coreTypes.ts): 設定型定義
- [CodingPanelWindowScreen.tsx](../src/features/videoPlayer/app/CodingPanelWindowScreen.tsx): 独立ウィンドウ実装
- [FreeCanvasEditor.tsx](../src/features/settings/components/CodeWindowSettings/FreeCanvasEditor.tsx): エディタ実装
