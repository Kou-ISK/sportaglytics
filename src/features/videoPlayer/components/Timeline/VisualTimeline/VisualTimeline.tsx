import React, { useMemo, useCallback, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  RadioGroup,
  Radio,
  Select,
  MenuItem,
  LinearProgress,
} from '@mui/material';
import { TimelineData } from '../../../../../types/TimelineData';
import { TimelineAxis } from './TimelineAxis';
import { TimelineLane } from './TimelineLane';
import { TimelineEditDialog } from './TimelineEditDialog';
import { TimelineContextMenu } from './TimelineContextMenu';
import { useTimelineViewport } from './hooks/useTimelineViewport';
import { ZoomIndicator } from './ZoomIndicator';
import { useTimelineInteractions } from './hooks/useTimelineInteractions';
import { useTimelineRangeSelection } from './hooks/useTimelineRangeSelection';
import { useNotification } from '../../../../../contexts/NotificationContext';

const renderSourceLabel = (src: string) => {
  const parts = src.split(/[/\\]/);
  const name = parts.pop() || src;
  const parent = parts.pop();
  return parent ? `${parent}/${name}` : name;
};
interface VisualTimelineProps {
  timeline: TimelineData[];
  maxSec: number;
  currentTime: number;
  onSeek: (time: number) => void;
  onDelete: (ids: string[]) => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onUpdateQualifier?: (id: string, qualifier: string) => void;
  onUpdateTimeRange?: (id: string, startTime: number, endTime: number) => void;
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  bulkUpdateTimelineItems?: (
    ids: string[],
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  teamNames: string[];
  videoSources?: string[];
  onUndo?: () => void;
  onRedo?: () => void;
}

export const VisualTimeline: React.FC<VisualTimelineProps> = ({
  timeline,
  maxSec,
  currentTime,
  onSeek,
  onDelete,
  selectedIds,
  onSelectionChange,
  onUpdateQualifier,
  onUpdateTimeRange,
  onUpdateTimelineItem,
  bulkUpdateTimelineItems,
  videoSources,
  onUndo,
  onRedo,
}) => {
  const {
    containerRef,
    scrollContainerRef,
    zoomScale,
    containerWidth,
    timeToPosition,
    positionToTime,
    currentTimePosition,
  } = useTimelineViewport({ maxSec, currentTime });
  const {
    hoveredItemId,
    focusedItemId,
    editingDraft,
    contextMenu,
    setHoveredItemId,
    handleItemClick,
    handleItemContextMenu,
    handleCloseContextMenu,
    handleContextMenuEdit,
    handleContextMenuDelete,
    handleContextMenuJumpTo,
    handleContextMenuDuplicate,
    handleDialogChange,
    handleCloseDialog,
    handleDeleteSingle,
    handleSaveDialog,
  } = useTimelineInteractions({
    timeline,
    selectedIds,
    onSelectionChange,
    onSeek,
    onDelete,
    onUpdateTimelineItem,
    onUpdateQualifier,
    onUpdateTimeRange,
  });


  const groupedByAction = useMemo(() => {
    const groups: Record<string, TimelineData[]> = {};
    for (const item of timeline) {
      const actionName = item.actionName;
      if (!groups[actionName]) {
        groups[actionName] = [];
      }
      groups[actionName].push(item);
    }
    return groups;
  }, [timeline]);

  const actionNames = useMemo(
    () => Object.keys(groupedByAction).sort((a, b) => a.localeCompare(b)),
    [groupedByAction],
  );

  // 範囲選択後のclickによる選択クリアを抑止するフラグ
  const suppressClearRef = React.useRef(false);
  const handleSelectionApplied = useCallback(() => {
    suppressClearRef.current = true;
    // 次のtickで解除
    setTimeout(() => {
      suppressClearRef.current = false;
    }, 0);
  }, []);

  const laneRefs = React.useRef<Record<string, HTMLDivElement | null>>({});
  const getLaneBounds = useCallback(
    (actionName: string) => {
      const el = laneRefs.current[actionName];
      const scrollRect = scrollContainerRef.current?.getBoundingClientRect();
      if (!el || !scrollRect) return { top: 0, bottom: 0 };
      const rect = el.getBoundingClientRect();
      const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
      const top = rect.top - scrollRect.top + scrollTop;
      const bottom = rect.bottom - scrollRect.top + scrollTop;
      return { top, bottom };
    },
    [scrollContainerRef],
  );

  const {
    isSelecting,
    selectionBox,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
  } = useTimelineRangeSelection({
    timeline,
    selectedIds,
    getSelectionMetrics: () => ({
      rectLeft:
        scrollContainerRef.current?.getBoundingClientRect().left ?? 0,
      rectTop: scrollContainerRef.current?.getBoundingClientRect().top ?? 0,
      scrollLeft: scrollContainerRef.current?.scrollLeft ?? 0,
      scrollTop: scrollContainerRef.current?.scrollTop ?? 0,
      laneOffset:
        (containerRef.current?.getBoundingClientRect().left ?? 0) -
        (scrollContainerRef.current?.getBoundingClientRect().left ?? 0),
      containerHeight: scrollContainerRef.current?.clientHeight ?? undefined,
    }),
    getLaneBounds,
    onSelectionChange,
    onSelectionApplied: handleSelectionApplied,
  });

  const { info } = useNotification();
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelGroup, setLabelGroup] = useState('');
  const [labelName, setLabelName] = useState('');
  const [recentLabels, setRecentLabels] = useState<
    { group: string; name: string }[]
  >([]);
  const [isLabelQuickPanelOpen, setIsLabelQuickPanelOpen] = useState(false);
  const [clipDialogOpen, setClipDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [overlaySettings, setOverlaySettings] = useState({
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showQualifier: true,
    textTemplate: '{actionName} #{index} | {labels} | {qualifier}',
  });
  const timelineRef = React.useRef(timeline);
  React.useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);
  const [primarySource, setPrimarySource] = useState<string | undefined>(
    videoSources?.[0],
  );
  const [secondarySource, setSecondarySource] = useState<string | undefined>(
    videoSources?.[1],
  );
  const [exportScope, setExportScope] = useState<'selected' | 'all'>(
    selectedIds.length > 0 ? 'selected' : 'all',
  );
  const [exportMode, setExportMode] = useState<
    'single' | 'perInstance' | 'perRow'
  >('single');
  const [angleOption, setAngleOption] = useState<'all' | 'angle1' | 'angle2'>(
    'all',
  );
  const [exportFileName, setExportFileName] = useState('');

