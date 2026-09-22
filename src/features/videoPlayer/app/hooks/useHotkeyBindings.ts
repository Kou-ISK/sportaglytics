import { useHeldPlayback } from '../../../../shared/hooks/useHeldPlayback';
import { ANGLE_VIEW_MODES } from '../../../../shared/media/angleView';
import type { VideoViewMode } from '../../../../shared/media/angleView';
import { useMemo } from 'react';
import type { Dispatch, SetStateAction, RefObject } from 'react';
import type {
  ActionDefinition,
  HotkeyConfig,
} from '../../../../types/settings/coreTypes';
import type { EnhancedCodePanelHandle } from '../../components/Controls/EnhancedCodePanel';

interface UseHotkeyBindingsParams {
  onGoLive?: () => void;
  teamNames: string[];
  settingsHotkeys: HotkeyConfig[];
  activeActions: ActionDefinition[];
  codeWindowButtons?: { id: string; name: string; hotkey?: string }[];
  timelineActionRef: RefObject<EnhancedCodePanelHandle | null>;
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  setVideoPlayBackRate: (rate: number) => void;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  setViewMode: Dispatch<SetStateAction<VideoViewMode>>;
  startReversePlayback: (rate: 0.5 | 2 | 4 | 6) => void;
  stopReversePlayback: () => void;
  performUndo: () => void;
  performRedo: () => void;
  resyncAudio: () => void;
  resetSync: () => void;
  manualSyncFromPlayers: () => void;
  setSyncMode: (update: (prev: 'auto' | 'manual') => 'auto' | 'manual') => void;
  onAnalyze: () => void;
  // タイムライン削除用
  selectedTimelineIdList?: string[];
  deleteTimelineDatas?: (idList: string[]) => void;
  clearSelection?: () => void;
}

