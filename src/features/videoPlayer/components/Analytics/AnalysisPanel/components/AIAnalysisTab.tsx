import React from 'react';
import type { PlaylistItem } from '../../../../../../types/Playlist';
import type { TimelineData } from '../../../../../../types/TimelineData';
import type { RetrieverPresetValue } from './ai/AIAnalysisControlsPanel.types';
import { AIAnalysisTabView } from './AIAnalysisTabView';
import { useAIAnalysisTabController } from '../controllers/useAIAnalysisTabController';

interface AIAnalysisTabProps {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
  totalTimelineCount?: number;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
  onJumpToSegment?: (segment: TimelineData) => void;
}

export const AIAnalysisTab = ({
  hasData,
  timeline,
  emptyMessage,
  totalTimelineCount,
  onCreateAiPlaylist,
  onJumpToSegment,
}: AIAnalysisTabProps) => {
  const controller = useAIAnalysisTabController({ timeline, onCreateAiPlaylist });

  return (
    <AIAnalysisTabView
      hasData={hasData}
      timeline={timeline}
      emptyMessage={emptyMessage}
      totalTimelineCount={totalTimelineCount}
      onCreateAiPlaylist={onCreateAiPlaylist}
      onJumpToSegment={onJumpToSegment}
      {...controller}
      onRetrieverPresetChange={(value: RetrieverPresetValue) => {
        controller.setAiSettings({
          ...controller.aiSettings,
          retrieverPreset: value,
        });
      }}
    />
  );
};
