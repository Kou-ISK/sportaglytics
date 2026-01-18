# プレイリスト機能 実装ドキュメント

## 概要

SporTagLyticsのプレイリスト機能は、タイムライン上の選択したイベントをプレイリストとしてまとめ、専用ウィンドウで連続再生・分析・クリップ書き出しを行える機能です。フリーズフレーム・簡易描画・メモ編集など、詳細な分析を支援する機能を備えています。

**更新情報（2026年1月14日）**:

- 複数プレイリストウィンドウの同時表示に対応
- 未保存変更の確認ダイアログを追加
- タイムラインから全てのウィンドウへの一括追加機能を実装
- コントロールUIを改善（ビデオエリアホバー時のみ表示、サイズ縮小）
- 描画ツールを拡充（ペン/選択/図形/テキスト + 線幅/色調整）
- 書き出し範囲/アングル/オーバーレイを詳細に指定可能に

## ファイル形式

プレイリストは `.stpl` 拡張子のパッケージ形式で保存されます。

### パッケージ構造

```
MyPlaylist.stpl/              # パッケージディレクトリ（macOSでは単一ファイルに見える）
├── playlist.json             # プレイリストメタデータ（JSON形式、テキストエディタで閲覧可能）
└── videos/                   # 映像ファイル（埋め込み形式のみ）
    ├── パス_01JGXXX123ABC/   # <アクション名>_<itemId>
    │   ├── angle1.mp4        # プライマリ映像
    │   └── angle2.mp4        # セカンダリ映像（存在する場合）
    ├── シュート_01JGXXX456DEF/
    │   ├── angle1.mp4
    │   └── angle2.mp4
    └── ...
```

### 形式の種類

| 形式         | タイプ      | 説明                                                                    | ファイルサイズ     | 移植性               |
| ------------ | ----------- | ----------------------------------------------------------------------- | ------------------ | -------------------- |
| **埋め込み** | `embedded`  | 映像ファイルを `videos/` に内包、FFmpegで各アイテムの動画区間を切り出し | 大容量（映像込み） | 高い（自己完結型）   |
| **参照**     | `reference` | 外部映像パスを保存                                                      | 軽量（数KB）       | 低い（元映像が必要） |

**埋め込み形式の注意点**:

- 切り出した動画は各アイテムの開始時刻が `0秒` になります
- 上書き保存時は既存の切り出し動画があれば再生成を省略します

### 複数ウィンドウ管理

- 同時に複数の `.stpl` ファイルを独立したウィンドウで開くことができます
- 同じファイルを複数回開こうとした場合は、既存ウィンドウにフォーカスします
- 新しいウィンドウはカスケード表示されます（前のウィンドウから +50px, +50px ずつオフセット）

### ファイルの閲覧・編集

1. **macOS**: 右クリック → 「パッケージの内容を表示」
2. `playlist.json` をテキストエディタで開く
3. JSON形式で人間が読める形式で保存されています

### プレビュー抑制

- macOSのQuickLookプレビューは無効化されています
- `com.apple.package` UTIへの準拠により、Finderでは独自アイコンのみ表示
- ダブルクリックでSporTagLyticsが起動します

## アーキテクチャ

### コンポーネント構成

```
src/
├── contexts/
│   └── PlaylistContext.tsx          # プレイリスト状態管理（Context API）
├── features/
│   └── playlist/
│       ├── PlaylistWindowApp.tsx    # プレイリスト専用ウィンドウのメインアプリ
│       ├── hooks/
│       │   └── usePlaylistHistory.ts # Undo/Redo対応の履歴管理
│       └── components/
│           ├── AnnotationCanvas.tsx # 描画キャンバス
│           └── PlaylistButton.tsx   # プレイリスト追加ボタン（メイン画面用）
├── types/
│   └── Playlist.ts                  # 型定義

electron/
└── src/
    └── playlistWindow.ts             # Electronプレイリストウィンドウ管理（複数ウィンドウ）
```