export const useHotkeyBindings = ({
  onGoLive,
  teamNames,
  settingsHotkeys,
  activeActions,
  codeWindowButtons = [],
  timelineActionRef,
  isVideoPlaying,
  videoPlayBackRate,
  setVideoPlayBackRate,
  setIsVideoPlaying,
  setViewMode,
  startReversePlayback,
  stopReversePlayback,
  performUndo,
  performRedo,
  resyncAudio,
  resetSync,
  manualSyncFromPlayers,
  setSyncMode,
  onAnalyze,
  selectedTimelineIdList,
  deleteTimelineDatas,
  clearSelection,
}: UseHotkeyBindingsParams): {
  combinedHotkeys: HotkeyConfig[];
  combinedHandlers: Record<string, () => void>;
  keyUpHandlers: Record<string, () => void>;
} => {
  const { start, stop, cancel } = useHeldPlayback(
    () => ({ playing: isVideoPlaying, rate: videoPlayBackRate }),
    ({ playing, rate }) => {
      setVideoPlayBackRate(rate);
      setIsVideoPlaying(playing);
    },
  );
  const hotkeyHandlers = useMemo<Record<string, () => void>>(
    () => ({
      'go-live': () => onGoLive?.(),
      'skip-forward-small': () => {
        stopReversePlayback();
        start('skip-forward-small', 0.5);
      },
      'skip-forward-medium': () => {
        stopReversePlayback();
        start('skip-forward-medium', 2);
      },
      'skip-forward-large': () => {
        stopReversePlayback();
        start('skip-forward-large', 4);
      },
      'skip-forward-xlarge': () => {
        stopReversePlayback();
        start('skip-forward-xlarge', 6);
      },
      'play-pause': () => {
        cancel();
        stopReversePlayback();
        setIsVideoPlaying((playing) => !playing);
      },
      'reverse-playback-slow': () => {
        cancel();
        startReversePlayback(0.5);
      },
      'reverse-playback-2x': () => {
        cancel();
        startReversePlayback(2);
      },
      'reverse-playback-4x': () => {
        cancel();
        startReversePlayback(4);
      },
      'reverse-playback-6x': () => {
        cancel();
        startReversePlayback(6);
      },
      ...Object.fromEntries(
        ANGLE_VIEW_MODES.map((mode) => [
          `toggle-${mode}`,
          () => setViewMode((previous) => (previous === mode ? 'dual' : mode)),
        ]),
      ),
      analyze: onAnalyze,
      undo: performUndo,
      redo: performRedo,
      'resync-audio': () => void resyncAudio(),
      'reset-sync': resetSync,
      'manual-sync': () => void manualSyncFromPlayers(),
      'toggle-manual-mode': () =>
        setSyncMode((prev) => (prev === 'auto' ? 'manual' : 'auto')),
      // タイムライン削除
      'delete-selected': () => {
        if (
          selectedTimelineIdList &&
          selectedTimelineIdList.length > 0 &&
          deleteTimelineDatas
        ) {
          deleteTimelineDatas(selectedTimelineIdList);
          clearSelection?.();
        }
      },
    }),
    [
      onGoLive,
      start,
      cancel,
      manualSyncFromPlayers,
      performRedo,
      performUndo,
      resetSync,
      resyncAudio,
      setIsVideoPlaying,
      setViewMode,
      setSyncMode,
      setVideoPlayBackRate,
      onAnalyze,
      startReversePlayback,
      stopReversePlayback,
      selectedTimelineIdList,
      deleteTimelineDatas,
      clearSelection,
    ],
  );

  const keyUpHandlers = useMemo<Record<string, () => void>>(
    () => ({
      'skip-forward-small': () => stop('skip-forward-small'),
      'skip-forward-medium': () => stop('skip-forward-medium'),
      'skip-forward-large': () => stop('skip-forward-large'),
      'skip-forward-xlarge': () => stop('skip-forward-xlarge'),
      'reverse-playback-slow': stopReversePlayback,
      'reverse-playback-2x': stopReversePlayback,
      'reverse-playback-4x': stopReversePlayback,
      'reverse-playback-6x': stopReversePlayback,
    }),
    [stop, stopReversePlayback],
  );

  const actionHotkeys = useMemo(() => {
    const hotkeys: HotkeyConfig[] = [];

    for (const action of activeActions) {
      if (action.hotkey) {
        if (teamNames[0]) {
          hotkeys.push({
            id: `action-${teamNames[0]}-${action.action}`,
            label: `${teamNames[0]} - ${action.action}`,
            key: action.hotkey,
          });
        }

        if (teamNames[1]) {
          hotkeys.push({
            id: `action-${teamNames[1]}-${action.action}`,
            label: `${teamNames[1]} - ${action.action}`,
            key: `Shift+${action.hotkey}`,
          });
        }
      }
    }

    return hotkeys;
  }, [teamNames, activeActions]);

  // コードウィンドウボタンのホットキー（アクティブレイアウトのみ）
  const codeWindowHotkeys = useMemo(() => {
    const hotkeys: HotkeyConfig[] = [];
    for (const btn of codeWindowButtons) {
      if (!btn.hotkey) continue;
      hotkeys.push({
        id: `codewindow-${btn.id}`,
        label: btn.name,
        key: btn.hotkey,
      });
    }
    return hotkeys;
  }, [codeWindowButtons]);

  const actionHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};

    for (const action of activeActions) {
      if (action.hotkey) {
        const actionName = action.action;

        if (teamNames[0]) {
          const id = `action-${teamNames[0]}-${actionName}`;
          const teamName = teamNames[0];
          handlers[id] = () => {
            timelineActionRef.current?.triggerAction(teamName, actionName);
          };
        }

        if (teamNames[1]) {
          const id = `action-${teamNames[1]}-${actionName}`;
          const teamName = teamNames[1];
          handlers[id] = () => {
            timelineActionRef.current?.triggerAction(teamName, actionName);
          };
        }
      }
    }

    return handlers;
  }, [teamNames, activeActions, timelineActionRef]);

  // コードウィンドウボタンのハンドラ
  const codeWindowHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};
    const replacePlaceholder = (name: string) =>
      name
        .replace(/\$\{Team1\}/g, teamNames[0] || '${Team1}')
        .replace(/\$\{Team2\}/g, teamNames[1] || '${Team2}')
        .replace(/^Team1\s+/, teamNames[0] ? `${teamNames[0]} ` : 'Team1 ')
        .replace(/^Team2\s+/, teamNames[1] ? `${teamNames[1]} ` : 'Team2 ');

    for (const btn of codeWindowButtons) {
      if (!btn.hotkey) continue;
      const actionName = replacePlaceholder(btn.name);
      if (/\$\{Team[12]\}/.test(actionName)) continue;
      handlers[`codewindow-${btn.id}`] = () => {
        // ボタン名がチーム名プレフィックスを含むためそのままトリガー
        const team = teamNames.find((t) => actionName.startsWith(`${t} `));
        const resolvedTeam = team || teamNames[0] || '';
        timelineActionRef.current?.triggerAction(
          resolvedTeam,
          actionName,
          btn.id,
        );
      };
    }
    return handlers;
  }, [codeWindowButtons, teamNames, timelineActionRef]);

  const combinedHotkeys = useMemo(
    () => [...settingsHotkeys, ...actionHotkeys, ...codeWindowHotkeys],
    [settingsHotkeys, actionHotkeys, codeWindowHotkeys],
  );

  const combinedHandlers = useMemo(
    () => ({ ...hotkeyHandlers, ...actionHandlers, ...codeWindowHandlers }),
    [hotkeyHandlers, actionHandlers, codeWindowHandlers],
  );

  return { combinedHotkeys, combinedHandlers, keyUpHandlers };
};
