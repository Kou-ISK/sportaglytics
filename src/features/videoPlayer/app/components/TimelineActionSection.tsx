import React from 'react';
import { Box, Paper } from '@mui/material';
import { VisualTimeline } from '../..';
import type { TimelineData } from '../../../../types/timeline/core';

interface TimelineActionSectionProps {
  timeline: TimelineData[];
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
  duplicateTimelineItem: (id: string) => string | null;
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
  timeline,
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
        p: 1.5,
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          height: '100%',
          minHeight: 0,
          width: '100%',
        }}
      >
        <VisualTimeline
          timeline={timeline}
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
          teamNames={teamNames}
          videoSources={videoList}
          onUndo={performUndo}
          onRedo={performRedo}
          onAddToPlaylist={onAddToPlaylist}
        />
      </Paper>
    </Box>
  );
};

TimelineActionSection.displayName = 'TimelineActionSection';
