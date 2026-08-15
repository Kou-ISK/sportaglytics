import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGlobalHotkeys } from '../../../../hooks/useGlobalHotkeys';
import type {
  TimelineData,
  TimelineRow,
} from '../../../../types/timeline/core';
import type { TimelineWindowSyncPayload } from '../../../../types/ipc/timelineWindow';
import {
  sendTimelineWindowCommand,
  subscribeTimelineWindowClock,
  subscribeTimelineWindowSync,
} from '../gateways/timelineWindowGateway';

export const useTimelineWindowController = () => {
  const [snapshot, setSnapshot] = useState<TimelineWindowSyncPayload | null>(
    null,
  );

  useEffect(() => {
    const unsubscribeSync = subscribeTimelineWindowSync(setSnapshot);
    const unsubscribeClock = subscribeTimelineWindowClock((clock) => {
      setSnapshot((current) => (current ? { ...current, ...clock } : current));
    });
    sendTimelineWindowCommand({ type: 'request-sync' });
    return () => {
      unsubscribeClock();
      unsubscribeSync();
    };
  }, []);

  const hotkeyHandlers = useMemo<Record<string, () => void>>(() => {
    if (!snapshot) return {};
    return Object.fromEntries(
      snapshot.hotkeys.map((hotkey) => [
        hotkey.id,
        () =>
          sendTimelineWindowCommand({
            type: 'hotkey-key-down',
            hotkeyId: hotkey.id,
          }),
      ]),
    );
  }, [snapshot]);
  const keyUpHandlers = useMemo<Record<string, () => void>>(() => {
    if (!snapshot) return {};
    return Object.fromEntries(
      snapshot.hotkeys.map((hotkey) => [
        hotkey.id,
        () =>
          sendTimelineWindowCommand({
            type: 'hotkey-key-up',
            hotkeyId: hotkey.id,
          }),
      ]),
    );
  }, [snapshot]);
  useGlobalHotkeys(snapshot?.hotkeys ?? [], hotkeyHandlers, keyUpHandlers);

  const send = sendTimelineWindowCommand;
  const onSeek = useCallback((time: number) => {
    setSnapshot((current) =>
      current
        ? { ...current, currentTime: time, updatedAt: Date.now() }
        : current,
    );
    send({ type: 'seek', time });
  }, []);
  const onSelectionChange = useCallback((ids: string[]) => {
    setSnapshot((current) =>
      current ? { ...current, selectedIds: ids } : current,
    );
    send({ type: 'selection-change', ids });
  }, []);
  const onUpdateItem = useCallback(
    (id: string, updates: Partial<Omit<TimelineData, 'id'>>) =>
      send({ type: 'update-item', id, updates }),
    [],
  );
  const onBulkUpdateItems = useCallback(
    (ids: string[], updates: Partial<Omit<TimelineData, 'id'>>) =>
      send({ type: 'bulk-update-items', ids, updates }),
    [],
  );
  const onUpdateRow = useCallback(
    (id: string, updates: Pick<TimelineRow, 'name' | 'color'>) =>
      send({ type: 'update-row', id, updates }),
    [],
  );

  if (!snapshot) return null;
  return {
    timeline: snapshot.timeline,
    timelineRows: snapshot.rows,
    maxSec: snapshot.maxSec,
    currentTime: snapshot.currentTime,
    selectedTimelineIdList: snapshot.selectedIds,
    teamNames: snapshot.teamNames,
    videoList: snapshot.videoSources,
    setSelectedTimelineIdList: onSelectionChange,
    deleteTimelineDatas: (ids: string[]): void =>
      send({ type: 'delete-items', ids }),
    updateMemo: (id: string, memo: string): void =>
      send({ type: 'update-memo', id, memo }),
    updateTimelineRange: (
      id: string,
      startTime: number,
      endTime: number,
    ): void => send({ type: 'update-range', id, startTime, endTime }),
    updateTimelineItem: onUpdateItem,
    bulkUpdateTimelineItems: onBulkUpdateItems,
    duplicateTimelineItem: (id: string): string | null => {
      send({ type: 'duplicate-item', id });
      return null;
    },
    addTimelineData: (
      actionName: string,
      startTime: number,
      endTime: number,
      _memo: string,
      _actionType?: string,
      _actionResult?: string,
      _labels?: Array<{ name: string; group: string }>,
      color = '#607d8b',
    ): void =>
      send({ type: 'create-item', actionName, startTime, endTime, color }),
    addTimelineRow: (name?: string, color?: string): void =>
      send({ type: 'add-row', name, color }),
    updateTimelineRow: onUpdateRow,
    moveTimelineRow: (sourceId: string, targetId: string): void =>
      send({ type: 'move-row', sourceId, targetId }),
    deleteTimelineRows: (ids: string[]): void =>
      send({ type: 'delete-rows', ids }),
    pasteTimelineItemsToRow: (
      items: TimelineData[],
      targetRowId: string,
    ): string[] => {
      send({ type: 'paste-items', items, targetRowId });
      return [];
    },
    performUndo: (): void => send({ type: 'undo' }),
    performRedo: (): void => send({ type: 'redo' }),
    handleCurrentTime: (
      _event: React.SyntheticEvent | Event,
      value: number | number[],
    ): void => onSeek(Array.isArray(value) ? value[0] : value),
    onAddToPlaylist: (items: TimelineData[]): void =>
      send({ type: 'add-to-playlist', ids: items.map((item) => item.id) }),
  };
};

export type TimelineWindowController = NonNullable<
  ReturnType<typeof useTimelineWindowController>
>;
