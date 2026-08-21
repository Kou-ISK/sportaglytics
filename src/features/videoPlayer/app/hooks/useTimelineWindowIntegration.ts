import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { HotkeyConfig } from '../../../../types/settings/coreTypes';
import type { TimelineData, TimelineRow } from '../../../../types/timeline/core';
import type { TimelineWindowCommand } from '../../../../types/ipc/timelineWindow';
import { buildTimelineRowSortMoves } from '../../shared/timelineRowSort';
import {
  closeTimelineWindow,
  openTimelineWindow,
  subscribeTimelineWindowCommand,
  syncTimelineWindow,
  syncTimelineWindowClock,
} from '../gateways/timelineWindowGateway';

interface UseTimelineWindowIntegrationParams {
  isFileSelected: boolean;
  timeline: TimelineData[];
  rows: TimelineRow[];
  maxSec: number;
  currentTime: number;
  isPlaying: boolean;
  playbackRate: number;
  selectedIds: string[];
  teamNames: string[];
  videoSources: string[];
  hotkeys: HotkeyConfig[];
  hotkeyHandlers: Record<string, () => void>;
  hotkeyKeyUpHandlers: Record<string, () => void>;
  onSeek: (time: number) => void;
  onSelectionChange: (ids: string[]) => void;
  onDeleteItems: (ids: string[]) => void;
  onUpdateMemo: (id: string, memo: string) => void;
  onUpdateRange: (id: string, startTime: number, endTime: number) => void;
  onUpdateItem: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  onBulkUpdateItems: (
    ids: string[],
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  onDuplicateItem: (id: string) => string | null;
  onCreateItem: (
    actionName: string,
    startTime: number,
    endTime: number,
    color: string,
  ) => void;
  onAddRow: (name?: string, color?: string) => void;
  onUpdateRow: (
    id: string,
    updates: Pick<TimelineRow, 'name' | 'color'>,
  ) => void;
  onMoveRow: (sourceId: string, targetId: string) => void;
  onDeleteRows: (ids: string[]) => void;
  onPasteItems: (items: TimelineData[], targetRowId: string) => string[];
  onUndo: () => void;
  onRedo: () => void;
  onAddToPlaylist: (items: TimelineData[]) => void;
}

export const useTimelineWindowIntegration = (
  params: UseTimelineWindowIntegrationParams,
): { open: () => Promise<void> } => {
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const payload = useMemo(
    () => ({
      timeline: params.timeline,
      rows: params.rows,
      maxSec: params.maxSec,
      currentTime: params.currentTime,
      isPlaying: params.isPlaying,
      playbackRate: params.playbackRate,
      selectedIds: params.selectedIds,
      teamNames: params.teamNames,
      videoSources: params.videoSources,
      hotkeys: params.hotkeys,
      updatedAt: Date.now(),
    }),
    [
      params.currentTime,
      params.hotkeys,
      params.isPlaying,
      params.maxSec,
      params.playbackRate,
      params.rows,
      params.selectedIds,
      params.teamNames,
      params.timeline,
      params.videoSources,
    ],
  );
  const payloadRef = useRef(payload);
  payloadRef.current = payload;
  const lastClockSyncAtRef = useRef(0);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncLatest = useCallback((): void => {
    if (!paramsRef.current.isFileSelected) return;
    syncTimelineWindow(payloadRef.current);
  }, []);

  const syncLatestClock = useCallback((): void => {
    const current = paramsRef.current;
    if (!current.isFileSelected) return;
    syncTimelineWindowClock({
      currentTime: current.currentTime,
      isPlaying: current.isPlaying,
      playbackRate: current.playbackRate,
      updatedAt: Date.now(),
    });
    lastClockSyncAtRef.current = Date.now();
  }, []);

  const open = useCallback(async (): Promise<void> => {
    await openTimelineWindow();
    syncLatest();
  }, [syncLatest]);

  useEffect(() => {
    if (params.isFileSelected) {
      void open();
      return;
    }
    void closeTimelineWindow();
  }, [open, params.isFileSelected]);

  useEffect(() => {
    syncLatest();
  }, [
    params.hotkeys,
    params.isFileSelected,
    params.isPlaying,
    params.maxSec,
    params.playbackRate,
    params.rows,
    params.selectedIds,
    params.teamNames,
    params.timeline,
    params.videoSources,
    syncLatest,
  ]);

  useEffect(() => {
    if (!params.isFileSelected) return;
    const remaining = Math.max(
      0,
      80 - (Date.now() - lastClockSyncAtRef.current),
    );
    if (remaining === 0) {
      syncLatestClock();
      return;
    }
    if (syncTimerRef.current === null) {
      syncTimerRef.current = setTimeout(() => {
        syncTimerRef.current = null;
        syncLatestClock();
      }, remaining);
    }
  }, [params.currentTime, params.isFileSelected, syncLatestClock]);

  useEffect(
    () => () => {
      if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current);
    },
    [],
  );

  useEffect(
    () =>
      subscribeTimelineWindowCommand((command: TimelineWindowCommand) => {
        const current = paramsRef.current;
        switch (command.type) {
          case 'request-sync':
            syncTimelineWindow(payloadRef.current);
            break;
          case 'seek':
            current.onSeek(command.time);
            break;
          case 'selection-change':
            current.onSelectionChange(command.ids);
            break;
          case 'delete-items':
            current.onDeleteItems(command.ids);
            break;
          case 'update-memo':
            current.onUpdateMemo(command.id, command.memo);
            break;
          case 'update-range':
            current.onUpdateRange(
              command.id,
              command.startTime,
              command.endTime,
            );
            break;
          case 'update-item':
            current.onUpdateItem(command.id, command.updates);
            break;
          case 'bulk-update-items':
            current.onBulkUpdateItems(command.ids, command.updates);
            break;
          case 'duplicate-item': {
            const id = current.onDuplicateItem(command.id);
            if (id) current.onSelectionChange([id]);
            break;
          }
          case 'create-item':
            current.onCreateItem(
              command.actionName,
              command.startTime,
              command.endTime,
              command.color,
            );
            break;
          case 'add-row':
            current.onAddRow(command.name, command.color);
            break;
          case 'update-row':
            current.onUpdateRow(command.id, command.updates);
            break;
          case 'move-row':
            current.onMoveRow(command.sourceId, command.targetId);
            break;
          case 'sort-rows':
            buildTimelineRowSortMoves(
              current.rows,
              current.timeline,
              command.spec,
            ).forEach((move) => current.onMoveRow(move.sourceId, move.targetId));
            break;
          case 'delete-rows':
            current.onDeleteRows(command.ids);
            break;
          case 'paste-items': {
            const ids = current.onPasteItems(
              command.items,
              command.targetRowId,
            );
            current.onSelectionChange(ids);
            break;
          }
          case 'undo':
            current.onUndo();
            break;
          case 'redo':
            current.onRedo();
            break;
          case 'add-to-playlist':
            current.onAddToPlaylist(
              command.ids
                .map((id) => current.timeline.find((item) => item.id === id))
                .filter((item): item is TimelineData => item !== undefined),
            );
            break;
          case 'hotkey-key-down':
            current.hotkeyHandlers[command.hotkeyId]?.();
            break;
          case 'hotkey-key-up':
            current.hotkeyKeyUpHandlers[command.hotkeyId]?.();
            break;
        }
      }),
    [],
  );

  return { open };
};
