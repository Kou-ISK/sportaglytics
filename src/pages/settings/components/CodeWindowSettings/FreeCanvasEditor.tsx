import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import LinkIcon from '@mui/icons-material/Link';
import type {
  CodeWindowButton,
  CodeWindowLayout,
} from '../../../../types/Settings';
import { DEFAULT_BUTTON_COLORS } from './types';
import {
  createButton,
  createButtonLink,
  canPlaceButton,
  snapToGrid,
  getButtonCenter,
  getButtonEdge,
  DEFAULT_BUTTON_WIDTH,
  DEFAULT_BUTTON_HEIGHT,
} from './utils';

interface FreeCanvasEditorProps {
  layout: CodeWindowLayout;
  onLayoutChange: (layout: CodeWindowLayout) => void;
  selectedButtonId: string | null;
  onSelectButton: (id: string | null) => void;
  availableActions: string[];
  availableLabelGroups: Array<{ groupName: string; options: string[] }>;
  showLinks?: boolean;
}

/** ドラッグモード */
type DragMode = 'move' | 'resize' | 'link' | null;

/** リンクタイプ（修飾キーで決定） */
type LinkType = 'exclusive' | 'lead' | 'deactivate';

export const FreeCanvasEditor: React.FC<FreeCanvasEditorProps> = ({
  layout,
  onLayoutChange,
  selectedButtonId,
  onSelectButton,
  availableActions,
  availableLabelGroups,
  showLinks = true,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [draggedButton, setDraggedButton] = useState<CodeWindowButton | null>(
    null,
  );
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [linkStartButton, setLinkStartButton] =
    useState<CodeWindowButton | null>(null);
  const [linkEndPos, setLinkEndPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [linkType, setLinkType] = useState<LinkType>('exclusive');
  const [resizeHandle, setResizeHandle] = useState<'se' | 'e' | 's' | null>(
    null,
  );
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    position: { x: number; y: number };
  } | null>(null);
  const [dialogPosition, setDialogPosition] = useState<{
    x: number;
    y: number;
  }>({ x: 50, y: 50 });
  const [customLabelDialogOpen, setCustomLabelDialogOpen] = useState(false);
  const [customLabelGroup, setCustomLabelGroup] = useState('');
  const [customLabelValue, setCustomLabelValue] = useState('');
  const [customActionDialogOpen, setCustomActionDialogOpen] = useState(false);
  const [customActionName, setCustomActionName] = useState('');
  // 選択中のリンクID
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  // Undo/Redo履歴
  const [history, setHistory] = useState<CodeWindowLayout[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  const gridSize = 10; // スナップグリッドサイズ

  // 履歴管理: layoutが変更されたら履歴に追加
  const updateLayoutWithHistory = useCallback(
    (newLayout: CodeWindowLayout) => {
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        onLayoutChange(newLayout);
        return;
      }
      // 現在位置より先の履歴を削除して新しい状態を追加
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newLayout);
      // 履歴は最大50件まで
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
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      onLayoutChange(history[prevIndex]);
    }
  }, [history, historyIndex, onLayoutChange]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      isUndoRedoRef.current = true;
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      onLayoutChange(history[nextIndex]);
    }
  }, [history, historyIndex, onLayoutChange]);

  // 初期状態を履歴に追加（マウント時のみ）
  const initialLayoutRef = useRef(layout);
  useEffect(() => {
    if (history.length === 0) {
      setHistory([initialLayoutRef.current]);
      setHistoryIndex(0);
    }
  }, [history.length]);

  // キーボードイベント
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Deleteキー: 選択中のボタンまたはリンクを削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLinkId) {
          e.preventDefault();
          const newLayout = {
            ...layout,
            buttonLinks: layout.buttonLinks?.filter(
              (l) => l.id !== selectedLinkId,
            ),
          };
          updateLayoutWithHistory(newLayout);
          setSelectedLinkId(null);
        } else if (selectedButtonId) {
          e.preventDefault();
          const newLayout = {
            ...layout,
            buttons: layout.buttons.filter((b) => b.id !== selectedButtonId),
            buttonLinks: layout.buttonLinks?.filter(
              (l) =>
                l.fromButtonId !== selectedButtonId &&
                l.toButtonId !== selectedButtonId,
            ),
          };
          updateLayoutWithHistory(newLayout);
          onSelectButton(null);
        }
      }
      // Cmd/Ctrl + Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Cmd/Ctrl + Shift + Z または Cmd/Ctrl + Y: Redo
      if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === 'y' || (e.key === 'z' && e.shiftKey))
      ) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedButtonId,
    selectedLinkId,
    layout,
    updateLayoutWithHistory,
    onSelectButton,
    handleUndo,
    handleRedo,
  ]);

  // キャンバス座標を取得
  const getCanvasPosition = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  // ボタン上で右クリックドラッグ開始（リンク作成）
  // Sportscode準拠:
  // - 右クリックドラッグ: Exclusive（排他リンク）
  // - Option(Alt) + 右クリックドラッグ: Lead（活性化リンク）
  // - Shift + 右クリックドラッグ: Deactivate（非活性化リンク）
  const handleButtonRightMouseDown = useCallback(
    (e: React.MouseEvent, button: CodeWindowButton) => {
      // 右クリックのみ処理
      if (e.button !== 2) return;
      e.preventDefault();
      e.stopPropagation();

      // 修飾キーでリンクタイプを決定
      let detectedLinkType: LinkType = 'exclusive';
      if (e.altKey) {
        detectedLinkType = 'lead'; // Option(Alt)キー → Lead（活性化）
      } else if (e.shiftKey) {
        detectedLinkType = 'deactivate'; // Shiftキー → Deactivate（非活性化）
      }

      setLinkType(detectedLinkType);
      setLinkStartButton(button);
      setDragMode('link');
      const pos = getCanvasPosition(e);
      setLinkEndPos(pos);
      onSelectButton(button.id);
    },
    [getCanvasPosition, onSelectButton],
  );

  // ボタンドラッグ開始
  const handleButtonMouseDown = useCallback(
    (
      e: React.MouseEvent,
      button: CodeWindowButton,
      mode: DragMode = 'move',
    ) => {
      e.preventDefault();
      e.stopPropagation();

      if (mode === 'link') {
        setLinkStartButton(button);
        setDragMode('link');
        const pos = getCanvasPosition(e);
        setLinkEndPos(pos);
      } else {
        const pos = getCanvasPosition(e);
        setDraggedButton(button);
        setDragOffset({ x: pos.x - button.x, y: pos.y - button.y });
        setDragMode(mode);
        if (mode === 'resize') {
          setResizeHandle('se');
        }
      }
      onSelectButton(button.id);
      setSelectedLinkId(null); // リンクの選択を解除
    },
    [getCanvasPosition, onSelectButton],
  );

  // マウス移動
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getCanvasPosition(e);

      if (dragMode === 'move' && draggedButton) {
        const newX = snapToGrid(pos.x - dragOffset.x, gridSize);
        const newY = snapToGrid(pos.y - dragOffset.y, gridSize);

        // 一時的な更新（プレビュー用）
        const updatedButtons = layout.buttons.map((b) =>
          b.id === draggedButton.id ? { ...b, x: newX, y: newY } : b,
        );
        onLayoutChange({ ...layout, buttons: updatedButtons });
      } else if (dragMode === 'resize' && draggedButton && resizeHandle) {
        const newWidth = snapToGrid(
          Math.max(DEFAULT_BUTTON_WIDTH / 2, pos.x - draggedButton.x),
          gridSize,
        );
        const newHeight = snapToGrid(
          Math.max(DEFAULT_BUTTON_HEIGHT / 2, pos.y - draggedButton.y),
          gridSize,
        );

        const updatedButtons = layout.buttons.map((b) =>
          b.id === draggedButton.id
            ? { ...b, width: newWidth, height: newHeight }
            : b,
        );
        onLayoutChange({ ...layout, buttons: updatedButtons });
      } else if (dragMode === 'link' && linkStartButton) {
        setLinkEndPos(pos);
      }
    },
    [
      dragMode,
      draggedButton,
      dragOffset,
      linkStartButton,
      layout,
      onLayoutChange,
      getCanvasPosition,
      gridSize,
      resizeHandle,
    ],
  );

  // マウスアップ
  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragMode === 'link' && linkStartButton) {
        // リンク先のボタンを探す
        const pos = getCanvasPosition(e);
        const targetButton = layout.buttons.find((b) => {
          return (
            b.id !== linkStartButton.id &&
            pos.x >= b.x &&
            pos.x <= b.x + b.width &&
            pos.y >= b.y &&
            pos.y <= b.y + b.height
          );
        });

        if (targetButton) {
          // 既存のリンクをチェック
          const existingLink = layout.buttonLinks?.find(
            (l) =>
              (l.fromButtonId === linkStartButton.id &&
                l.toButtonId === targetButton.id) ||
              (l.fromButtonId === targetButton.id &&
                l.toButtonId === linkStartButton.id),
          );

          if (!existingLink) {
            // リンクタイプをButtonLink.typeに変換
            const buttonLinkType =
              linkType === 'lead'
                ? 'activate'
                : linkType === 'deactivate'
                  ? 'deactivate'
                  : 'exclusive';
            const newLink = createButtonLink(
              linkStartButton.id,
              targetButton.id,
              buttonLinkType,
            );
            updateLayoutWithHistory({
              ...layout,
              buttonLinks: [...(layout.buttonLinks || []), newLink],
            });
          }
        }
      } else if (
        (dragMode === 'move' || dragMode === 'resize') &&
        draggedButton
      ) {
        // ドラッグ完了時に履歴に追加
        updateLayoutWithHistory(layout);
      }

      setDragMode(null);
      setDraggedButton(null);
      setLinkStartButton(null);
      setLinkEndPos(null);
      setResizeHandle(null);
      setLinkType('exclusive');
    },
    [
      dragMode,
      draggedButton,
      linkStartButton,
      linkType,
      layout,
      updateLayoutWithHistory,
      getCanvasPosition,
    ],
  );

  // キャンバスクリック（空白部分）
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === canvasRef.current) {
        onSelectButton(null);
        setSelectedLinkId(null);
      }
    },
    [onSelectButton],
  );

  // コンテキストメニュー
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const pos = getCanvasPosition(e);
      setContextMenu({
        mouseX: e.clientX,
        mouseY: e.clientY,
        position: {
          x: snapToGrid(pos.x, gridSize),
          y: snapToGrid(pos.y, gridSize),
        },
      });
    },
    [getCanvasPosition, gridSize],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // ボタン追加
  const handleAddButton = useCallback(
    (type: 'action' | 'label', name: string, labelValue?: string) => {
      if (!contextMenu) return;

      const newButton = createButton(
        type,
        name,
        contextMenu.position.x,
        contextMenu.position.y,
        {
          labelValue,
        },
      );

      // 重なりチェック
      if (
        canPlaceButton(
          layout.buttons,
          newButton,
          newButton.x,
          newButton.y,
          layout.canvasWidth,
          layout.canvasHeight,
        )
      ) {
        updateLayoutWithHistory({
          ...layout,
          buttons: [...layout.buttons, newButton],
        });
        onSelectButton(newButton.id);
      }
      handleCloseContextMenu();
    },
    [
      contextMenu,
      layout,
      updateLayoutWithHistory,
      onSelectButton,
      handleCloseContextMenu,
    ],
  );

  // ボタン削除
  const handleDeleteButton = useCallback(
    (buttonId: string) => {
      updateLayoutWithHistory({
        ...layout,
        buttons: layout.buttons.filter((b) => b.id !== buttonId),
        buttonLinks: layout.buttonLinks?.filter(
          (l) => l.fromButtonId !== buttonId && l.toButtonId !== buttonId,
        ),
      });
      if (selectedButtonId === buttonId) {
        onSelectButton(null);
      }
    },
    [layout, updateLayoutWithHistory, selectedButtonId, onSelectButton],
  );

  // リンク選択
  const handleSelectLink = useCallback(
    (linkId: string) => {
      setSelectedLinkId(linkId);
      onSelectButton(null); // ボタンの選択を解除
    },
    [onSelectButton],
  );

  // マウスがキャンバス外に出たらドラッグ終了
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragMode) {
        setDragMode(null);
        setDraggedButton(null);
        setLinkStartButton(null);
        setLinkEndPos(null);
        setResizeHandle(null);
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragMode]);

  // リンク線を描画
  const renderLinks = () => {
    if (!showLinks || !layout.buttonLinks) return null;

    // リンクタイプ別の色
    const getLinkColor = (type: string, isSelected: boolean) => {
      if (isSelected) return '#1976d2';
      switch (type) {
        case 'exclusive':
          return '#d32f2f'; // 赤 - 排他リンク
        case 'deactivate':
          return '#f57c00'; // オレンジ - 非活性化
        case 'activate':
          return '#388e3c'; // 緑 - 活性化
        case 'sequence':
          return '#1976d2'; // 青 - シーケンス
        default:
          return '#888';
      }
    };

    // リンクタイプ別の矢印マーカーID（排他リンクは双方向なので矢印なし）
    const getMarkerEnd = (type: string, isSelected: boolean) => {
      // 排他リンクは双方向なので矢印なし
      if (type === 'exclusive') return undefined;
      if (isSelected) return 'url(#arrowhead-selected)';
      switch (type) {
        case 'deactivate':
          return 'url(#arrowhead-deactivate)';
        case 'activate':
          return 'url(#arrowhead-activate)';
        case 'sequence':
          return 'url(#arrowhead-sequence)';
        default:
          return undefined;
      }
    };

    return layout.buttonLinks.map((link) => {
      const fromButton = layout.buttons.find((b) => b.id === link.fromButtonId);
      const toButton = layout.buttons.find((b) => b.id === link.toButtonId);

      if (!fromButton || !toButton) return null;

      // ボタンの中心を取得
      const fromCenter = getButtonCenter(fromButton);
      const toCenter = getButtonCenter(toButton);

      // ボタンの端（境界線上）の座標を計算（矢印がボタンに重ならないよう）
      const from = getButtonEdge(fromButton, toCenter, 2);
      const to = getButtonEdge(toButton, fromCenter, 2);

      // リンク自体が選択されているか、接続先ボタンが選択されている場合はハイライト
      const isLinkSelected = selectedLinkId === link.id;
      const isRelatedToSelectedButton =
        selectedButtonId === fromButton.id || selectedButtonId === toButton.id;
      const isHighlighted = isLinkSelected || isRelatedToSelectedButton;

      const linkColor = getLinkColor(link.type, isHighlighted);
      const markerEnd = getMarkerEnd(link.type, isHighlighted);
      // 排他リンクは実線、その他は破線
      const strokeDash = link.type === 'exclusive' ? 'none' : '5,5';

      return (
        <g key={link.id}>
          {/* クリック領域を広げるための透明な太い線 */}
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="transparent"
            strokeWidth={12}
            style={{ cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation();
              handleSelectLink(link.id);
            }}
          />
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={linkColor}
            strokeWidth={isHighlighted ? 3 : 2}
            strokeDasharray={strokeDash}
            markerEnd={markerEnd}
            style={{ cursor: 'pointer', pointerEvents: 'none' }}
          />
          {/* 選択されたリンクのハイライト表示 */}
          {isLinkSelected && (
            <>
              <circle cx={from.x} cy={from.y} r={6} fill="#1976d2" />
              <circle cx={to.x} cy={to.y} r={6} fill="#1976d2" />
            </>
          )}
        </g>
      );
    });
  };

  // ドラッグ中のリンク線
  // リンクタイプによって色を変える:
  // - Exclusive（排他）: 赤
  // - Lead（活性化）: 緑
  // - Deactivate（非活性化）: オレンジ
  const renderDraggingLink = () => {
    if (!linkStartButton || !linkEndPos) return null;

    const from = getButtonCenter(linkStartButton);

    // リンクタイプに応じた色
    const linkColor =
      linkType === 'lead'
        ? '#388e3c' // 緑
        : linkType === 'deactivate'
          ? '#f57c00' // オレンジ
          : '#d32f2f'; // 赤（Exclusive）

    // リンクタイプに応じた線種
    const strokeDash = linkType === 'exclusive' ? 'none' : '5,5';

    // リンクタイプに応じた矢印マーカー
    const markerEnd =
      linkType === 'lead'
        ? 'url(#arrowhead-dragging-lead)'
        : linkType === 'deactivate'
          ? 'url(#arrowhead-dragging-deactivate)'
          : 'url(#arrowhead-dragging-exclusive)';

    return (
      <line
        x1={from.x}
        y1={from.y}
        x2={linkEndPos.x}
        y2={linkEndPos.y}
        stroke={linkColor}
        strokeWidth={2}
        strokeDasharray={strokeDash}
        markerEnd={markerEnd}
        pointerEvents="none"
      />
    );
  };

  // ボタンを描画
  const renderButton = (button: CodeWindowButton) => {
    const isSelected = button.id === selectedButtonId;
    const isDragging = draggedButton?.id === button.id && dragMode === 'move';
    const isLinkSource = linkStartButton?.id === button.id;
    const buttonColor =
      button.color ||
      (button.type === 'action'
        ? DEFAULT_BUTTON_COLORS.action
        : DEFAULT_BUTTON_COLORS.label);

    return (
      <Paper
        key={button.id}
        elevation={isSelected ? 4 : 1}
        onMouseDown={(e) => {
          // 左クリックのみ移動処理
          if (e.button === 0) {
            handleButtonMouseDown(e, button, 'move');
          } else if (e.button === 2) {
            // 右クリックでリンク作成開始
            handleButtonRightMouseDown(e, button);
          }
        }}
        onContextMenu={(e) => {
          // 右クリックメニューを無効化（ドラッグでリンク作成）
          e.preventDefault();
          e.stopPropagation();
        }}
        sx={{
          position: 'absolute',
          left: button.x,
          top: button.y,
          width: button.width,
          height: button.height,
          backgroundColor: buttonColor,
          color: button.textColor || '#fff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isLinkSource ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
          border: isSelected ? '2px solid #fff' : 'none',
          boxShadow: isSelected ? '0 0 0 2px #1976d2' : undefined,
          borderRadius: `${button.borderRadius ?? 4}px`,
          transition: isDragging ? 'none' : 'box-shadow 0.2s',
          opacity: isDragging ? 0.8 : 1,
          p: 0.5,
          overflow: 'hidden',
          userSelect: 'none',
          zIndex: isSelected ? 10 : 1,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            textAlign: 'center',
            fontSize: '0.7rem',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            width: '100%',
          }}
        >
          {button.name}
        </Typography>
        {button.labelValue && (
          <Typography
            variant="caption"
            sx={{ fontSize: '0.6rem', opacity: 0.8, textAlign: 'center' }}
          >
            {button.labelValue}
          </Typography>
        )}
        {/* コントロール（選択時） */}
        {isSelected && (
          <>
            {/* 削除ボタン */}
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteButton(button.id);
              }}
              sx={{
                position: 'absolute',
                top: 2,
                right: 2,
                p: 0.25,
                color: 'inherit',
                opacity: 0.7,
                '&:hover': { opacity: 1 },
              }}
            >
              <DeleteIcon sx={{ fontSize: 14 }} />
            </IconButton>
            {/* リンクインジケータ（右クリックドラッグでリンク作成） */}
            <Tooltip
              title="右クリックドラッグで排他リンクを作成"
              placement="top"
            >
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 2,
                  left: 2,
                  display: 'flex',
                  alignItems: 'center',
                  opacity: 0.7,
                }}
              >
                <LinkIcon sx={{ fontSize: 12 }} />
              </Box>
            </Tooltip>
            {/* リサイズハンドル */}
            <Box
              onMouseDown={(e) => {
                e.stopPropagation();
                handleButtonMouseDown(e, button, 'resize');
              }}
              sx={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 12,
                height: 12,
                cursor: 'se-resize',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  right: 2,
                  bottom: 2,
                  width: 6,
                  height: 6,
                  borderRight: '2px solid rgba(255,255,255,0.5)',
                  borderBottom: '2px solid rgba(255,255,255,0.5)',
                },
              }}
            />
          </>
        )}
      </Paper>
    );
  };

  return (
    <Box>
      <Box
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        sx={{
          position: 'relative',
          width: layout.canvasWidth,
          height: layout.canvasHeight,
          backgroundColor: 'background.default',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          overflow: 'hidden',
          cursor: dragMode === 'link' ? 'crosshair' : 'default',
        }}
      >
        {/* リンク線（SVG） */}
        <svg
          width={layout.canvasWidth}
          height={layout.canvasHeight}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
          }}
        >
          <defs>
            {/* リンクタイプ別の矢印マーカー */}
            <marker
              id="arrowhead-exclusive"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#d32f2f" />
            </marker>
            <marker
              id="arrowhead-activate"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#388e3c" />
            </marker>
            <marker
              id="arrowhead-deactivate"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#f57c00" />
            </marker>
            <marker
              id="arrowhead-sequence"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#1976d2" />
            </marker>
            <marker
              id="arrowhead-selected"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#1976d2" />
            </marker>
            {/* ドラッグ中のリンク用 */}
            <marker
              id="arrowhead-dragging-exclusive"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#d32f2f" />
            </marker>
            <marker
              id="arrowhead-dragging-lead"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#388e3c" />
            </marker>
            <marker
              id="arrowhead-dragging-deactivate"
              markerWidth="12"
              markerHeight="9"
              refX="10"
              refY="4.5"
              orient="auto"
            >
              <polygon points="0 0, 12 4.5, 0 9" fill="#f57c00" />
            </marker>
          </defs>
          <g style={{ pointerEvents: 'auto' }}>{renderLinks()}</g>
          {renderDraggingLink()}
        </svg>

        {/* ボタン */}
        {layout.buttons.map(renderButton)}

        {/* 空のキャンバス用のプレースホルダー */}
        {layout.buttons.length === 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'text.disabled',
            }}
          >
            <AddIcon sx={{ fontSize: 48, opacity: 0.5 }} />
            <Typography variant="body2">
              空白を右クリック → ボタンを追加
            </Typography>
            <Typography
              variant="caption"
              display="block"
              sx={{ mt: 1, whiteSpace: 'pre-line' }}
            >
              {`リンク作成（Sportscode準拠）:
右クリックドラッグ → 排他リンク（赤）
Option + 右クリックドラッグ → 活性化（緑）
Shift + 右クリックドラッグ → 非活性化（橙）`}
            </Typography>
          </Box>
        )}
      </Box>

      {/* コンテキストメニュー */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            アクションボタン
          </Typography>
        </MenuItem>
        {availableActions.map((action) => (
          <MenuItem
            key={action}
            onClick={() => handleAddButton('action', action)}
            sx={{ pl: 3 }}
          >
            {action}
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              setDialogPosition(contextMenu.position);
            }
            setCustomActionDialogOpen(true);
            handleCloseContextMenu();
          }}
          sx={{ pl: 3, fontStyle: 'italic', color: 'primary.main' }}
        >
          + カスタムアクション...
        </MenuItem>
        <Divider />
        <MenuItem disabled>
          <Typography variant="caption" color="text.secondary">
            ラベルボタン
          </Typography>
        </MenuItem>
        {availableLabelGroups.map((group) => (
          <MenuItem key={group.groupName} sx={{ pl: 2 }}>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {group.groupName}
              </Typography>
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}
              >
                {group.options.map((option) => (
                  <Typography
                    key={option}
                    variant="caption"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddButton('label', group.groupName, option);
                    }}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: 'action.hover',
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      '&:hover': {
                        backgroundColor: 'primary.light',
                        color: 'primary.contrastText',
                      },
                    }}
                  >
                    {option}
                  </Typography>
                ))}
              </Box>
            </Box>
          </MenuItem>
        ))}
        <MenuItem
          onClick={() => {
            if (contextMenu) {
              setDialogPosition(contextMenu.position);
            }
            setCustomLabelDialogOpen(true);
            handleCloseContextMenu();
          }}
          sx={{ pl: 2, fontStyle: 'italic', color: 'secondary.main' }}
        >
          + カスタムラベル...
        </MenuItem>
      </Menu>

      {/* カスタムアクション追加ダイアログ */}
      <Dialog
        open={customActionDialogOpen}
        onClose={() => setCustomActionDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>カスタムアクションを追加</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="アクション名"
            value={customActionName}
            onChange={(e) => setCustomActionName(e.target.value)}
            placeholder="例: Cross, Tackle, Header"
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomActionDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            disabled={!customActionName.trim()}
            onClick={() => {
              if (customActionName.trim()) {
                const newButton = createButton(
                  'action',
                  customActionName.trim(),
                  dialogPosition.x,
                  dialogPosition.y,
                );
                // 配置可能かチェック
                if (
                  canPlaceButton(
                    layout.buttons,
                    newButton,
                    newButton.x,
                    newButton.y,
                    layout.canvasWidth,
                    layout.canvasHeight,
                  )
                ) {
                  updateLayoutWithHistory({
                    ...layout,
                    buttons: [...layout.buttons, newButton],
                  });
                  onSelectButton(newButton.id);
                }
              }
              setCustomActionName('');
              setCustomActionDialogOpen(false);
            }}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>

      {/* カスタムラベル追加ダイアログ */}
      <Dialog
        open={customLabelDialogOpen}
        onClose={() => setCustomLabelDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>カスタムラベルを追加</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="グループ名"
            value={customLabelGroup}
            onChange={(e) => setCustomLabelGroup(e.target.value)}
            placeholder="例: Zone, Technique, Body Part"
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="ラベル値"
            value={customLabelValue}
            onChange={(e) => setCustomLabelValue(e.target.value)}
            placeholder="例: Left, Right, Center"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomLabelDialogOpen(false)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            disabled={!customLabelGroup.trim() || !customLabelValue.trim()}
            onClick={() => {
              if (customLabelGroup.trim() && customLabelValue.trim()) {
                const newButton = createButton(
                  'label',
                  customLabelGroup.trim(),
                  dialogPosition.x,
                  dialogPosition.y,
                  { labelValue: customLabelValue.trim() },
                );
                // 配置可能かチェック
                if (
                  canPlaceButton(
                    layout.buttons,
                    newButton,
                    newButton.x,
                    newButton.y,
                    layout.canvasWidth,
                    layout.canvasHeight,
                  )
                ) {
                  updateLayoutWithHistory({
                    ...layout,
                    buttons: [...layout.buttons, newButton],
                  });
                  onSelectButton(newButton.id);
                }
              }
              setCustomLabelGroup('');
              setCustomLabelValue('');
              setCustomLabelDialogOpen(false);
            }}
          >
            追加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