### データフロー

1. **メイン → プレイリストウィンドウ**:
   - `PlaylistSyncData` を IPC 経由で送信
   - 映像パス、現在時刻、パッケージパスなどを同期

2. **プレイリストウィンドウ → メイン**:
   - `PlaylistCommand` を IPC 経由で送信
   - シーク/再生要求をメインプレイヤーに通知
   - `set-dirty` で未保存状態を同期

3. **状態管理**:
   - `PlaylistContext` でプレイリスト全体を管理
   - ウィンドウ単位で未保存状態を管理

## 主要機能

### 1. プレイリスト管理

#### アイテム追加

```typescript
// タイムラインから複数選択してプレイリストに追加
const addToPlaylist = (timelineItems: TimelineData[], playlistId?: string) => {
  const items: PlaylistItem[] = timelineItems.map((td) => ({
    id: ulid(),
    timelineItemId: td.id,
    actionName: td.actionName,
    startTime: td.startTime,
    endTime: td.endTime,
    labels: td.labels,
    memo: td.memo,
    videoSource: currentVideoPath,
    videoSource2: currentVideoPath2,
    note: '',
    annotation: null,
  }));
  // playlistIdが指定されていれば既存プレイリストに追加、なければ新規作成
};
```

- タイムラインの追加は「開いている全てのプレイリストウィンドウ」に配信
- ウィンドウが存在しない場合は新規ウィンドウを自動作成

#### 順序変更

```typescript
// @dnd-kit を使用したドラッグ&ドロップ
<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  <SortableContext items={items.map(i => i.id)}>
    {items.map((item, index) => (
      <SortableItem key={item.id} item={item} index={index} />
    ))}
  </SortableContext>
</DndContext>
```

### 2. プレイリスト専用ウィンドウ

#### 基本再生機能

- **連続再生（autoAdvance）**: 自動的に次のアイテムへ移動
- **ループ再生（loopPlaylist）**: プレイリスト全体を繰り返し再生
- **前/次ジャンプ**: SkipPrevious/SkipNext ボタン
- **再生/停止**: PlayArrow/Pause トグル
- **音量調整**: Slider コンポーネント
- **表示切替**: `angle1` / `angle2` / `dual`
- **複数選択**: チェックボックスで複数選択し一括削除
- **メモ編集**: プレイリスト内のみに保存（タイムラインには反映されない）

```typescript
const handleItemEnd = useCallback(() => {
  if (autoAdvance) {
    handleNext();
  } else if (loopPlaylist && currentIndex === items.length - 1) {
    setCurrentIndex(0);
  }
}, [autoAdvance, loopPlaylist, currentIndex, items.length]);
```

#### フリーズフレーム機能

```typescript
const [isFrozen, setIsFrozen] = useState(false);

const handleToggleFreeze = useCallback(() => {
  if (videoRef.current) {
    if (isFrozen) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
    setIsFrozen(!isFrozen);
  }
}, [isFrozen]);
```

- 描画のタイムスタンプに到達すると自動で停止
- フリーズ解除は再生ボタン/Spaceで手動
- 停止秒数は書き出し時のフリーズ長として利用

### 3. 簡易描画機能

#### 描画オブジェクト

