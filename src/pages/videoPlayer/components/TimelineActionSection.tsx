import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from 'react';
import { Box, Paper } from '@mui/material';
import { VisualTimeline } from '../../../features/videoPlayer/components/Timeline/VisualTimeline/VisualTimeline';
import {
  EnhancedCodePanel,
  type EnhancedCodePanelHandle,
} from '../../../features/videoPlayer/components/Controls/EnhancedCodePanel';
import { TimelineData } from '../../../types/TimelineData';

export interface TimelineActionSectionHandle {
  triggerAction: (teamName: string, actionName: string) => void;
}

interface TimelineActionSectionProps {
  timeline: TimelineData[];
  maxSec: number;
  currentTime: number;
  selectedTimelineIdList: string[];
  setSelectedTimelineIdList: (ids: string[]) => void;
  metaDataConfigFilePath: string;
  teamNames: string[];
  setTeamNames: React.Dispatch<React.SetStateAction<string[]>>;
  addTimelineData: (
    actionName: string,
    startTime: number,
    endTime: number,
    qualifier: string,
    actionType?: string,
    actionResult?: string,
    labels?: Array<{ name: string; group: string }>,
    color?: string,
  ) => void;
  deleteTimelineDatas: (ids: string[]) => void;
  updateQualifier: (id: string, qualifier: string) => void;
  updateTimelineRange: (id: string, startTime: number, endTime: number) => void;
  updateTimelineItem: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  bulkUpdateTimelineItems: (
    ids: string[],
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  videoList: string[];
  performUndo: () => void;
  performRedo: () => void;
  handleCurrentTime: (
    event: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => void;
  applyLabelsToTimeline: (
    ids: string[],
    labels: { name: string; group: string }[],
  ) => void;
}

export const TimelineActionSection = forwardRef<
  TimelineActionSectionHandle,
  TimelineActionSectionProps
>(
  (
    {
      timeline,
      maxSec,
      currentTime,
      selectedTimelineIdList,
      setSelectedTimelineIdList,
      metaDataConfigFilePath,
      teamNames,
      setTeamNames,
      addTimelineData,
      deleteTimelineDatas,
      updateQualifier,
      updateTimelineRange,
      updateTimelineItem,
      bulkUpdateTimelineItems,
      videoList,
      performUndo,
      performRedo,
      handleCurrentTime,
      applyLabelsToTimeline,
    },
    ref,
  ) => {
    const codePanelRef = useRef<EnhancedCodePanelHandle>(null);

    useImperativeHandle(ref, () => ({
      triggerAction: (teamName: string, actionName: string) => {
        codePanelRef.current?.triggerAction(teamName, actionName);
      },
    }));
    // metaDataConfigFilePathからチーム名を読み込む
    useEffect(() => {
      if (!metaDataConfigFilePath) return;

      let isActive = true;

      fetch(metaDataConfigFilePath)
        .then((response) => response.json())
        .then((data) => {
          if (!isActive || !data) return;

          if (data.team1Name && data.team2Name) {
            setTeamNames([data.team1Name, data.team2Name]);
          }
        })
        .catch((error) => console.error('Error loading JSON:', error));

      return () => {
        isActive = false;
      };
    }, [metaDataConfigFilePath, setTeamNames]);

    // タイムラインから最初のチーム名を計算（タイムラインの色と一致させるため）
    const firstTeamName = React.useMemo(() => {
      if (timeline.length === 0) return teamNames[0];
      // タイムラインのアクション名をソートして最初のチーム名を取得
      const sortedActionNames = [
        ...new Set(timeline.map((t) => t.actionName)),
      ].sort((a, b) => a.localeCompare(b));
      return sortedActionNames[0]?.split(' ')[0] || teamNames[0];
    }, [timeline, teamNames]);

    return (
      <Box
        sx={{
          gridColumn: '1',
          gridRow: '2',
          display: 'grid',
          gridTemplateColumns: '1fr 440px',
          height: '100%',
          minHeight: 0,
          gap: 1.5,
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
            onUpdateQualifier={updateQualifier}
            onUpdateTimeRange={updateTimelineRange}
            onUpdateTimelineItem={updateTimelineItem}
            bulkUpdateTimelineItems={bulkUpdateTimelineItems}
            teamNames={teamNames}
            videoSources={videoList}
            onUndo={performUndo}
            onRedo={performRedo}
          />
        </Paper>

        <Paper
          variant="outlined"
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            height: '100%',
            p: 1.5,
          }}
        >
          <EnhancedCodePanel
            ref={codePanelRef}
            addTimelineData={addTimelineData}
            teamNames={teamNames}
            firstTeamName={firstTeamName}
            selectedIds={selectedTimelineIdList}
            onApplyLabels={applyLabelsToTimeline}
          />
        </Paper>
      </Box>
    );
  },
);

TimelineActionSection.displayName = 'TimelineActionSection';
