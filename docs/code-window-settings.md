# コードウィンドウ設定機能 実装ドキュメント

## 概要

SporTagLyticsのコードウィンドウ設定は、アクション記録用のボタン配置を自由にカスタマイズできる機能です。ドラッグ&ドロップによるボタン配置、ボタン間のリンク設定、Undo/Redo履歴管理など、高度な編集機能を備えています。

## アーキテクチャ

### コンポーネント構成

```
src/
├── pages/
│   └── settings/
│       └── components/
│           └── CodeWindowSettings/
│               ├── CodeWindowSettings.tsx         # メインコンポーネント
│               ├── FreeCanvasEditor.tsx           # 自由配置エディタ
│               ├── ButtonPropertiesEditorNew.tsx  # ボタンプロパティエディタ
│               ├── types.ts                       # 型定義
│               └── utils.ts                       # ユーティリティ
├── types/
│   └── Settings.ts                                # 設定型定義
└── hooks/
    └── useSettings.ts                             # 設定管理フック
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

1. 設定画面 → コードウィンドウタブ
2. 「コードウィンドウを新規作成」ボタン
3. 名前とキャンバスサイズを入力
4. 作成

### ボタン配置

1. キャンバス上をクリックしてボタンを追加
2. ドラッグ&ドロップで位置調整
3. 右パネルでプロパティ（色/サイズ/ホットキー）を設定

### リンク作成

1. 右クリック+ドラッグでボタン間を接続
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

- **グループ化**: 複数ボタンをグループ化して一括移動/編集
- **レイヤー**: ボタンの重なり順序を管理
- **テンプレート**: よく使うボタン配置をテンプレートとして保存
- **AI配置提案**: アクションリストからボタン配置を自動提案
- **コラボレーション**: 複数ユーザーでレイアウトを共同編集

## 関連ドキュメント

- [system-overview.md](./system-overview.md): 全体アーキテクチャ
- [requirement.md](./requirement.md): 機能要件
- [Settings.ts](../src/types/Settings.ts): 設定型定義
- [CodeWindowSettings.tsx](../src/pages/settings/components/CodeWindowSettings/CodeWindowSettings.tsx): 実装
- [FreeCanvasEditor.tsx](../src/pages/settings/components/CodeWindowSettings/FreeCanvasEditor.tsx): エディタ実装
