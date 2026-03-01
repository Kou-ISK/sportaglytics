import { useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PlaylistItem } from '../../../../../../../../types/Playlist';
import type { EvidenceItem } from '../../../../../../analysis/ai';
import { buildPlaylistName } from './aiAnalysisUtils';

interface ClipSegment {
  title: string;
  reason: string;
  startTime: number;
  endTime: number;
  centerIds: string[];
  evidenceIds: string[];
}

interface UseAIAnalysisPlaylistActionsParams {
  clipSegments: ClipSegment[];
  evidenceMap: Map<string, EvidenceItem>;
  onCreateAiPlaylist?: (payload: {
    name: string;
    items: PlaylistItem[];
  }) => Promise<void> | void;
  setPlaylistMessage: Dispatch<SetStateAction<string | null>>;
}

interface AIAnalysisPlaylistActions {
  handleCreatePlaylist: () => Promise<void>;
}

export const useAIAnalysisPlaylistActions = ({
  clipSegments,
  evidenceMap,
  onCreateAiPlaylist,
  setPlaylistMessage,
}: UseAIAnalysisPlaylistActionsParams): AIAnalysisPlaylistActions => {
  const handleCreatePlaylist = useCallback(async () => {
    if (!onCreateAiPlaylist) {
      setPlaylistMessage('プレイリスト機能が利用できません。');
      return;
    }
    if (clipSegments.length === 0) {
      setPlaylistMessage('生成可能なクリップがありません。');
      return;
    }

    setPlaylistMessage('AIプレイリストを作成中...');
    const now = Date.now();
    const items: PlaylistItem[] = clipSegments.map((segment, index) => {
      const primaryCenterId = segment.centerIds[0];
      const center = primaryCenterId ? evidenceMap.get(primaryCenterId) : null;
      const actionName = segment.title || center?.actionName || `AI Clip ${index + 1}`;
      return {
        id: crypto.randomUUID(),
        timelineItemId: primaryCenterId ?? null,
        actionName,
        startTime: segment.startTime,
        endTime: segment.endTime,
        labels: center?.labels,
        memo: center?.memo,
        addedAt: now,
        aiMeta: {
          reason: segment.reason,
          centerId: primaryCenterId,
          centerIds: segment.centerIds,
          evidenceIds: segment.evidenceIds,
          source: 'ai-review',
        },
      };
    });

    try {
      await onCreateAiPlaylist({
        name: buildPlaylistName(),
        items,
      });
      setPlaylistMessage('AIプレイリストを作成しました。');
    } catch (error) {
      console.debug('[AI] playlist creation failed', error);
      setPlaylistMessage('AIプレイリストの作成に失敗しました。');
    }
  }, [clipSegments, evidenceMap, onCreateAiPlaylist, setPlaylistMessage]);

  return {
    handleCreatePlaylist,
  };
};