```typescript
type DrawingObject =
  | {
      id: string;
      type: 'pen';
      color: string;
      strokeWidth: number;
      path: Array<{ x: number; y: number }>;
      timestamp: number;
      target?: 'primary' | 'secondary';
      baseWidth?: number;
      baseHeight?: number;
    }
  | {
      id: string;
      type: 'line';
      color: string;
      strokeWidth: number;
      startX: number;
      startY: number;
      endX?: number;
      endY?: number;
      timestamp: number;
      target?: 'primary' | 'secondary';
      baseWidth?: number;
      baseHeight?: number;
    }
  | {
      id: string;
      type: 'arrow';
      color: string;
      strokeWidth: number;
      startX: number;
      startY: number;
      endX?: number;
      endY?: number;
      timestamp: number;
      target?: 'primary' | 'secondary';
      baseWidth?: number;
      baseHeight?: number;
    }
  | {
      id: string;
      type: 'rectangle';
      color: string;
      strokeWidth: number;
      startX: number;
      startY: number;
      endX?: number;
      endY?: number;
      timestamp: number;
      target?: 'primary' | 'secondary';
      baseWidth?: number;
      baseHeight?: number;
    }
  | {
      id: string;
      type: 'circle';
      color: string;
      strokeWidth: number;
      startX: number;
      startY: number;
      endX?: number;
      endY?: number;
      timestamp: number;
      target?: 'primary' | 'secondary';
      baseWidth?: number;
      baseHeight?: number;
    }
  | {
      id: string;
      type: 'text';
      color: string;
      strokeWidth: number;
      startX: number;
      startY: number;
      text: string;
      fontSize: number;
      timestamp: number;
      target?: 'primary' | 'secondary';
      baseWidth?: number;
      baseHeight?: number;
    };
```

#### 描画モード

```typescript
const [isDrawingMode, setIsDrawingMode] = useState(false);
const [drawingTool, setDrawingTool] = useState<'pen' | 'select' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text'>('pen');
const [drawColor, setDrawColor] = useState('#FF0000');
const [strokeWidth, setStrokeWidth] = useState(3);

// Canvasオーバーレイで描画オブジェクトをレンダリング
<svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: isDrawingMode ? 'auto' : 'none' }}>
  {currentAnnotation?.objects.map((obj, idx) => (
    <RenderDrawingObject key={idx} object={obj} />
  ))}
</svg>
```

- **選択ツール**: クリックで選択、ドラッグで移動、Deleteで削除
- **タイムスタンプ**: 描画した時刻に紐づけて表示/フリーズ判定
- **デュアルビュー**: メイン/サブどちらに描画するかを切替

#### PNG エクスポート

```typescript
const renderAnnotationPng = useCallback(
  async (
    annotation: ItemAnnotation,
    targetRect: DOMRect,
  ): Promise<string | null> => {
    const canvas = document.createElement('canvas');
    canvas.width = targetRect.width;
    canvas.height = targetRect.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 描画オブジェクトをCanvasに描画
    annotation.objects.forEach((obj) => {
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = obj.strokeWidth || 2;
      // ... 描画処理
    });

    return canvas.toDataURL('image/png');
  },
  [],
);
```

### 4. クリップ書き出し

#### 書き出しモード

| モード      | 説明                                     |
| ----------- | ---------------------------------------- |
| single      | プレイリスト全体を1ファイルに結合        |
| perInstance | 各アイテムを個別のファイルとして書き出し |
| perRow      | アクション名ごとにグループ化して書き出し |

#### 書き出し範囲

- `all`: 全アイテム
- `selected`: 選択中アイテムのみ

#### オーバーレイ設定

```typescript
interface OverlaySettings {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
}
```

#### アングル選択

- `allAngles`: 全アングルを個別に書き出し
- `single`: 単一アングル
- `multi`: 2アングルを並列合成

#### FFmpeg統合

```typescript
const handleExportClips = useCallback(async () => {
  const result = await window.electronAPI?.playlist?.exportClips({
    items,
    mode: exportMode,
    angleOption,
    fileName: exportFileName,
    overlaySettings,
    videoSources,
    annotations: itemAnnotations,
    // ... その他のパラメータ
  });

  if (result?.success) {
    alert('プレイリストを書き出しました');
  } else {
    alert(result?.error || '書き出しに失敗しました');
  }
}, [
  exportMode,
  angleOption,
  exportFileName,
  overlaySettings,
  items,
  itemAnnotations,
]);
```

### 5. デュアルビュー