  const handleMoveItems = useCallback(
    (ids: string[], targetActionName: string) => {
      if (ids.length === 0) return;
      if (bulkUpdateTimelineItems) {
        bulkUpdateTimelineItems(ids, { actionName: targetActionName });
      } else if (onUpdateTimelineItem) {
        ids.forEach((id) =>
          onUpdateTimelineItem(id, { actionName: targetActionName }),
        );
      }
      info(`${ids.length}件を ${targetActionName} に移動しました`);
    },
    [bulkUpdateTimelineItems, info, onUpdateTimelineItem],
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const timeMarkers = useMemo(() => {
    const markers: number[] = [];
    if (maxSec <= 0) return markers;

    // 目盛りの間隔: 動画の長さに応じて調整（より広めに）
    let interval: number;
    if (maxSec <= 120) {
      interval = 15;
    } else if (maxSec <= 300) {
      interval = 30;
    } else if (maxSec <= 600) {
      interval = 60;
    } else if (maxSec <= 1800) {
      interval = 120;
    } else {
      interval = 300;
    }

    for (let i = 0; i <= maxSec; i += interval) {
      markers.push(i);
    }
    return markers;
  }, [maxSec]);

  const firstTeamName = actionNames[0]?.split(' ')[0];

  const selectionActionsVisible = selectedIds.length > 0;
  const selectedStats = useMemo(() => {
    if (selectedIds.length === 0) return null;
    const selectedItems = timeline.filter((item) => selectedIds.includes(item.id));
    const total = selectedItems.reduce(
      (sum, item) => sum + Math.max(0, item.endTime - item.startTime),
      0,
    );
    const avg = selectedItems.length > 0 ? total / selectedItems.length : 0;
    return { total, avg };
  }, [selectedIds, timeline]);
  const earliestSelected = useMemo(() => {
    const items = timeline.filter((item) => selectedIds.includes(item.id));
    if (items.length === 0) return null;
    return items.reduce(
      (acc, cur) => (cur.startTime < acc.startTime ? cur : acc),
      items[0],
    );
  }, [selectedIds, timeline]);

  const handleApplyLabel = useCallback(
    (override?: { group: string; name: string }) => {
      if (!onUpdateTimelineItem) return;
    const group = (override?.group ?? labelGroup).trim();
    const name = (override?.name ?? labelName).trim();
    if (!group || !name) return;

    let applied = 0;
    const uniqueIds = Array.from(new Set(selectedIds));
    const current = timelineRef.current;

    // 事前に全アイテムのラベル配列を計算してから一括適用
    uniqueIds.forEach((id) => {
      const item = current.find((t) => t.id === id);
      if (!item) return;
      const existing = item.labels ? [...item.labels] : [];
      const exists = existing.some(
        (l) => l.group === group && l.name === name,
      );
      const updatedLabels = exists
        ? existing
        : [...existing, { group, name }];
      onUpdateTimelineItem(id, { labels: updatedLabels });
      applied += 1;
    });

    if (group && name) {
      setRecentLabels((prev) => {
        const next = [
          { group, name },
          ...prev.filter((l) => !(l.group === group && l.name === name)),
        ];
        return next.slice(0, 5);
      });
    }

    if (applied > 0) {
      info(`${applied}件にラベル '${group}: ${name}' を付与しました`);
    }
    setLabelGroup(group);
    setLabelName(name);
    setLabelDialogOpen(false);
  },
    [info, labelGroup, labelName, onUpdateTimelineItem, selectedIds],
  );

  // グローバルKeyDownでTabジャンプ・Undo/Redoを処理（選択があるときのみ）
  React.useEffect(() => {
    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isFormElement =
        tag === 'input' || tag === 'textarea' || tag === 'select' || tag === 'button';
      const isInsideTimeline =
        !!scrollContainerRef.current &&
        !!target &&
        scrollContainerRef.current.contains(target);

      // Tab: 選択がある場合はタイムラインのジャンプを優先。それ以外は抑止のみ。
      if (e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();

        if (selectedIds.length > 0) {
          const items = [...timeline].sort((a, b) => a.startTime - b.startTime);
          const current = items.find((t) => selectedIds.includes(t.id));
          if (current) {
            const same = items.filter((t) => t.actionName === current.actionName);
            const idx = same.findIndex((t) => t.id === current.id);
            if (idx !== -1) {
              const direction: 1 | -1 = e.shiftKey ? -1 : 1;
              const nextIdx =
                (idx + direction + same.length) % Math.max(same.length, 1);
              const targetItem = same[nextIdx];
              if (targetItem) {
                onSelectionChange([targetItem.id]);
                onSeek(targetItem.startTime);
              }
            }
          }
        }
        return;
      }

      // Undo/Redo（フォーム要素以外）
      if (
        isInsideTimeline &&
        !isFormElement &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDownGlobal, true);
    return () => window.removeEventListener('keydown', handleKeyDownGlobal, true);
  }, [selectedIds, timeline, onSelectionChange, onSeek, onRedo, onUndo]);

  const handleBackgroundClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      // ドラッグ選択中はクリアしない（mouseup後のclickバブリングを無視）
      if (isSelecting || selectionBox) return;
      if (suppressClearRef.current) return;
      onSelectionChange([]);
    },
    [isSelecting, selectionBox, onSelectionChange],
  );

  const handleOpenClipDialog = useCallback(async () => {
    // 設定からオーバーレイのデフォルトを読み込む
    try {
      const settings =
        (await globalThis.window.electronAPI?.loadSettings?.()) as
          | { overlayClip?: typeof overlaySettings }
          | undefined;
      if (settings?.overlayClip) {
        setOverlaySettings((prev) => ({
          ...prev,
          ...settings.overlayClip,
        }));
      }
    } catch {
      // ignore, fallback to current state
    }
    setClipDialogOpen(true);
  }, []);

  const handleExportClips = useCallback(async () => {
    const sourcePath = primarySource || videoSources?.[0];
    const sourcePath2 = secondarySource || videoSources?.[1];
    if (!sourcePath) {
      info('書き出し元の映像ファイルが取得できません');
      setClipDialogOpen(false);
      return;
    }
    const useDual =
      angleOption === 'all' && sourcePath2 ? true : angleOption === 'angle2';
    if (useDual && !sourcePath2) {
      info('2アングル結合には2つの映像ソースが必要です');
      return;
    }
    if (!globalThis.window.electronAPI?.exportClipsWithOverlay) {
      info('クリップ書き出しAPIが利用できません');
      setClipDialogOpen(false);
      return;
    }
    const ordered = [...timeline].sort((a, b) => a.startTime - b.startTime);
    const actionIndexLookup = new Map<string, number>();
    const counters: Record<string, number> = {};
    ordered.forEach((item) => {
      const c = (counters[item.actionName] || 0) + 1;
      counters[item.actionName] = c;
      actionIndexLookup.set(item.id, c);
    });

    const sourceItems =
      exportScope === 'selected'
        ? timeline.filter((t) => selectedIds.includes(t.id))
        : timeline;
    if (sourceItems.length === 0) {
      info('書き出すインスタンスがありません');
      setClipDialogOpen(false);
      return;
    }
    // 同一アクション内での番号を付与
    const clips = sourceItems
      .sort((a, b) => a.startTime - b.startTime)
      .map((item) => {
        const count = actionIndexLookup.get(item.id) ?? 1;
        return {
          id: item.id,
          actionName: item.actionName,
          startTime: item.startTime,
          endTime: item.endTime,
          labels:
            item.labels?.map((l) => ({
              group: l.group || '',
              name: l.name,
            })) || undefined,
          qualifier: item.qualifier || undefined,
          actionIndex: count,
        };
      });

    setIsExporting(true);
    const result = await globalThis.window.electronAPI.exportClipsWithOverlay({
      sourcePath,
      sourcePath2: useDual ? sourcePath2 : undefined,
      mode: useDual ? 'dual' : 'single',
      exportMode,
      angleOption,
      clips,
      overlay: overlaySettings,
      outputFileName: exportFileName.trim() || undefined,
    });
    setIsExporting(false);
    if (result?.success) {
      info('クリップを書き出しました');
      setClipDialogOpen(false);
    } else {
      info(result?.error || 'クリップ書き出しに失敗しました');
    }
  }, [
    exportScope,
    exportMode,
    info,
    overlaySettings,
    primarySource,
    secondarySource,
    selectedIds,
    timeline,
    videoSources,
    exportFileName,
  ]);

  React.useEffect(() => {
    const handler = () => {
      handleOpenClipDialog();
    };
    globalThis.window.electronAPI?.on?.('menu-export-clips', handler);
    return () => {
      globalThis.window.electronAPI?.off?.('menu-export-clips', handler);
    };
  }, [handleOpenClipDialog]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <ZoomIndicator zoomScale={zoomScale} />

      {selectionActionsVisible && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 16,
            zIndex: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 1,
            bgcolor: 'background.paper',
            px: 1.25,
            py: 0.75,
            borderRadius: 2,
            boxShadow: 3,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {selectedIds.length} 件選択
          </Typography>
          {selectedStats && (
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
              合計 {formatTime(selectedStats.total)} / 平均 {formatTime(selectedStats.avg)}
            </Typography>
          )}
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              if (earliestSelected) {
                onSeek(earliestSelected.startTime);
              }
            }}
            disabled={!earliestSelected}
          >
            先頭へシーク
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              setIsLabelQuickPanelOpen((prev) => !prev);
              setLabelDialogOpen(false);
            }}
          >
            ラベルモード
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={() => onDelete(selectedIds)}
          >
            削除
          </Button>
        </Box>
      )}

      {selectionActionsVisible && isLabelQuickPanelOpen && (
        <Box
          sx={{
            position: 'absolute',
            top: 50,
            right: 16,
            zIndex: 19,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 3,
            p: 1.5,
            minWidth: 240,
            border: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            選択中 {selectedIds.length} 件に付与
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              label="グループ"
              value={labelGroup}
              onChange={(e) => setLabelGroup(e.target.value)}
              fullWidth
            />
            <TextField
              size="small"
              label="ラベル名"
              value={labelName}
              onChange={(e) => setLabelName(e.target.value)}
              fullWidth
            />
          </Box>
          {recentLabels.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {recentLabels.map((l) => (
                <Chip
                  key={`${l.group}-${l.name}`}
                  label={`${l.group}: ${l.name}`}
                  size="small"
                  onClick={() => handleApplyLabel(l)}
                  sx={{ bgcolor: 'action.hover' }}
                />
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setIsLabelQuickPanelOpen(false);
              }}
            >
              閉じる
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => handleApplyLabel()}
              disabled={!labelGroup.trim() || !labelName.trim()}
            >
              適用
            </Button>
          </Box>
        </Box>
      )}

      <Box
        sx={{ position: 'relative', flex: 1 }}
      >
        <Box
          ref={scrollContainerRef}
          sx={{
            position: 'relative',
            flex: 1,
            overflowY: 'auto',
            overflowX: zoomScale > 1 ? 'auto' : 'hidden',
            px: 2,
            pt: 2,
            pb: 2,
            height: '100%',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={(e) => handleMouseUp(e, positionToTime)}
          onClick={handleBackgroundClick}
        >
          <Box
            sx={{
              minWidth:
                containerWidth > 0 ? `${containerWidth * zoomScale}px` : '100%',
            }}
          >
            <TimelineAxis
              containerRef={containerRef}
              maxSec={maxSec}
              currentTimePosition={currentTimePosition}
              timeMarkers={timeMarkers}
              timeToPosition={timeToPosition}
              onSeek={onSeek}
              formatTime={formatTime}
            />

            {actionNames.map((actionName) => (
              <TimelineLane
                key={actionName}
                actionName={actionName}
                items={groupedByAction[actionName]}
                selectedIds={selectedIds}
                hoveredItemId={hoveredItemId}
                focusedItemId={focusedItemId}
                onHoverChange={setHoveredItemId}
                onItemClick={handleItemClick}
                onItemContextMenu={handleItemContextMenu}
                timeToPosition={timeToPosition}
                positionToTime={positionToTime}
                currentTimePosition={currentTimePosition}
                formatTime={formatTime}
                firstTeamName={firstTeamName}
                onSeek={onSeek}
                maxSec={maxSec}
            onUpdateTimeRange={onUpdateTimeRange}
            onMoveItem={handleMoveItems}
            laneRef={(el) => {
              laneRefs.current[actionName] = el;
            }}
          />
        ))}

            {timeline.length === 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 200,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  タイムラインが空です。アクションボタンでタグ付けを開始してください。
                </Typography>
              </Box>
            )}
          </Box>

          {isSelecting && selectionBox && (
            <Box
              sx={{
                position: 'absolute',
                top: selectionBox.top,
                left: selectionBox.left,
                width: selectionBox.width,
                height: selectionBox.height,
                border: '1px dashed',
                borderColor: 'primary.main',
                bgcolor: 'primary.main',
                opacity: 0.1,
                pointerEvents: 'none',
              }}
            />
          )}
        </Box>
      </Box>

      <TimelineEditDialog
        draft={editingDraft}
        open={Boolean(editingDraft)}
        onChange={handleDialogChange}
        onClose={handleCloseDialog}
        onDelete={handleDeleteSingle}
        onSave={handleSaveDialog}
      />

      <TimelineContextMenu
        anchorPosition={contextMenu?.position || null}
        onClose={handleCloseContextMenu}
        onEdit={handleContextMenuEdit}
        onDelete={handleContextMenuDelete}
        onJumpTo={handleContextMenuJumpTo}
        onDuplicate={handleContextMenuDuplicate}
      />

      <Dialog
        open={labelDialogOpen}
        onClose={() => setLabelDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>ラベルを付与</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            選択中 {selectedIds.length} 件に同じラベルを付与します。入力は次回も保持されるので連続付与が素早く行えます。
          </Typography>
          <TextField
            label="グループ"
            value={labelGroup}
            onChange={(e) => setLabelGroup(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && labelGroup.trim() && labelName.trim()) {
                e.preventDefault();
                handleApplyLabel();
              }
            }}
          />
          <TextField
            label="ラベル名"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && labelGroup.trim() && labelName.trim()) {
                e.preventDefault();
                handleApplyLabel();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLabelDialogOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            onClick={() => handleApplyLabel()}
            disabled={!labelGroup.trim() || !labelName.trim()}
          >
            付与
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={clipDialogOpen}
        onClose={() => setClipDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>クリップ書き出し</DialogTitle>
        <DialogContent
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <Typography variant="body2" color="text.secondary">
            書き出し対象と出力モードを選択してください。オーバーレイは設定画面の値を使用します。
          </Typography>
          <Typography variant="subtitle2">Exporting:</Typography>
          <RadioGroup
            value={exportScope}
            onChange={(e) =>
              setExportScope(e.target.value === 'selected' ? 'selected' : 'all')
            }
          >
            <FormControlLabel value="all" control={<Radio />} label="全体" />
            <FormControlLabel
              value="selected"
              control={<Radio />}
              label={`選択インスタンス (${selectedIds.length} 件)`}
            />
          </RadioGroup>

          <Typography variant="subtitle2">Export As:</Typography>
          <Select
            size="small"
            value={exportMode}
            onChange={(e) =>
              setExportMode(
                e.target.value as 'single' | 'perInstance' | 'perRow',
              )
            }
          >
            <MenuItem value="single">単一映像ファイル（連結）</MenuItem>
            <MenuItem value="perInstance">インスタンスごとに出力</MenuItem>
            <MenuItem value="perRow">行ごとに出力</MenuItem>
          </Select>
          <TextField
            label="ファイル名（連結時）/ プレフィックス"
            size="small"
            placeholder="例: combined_export"
            value={exportFileName}
            onChange={(e) => setExportFileName(e.target.value)}
            helperText="単一出力ではこの名前で保存。行/インスタンス出力では先頭に付与します（拡張子は自動で .mp4）。"
          />

          <Typography variant="subtitle2">Video Angles:</Typography>
          <RadioGroup
            row
            value={angleOption}
            onChange={(e) =>
              setAngleOption(e.target.value as 'all' | 'angle1' | 'angle2')
            }
          >
            <FormControlLabel value="all" control={<Radio />} label="全て" />
            <FormControlLabel value="angle1" control={<Radio />} label="アングル1" />
            <FormControlLabel value="angle2" control={<Radio />} label="アングル2" />
          </RadioGroup>
          <TextField
            select
            SelectProps={{ native: true }}
            label="メイン映像"
            value={primarySource || ''}
            onChange={(e) => setPrimarySource(e.target.value)}
            size="small"
          >
            {(videoSources || []).map((src) => (
              <option key={src} value={src}>
                {renderSourceLabel(src)}
              </option>
            ))}
          </TextField>
          {angleOption === 'all' && (
            <TextField
              select
              SelectProps={{ native: true }}
              label="サブ映像（横並び）"
              value={secondarySource || ''}
              onChange={(e) => setSecondarySource(e.target.value)}
              size="small"
            >
              {(videoSources || []).map((src) => (
                <option key={src} value={src}>
                  {renderSourceLabel(src)}
                </option>
              ))}
            </TextField>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClipDialogOpen(false)}>キャンセル</Button>
          <Button variant="contained" onClick={handleExportClips}>
            書き出し
          </Button>
        </DialogActions>
      </Dialog>

      {isExporting && (
        <Dialog open keepMounted fullWidth maxWidth="xs">
          <DialogTitle>書き出し中...</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ mb: 2 }}>
              FFmpegでクリップを書き出しています。完了までお待ちください。
            </Typography>
            <LinearProgress />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};
