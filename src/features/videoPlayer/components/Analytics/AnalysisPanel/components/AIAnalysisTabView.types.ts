import type { PlaylistItem } from '../../../../../../types/playlist/core';
import type { TimelineData } from '../../../../../../types/timeline/core';
import type { RetrieverPresetValue } from './ai/AIAnalysisControlsPanel.types';
import type { useAIAnalysisTabController } from '../controllers/useAIAnalysisTabController';

export type AIAnalysisTabControllerState = ReturnType<
  typeof useAIAnalysisTabController
>;

export interface AIAnalysisTabViewProps extends AIAnalysisTabControllerState {
  hasData: boolean;
  timeline: TimelineData[];
  emptyMessage: string;
  totalTimelineCount?: number;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
  onJumpToSegment?: (segment: TimelineData) => void;
  onRetrieverPresetChange: (value: RetrieverPresetValue) => void;
}