```typescript
const [isDualView, setIsDualView] = useState(false);

// 2映像を並列表示
{isDualView && secondaryVideoSource ? (
  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
    <video ref={videoRef} src={currentVideoSource} />
    <video ref={secondaryVideoRef} src={secondaryVideoSource} />
  </Box>
) : (
  <video ref={videoRef} src={currentVideoSource} />
)}
```

- プライマリ/セカンダリ映像を個別に描画可能
- `drawingTarget` で描画対象を切替
- `angle1` / `angle2` / `dual` の表示モードに対応

### 6. メイン↔プレイリストウィンドウ連携

#### メイン → プレイリスト（同期）

```typescript
// PlaylistContext.tsx
const syncToWindow = useCallback(
  (
    currentTime: number,
    videoPath: string | null,
    videoPath2?: string | null,
    packagePath?: string,
  ) => {
    if (!window.electronAPI?.playlist || !isWindowOpen) return;
    const syncData: PlaylistSyncData = {
      state,
      videoPath,
      videoPath2: videoPath2 || null,
      videoSources: [videoPath, videoPath2].filter(Boolean),
      currentTime,
      packagePath,
    };
    window.electronAPI.playlist.syncToWindow(syncData);
  },
  [state, isWindowOpen],
);
```

#### プレイリスト → メイン（コマンド）

```typescript
// PlaylistWindowApp.tsx
const handlePlayItem = useCallback(
  (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    window.electronAPI?.playlist?.sendCommand({
      type: 'play-item',
      itemId: item.id,
    });
  },
  [items],
);
```

## Electron側実装

### playlistWindow.ts

```typescript
const playlistWindows = new Map<string, PlaylistWindowInfo>();

export function createPlaylistWindow(filePath?: string): BrowserWindow {
  const windowId = filePath || generateWindowId();

  if (playlistWindows.has(windowId)) {
    const info = playlistWindows.get(windowId)!;
    if (!info.window.isDestroyed()) {
      info.window.focus();
      return info.window;
    }
    playlistWindows.delete(windowId);
  }

  const offset = playlistWindows.size * 50;

  const window = new BrowserWindow({
    width: 450,
    height: 700,
    x: 100 + offset,
    y: 100 + offset,
    minWidth: 350,
    minHeight: 400,
    title: filePath ? path.basename(filePath, '.stpl') : 'プレイリスト',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  const mainURL = `file:${path.join(__dirname, '../../index.html')}#/playlist`;
  window.loadURL(mainURL);
  window.setMenuBarVisibility(false);

  playlistWindows.set(windowId, {
    window,
    filePath: filePath || null,
    isDirty: false,
  });

  window.on('close', async (e) => {
    const info = playlistWindows.get(windowId);
    if (!info || !info.isDirty) return;
    e.preventDefault();
    window.webContents.send('playlist:request-save');
  });

  window.on('closed', () => {
    playlistWindows.delete(windowId);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playlist:window-closed', windowId);
    }
  });

  return window;
}
```

### IPC ハンドラー

```typescript
export function registerPlaylistHandlers(): void {
  ipcMain.handle('playlist:open-window', (_event, filePath?: string) => {
    createPlaylistWindow(filePath);
  });

  ipcMain.handle('playlist:close-window', () => {
    closePlaylistWindow();
  });

  ipcMain.handle('playlist:is-window-open', () => {
    return isPlaylistWindowOpen();
  });

  ipcMain.handle('playlist:get-open-count', () => {
    return getOpenWindowCount();
  });

  ipcMain.handle('playlist:add-item-to-all-windows', (_event, item) => {
    addItemToAllWindows(item);
  });

  ipcMain.on('playlist:sync-to-window', (_event, data: PlaylistSyncData) => {
    syncToPlaylistWindow(data);
  });

  ipcMain.on('playlist:command', (_event, command: PlaylistCommand) => {
    if (command?.type === 'set-dirty') {
      // windowごとの未保存状態更新
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playlist:command', command);
    }
  });

  ipcMain.handle('playlist:save-file', async (_event, playlist) => {
    // 保存処理
  });

  ipcMain.handle('playlist:save-file-as', async (_event, playlist) => {
    // 名前を付けて保存
  });

  ipcMain.handle('playlist:load-file', async (_event, filePath?: string) => {
    // 読み込み処理
  });
}
```

## 型定義

### Playlist.ts

```typescript
export interface PlaylistItem {
  id: string;
  timelineItemId: string | null;
  actionName: string;
  startTime: number;
  endTime: number;
  labels?: SCLabel[];
  memo?: string;
  note?: string;
  videoSource?: string;
  videoSource2?: string;
  annotation?: ItemAnnotation | null;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  type: 'reference' | 'embedded';
  items: PlaylistItem[];
  sourcePackagePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  playingItemId: string | null;
  loopMode: 'none' | 'single' | 'all';
}

