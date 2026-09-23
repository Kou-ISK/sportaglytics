import React from 'react';
import type { CaptureTimelineState } from '../../../../types/liveCapture';
import { LiveCaptureTimelineView } from './LiveCaptureTimelineView';
import type {
  AngleSyncCommand,
  AngleSyncSnapshot,
} from '../../../../types/ipc/angleSync';
import type { HotkeyConfig } from '../../../../types/settings/coreTypes';
import { Box, Paper, Typography } from '@mui/material';
import { VisualTimeline } from '../..';
import type {
  TimelineData,
  TimelineRow,
  TimelineRowSortSpec,
} from '../../../../types/timeline/core';
import { TimelineRowSortControl } from '../../components/Timeline/VisualTimeline/TimelineRowSortControl';
import { AngleSyncTransportView } from './AngleSyncTransportView';

interface TimelineActionSectionProps {
  liveCapture?: CaptureTimelineState;
  onGoLive?: () => void;
  onShowCapture?: () => void;
  angleSync?: AngleSyncSnapshot;
  isPlaying: boolean;
  hotkeys: HotkeyConfig[];
  canSync: boolean;
  onStartSync: () => void;
  onAngleSyncCommand: (command: AngleSyncCommand) => void;
  timeline: TimelineData[];
  timelineRows: TimelineRow[];
  maxSec: number;
  currentTime: number;
  selectedTimelineIdList: string[];
  setSelectedTimelineIdList: (ids: string[]) => void;
  teamNames: string[];
  deleteTimelineDatas: (ids: string[]) => void;
  updateMemo: (id: string, memo: string) => void;
  updateTimelineRange: (id: string, startTime: number, endTime: number) => void;
  updateTimelineItem: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  bulkUpdateTimelineItems: (
    ids: string[],
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  splitTimelineItem: (id: string, time: number) => void;
  mergeTimelineItems: (ids: string[]) => void;
  duplicateTimelineItem: (id: string) => string | null;
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    memo: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
    color?: string,
  ) => void;
  addTimelineRow: (name?: string, color?: string) => void;
  updateTimelineRow: (
    id: string,
    updates: Pick<TimelineRow, 'name' | 'color'>,
  ) => void;
  moveTimelineRow: (sourceId: string, targetId: string) => void;
  sortTimelineRows: (spec: TimelineRowSortSpec) => void;
  deleteTimelineRows: (ids: string[]) => void;
  pasteTimelineItemsToRow: (
    items: TimelineData[],
    targetRowId: string,
  ) => string[];
  videoList: string[];
  performUndo: () => void;
  performRedo: () => void;
  handleCurrentTime: (
    event: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => void;
  /** プレイリストに追加（位置情報付き） */
  onAddToPlaylist?: (items: TimelineData[]) => void;
}

export const TimelineActionSection = ({
  liveCapture,
  onGoLive,
  onShowCapture,
  angleSync,
  isPlaying,
  hotkeys,
  canSync,
  onStartSync,
  onAngleSyncCommand,
  timeline,
  timelineRows,
  maxSec,
  currentTime,
  selectedTimelineIdList,
  setSelectedTimelineIdList,
  teamNames,
  deleteTimelineDatas,
  updateMemo,
  updateTimelineRange,
  updateTimelineItem,
  bulkUpdateTimelineItems,
  duplicateTimelineItem,
  splitTimelineItem,
  mergeTimelineItems,
  addTimelineData,
  addTimelineRow,
  updateTimelineRow,
  moveTimelineRow,
  sortTimelineRows,
  deleteTimelineRows,
  pasteTimelineItemsToRow,
  videoList,
  performUndo,
  performRedo,
  handleCurrentTime,
  onAddToPlaylist,
}: TimelineActionSectionProps) => {
  return (
    <Box
      sx={{
        gridColumn: '1',
        gridRow: '2',
        display: 'flex',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        p: 1,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          height: '100%',
          minHeight: 0,
          width: '100%',
          minWidth: 0,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            gap: 0.5,
            alignItems: 'center',
            minHeight: 32,
            px: 0.5,
            borderBottom: 1,
            borderColor: 'divider',
            flexShrink: 0,
          }}
        >
          <AngleSyncTransportView
            state={angleSync}
            time={currentTime}
            playing={isPlaying}
            hotkeys={hotkeys}
            canSync={canSync}
            onStart={onStartSync}
            onSeek={(time) => handleCurrentTime(new Event('sync-seek'), time)}
            onCommand={onAngleSyncCommand}
          />
          <TimelineRowSortControl onSort={sortTimelineRows} />
          {liveCapture && onGoLive && (
            <LiveCaptureTimelineView
              state={liveCapture}
              onGoLive={onGoLive}
              onShowCapture={onShowCapture}
            />
          )}
        </Box>
        {angleSync?.message && (
          <Typography
            role="status"
            variant="caption"
            sx={{ px: 1, py: 0.25, flexShrink: 0 }}
          >
            {angleSync.message}
          </Typography>
        )}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <VisualTimeline
            angleSync={angleSync}
            timeline={timeline}
            rows={timelineRows}
            maxSec={maxSec}
            currentTime={currentTime}
            onSeek={(time: number) => {
              const event = new Event('visual-timeline-seek');
              handleCurrentTime(event, time);
            }}
            onDelete={deleteTimelineDatas}
            selectedIds={selectedTimelineIdList}
            onSelectionChange={(ids: string[]) => {
              setSelectedTimelineIdList(ids);
            }}
            onUpdateMemo={updateMemo}
            onUpdateTimeRange={updateTimelineRange}
            onUpdateTimelineItem={updateTimelineItem}
            bulkUpdateTimelineItems={bulkUpdateTimelineItems}
            onDuplicateTimelineItem={duplicateTimelineItem}
            onSplitTimelineItem={splitTimelineItem}
            onMergeTimelineItems={mergeTimelineItems}
            onCreateTimelineItem={(actionName, startTime, endTime, color) =>
              addTimelineData(
                actionName,
                startTime,
                endTime,
                '',
                undefined,
                undefined,
                undefined,
                color,
              )
            }
            onAddRow={addTimelineRow}
            onUpdateRow={updateTimelineRow}
            onMoveRow={moveTimelineRow}
            onDeleteRows={deleteTimelineRows}
            onPasteTimelineItemsToRow={pasteTimelineItemsToRow}
            teamNames={teamNames}
            videoSources={videoList}
            onUndo={performUndo}
            onRedo={performRedo}
            onAddToPlaylist={onAddToPlaylist}
          />
        </Box>
      </Paper>
    </Box>
  );
};

TimelineActionSection.displayName = 'TimelineActionSection';