export interface PlaylistSyncData {
  state: PlaylistState;
  videoPath: string | null;
  videoPath2: string | null;
  videoSources: string[];
  currentTime: number;
  packagePath?: string;
}

export type PlaylistCommand =
  | { type: 'seek'; time: number }
  | { type: 'play-item'; itemId: string }
  | { type: 'update-state'; state: PlaylistState }
  | { type: 'add-items'; items: PlaylistItem[] }
  | { type: 'request-sync' }
  | { type: 'save-playlist'; playlist: Playlist; filePath?: string }
  | { type: 'load-playlist'; filePath: string }
  | { type: 'set-dirty'; isDirty: boolean }
  | { type: 'get-dirty' };
```

## 使用例

### プレイリストに追加

1. メイン画面のタイムラインで複数イベントを選択
2. 右クリック → 「プレイリストに追加」
3. 開いている全てのプレイリストウィンドウに追加（ウィンドウが無い場合は自動で新規作成）

### 専用ウィンドウで再生

1. プレイリストボタンからウィンドウを開く
2. 連続再生/ループ再生を設定
3. アイテムをクリックして再生

### フリーズフレーム＆描画

1. Brush アイコンで描画モード切替（再生は一時停止）
2. 図形/テキストツールで注釈を追加
3. 描画を終了して再生を再開
4. 再生中、描画した時刻に到達すると自動でフリーズ

### クリップ書き出し

1. プレイリストウィンドウの「書き出し」ボタン
2. モード（1ファイル/インスタンスごと/アクションごと）を選択
3. オーバーレイ設定を調整
4. 書き出し実行（FFmpegで処理）

## 制限事項

1. **フリーズ解除**: 再生中の自動フリーズは手動解除（再生ボタン/Space）で復帰します
2. **FFmpeg依存**: クリップ書き出しには ffmpeg-static が必須
3. **同期精度**: メイン↔プレイリスト間の時刻同期は IPC 経由のため、若干の遅延が発生する可能性あり
4. **参照パス切れ**: 参照形式は元動画が移動/削除されると再生できません
5. **メモの扱い**: タイムラインの `memo` とプレイリスト内の `note` は別管理です

## 今後の拡張案

- **クラウド同期**: プレイリストをクラウドストレージに保存
- **共有機能**: プレイリストをチーム内で共有
- **高度な描画**: レイヤー管理、グループ化、パスアニメーション
- **AI分析連携**: 選択したイベントに対する自動分析・レポート生成
- **スナップショット**: フリーズフレーム＋描画を自動的にスナップショットとして保存

## 関連ドキュメント

- [system-overview.md](./system-overview.md): 全体アーキテクチャ
- [requirement.md](./requirement.md): 機能要件
- [Playlist.ts](../src/types/Playlist.ts): 型定義
- [PlaylistContext.tsx](../src/contexts/PlaylistContext.tsx): Context実装
- [PlaylistWindowApp.tsx](../src/features/playlist/PlaylistWindowApp.tsx): 専用ウィンドウ実装
