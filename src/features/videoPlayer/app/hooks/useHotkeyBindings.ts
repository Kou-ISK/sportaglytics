import { useMemo, RefObject } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  ActionDefinition,
  HotkeyConfig,
} from '../../../../types/settings/coreTypes';
import type { EnhancedCodePanelHandle } from '../../components/Controls/EnhancedCodePanel';

interface UseHotkeyBindingsParams {
  teamNames: string[];
  settingsHotkeys: HotkeyConfig[];
  activeActions: ActionDefinition[];
  codeWindowButtons?: { id: string; name: string; hotkey?: string }[];
  timelineActionRef: RefObject<EnhancedCodePanelHandle | null>;
  setVideoPlayBackRate: (rate: number) => void;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  setViewMode: Dispatch<SetStateAction<'dual' | 'angle1' | 'angle2'>>;
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
  teamNames,
  settingsHotkeys,
  activeActions,
  codeWindowButtons = [],
  timelineActionRef,
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
}: UseHotkeyBindingsParams) => {
  const hotkeyHandlers = useMemo<Record<string, () => void>>(
    () => ({
      'skip-forward-small': () => {
        stopReversePlayback();
        setVideoPlayBackRate(0.5);
        setIsVideoPlaying(true);
      },
      'skip-forward-medium': () => {
        stopReversePlayback();
        setVideoPlayBackRate(2);
        setIsVideoPlaying(true);
      },
      'skip-forward-large': () => {
        stopReversePlayback();
        setVideoPlayBackRate(4);
        setIsVideoPlaying(true);
      },
      'skip-forward-xlarge': () => {
        stopReversePlayback();
        setVideoPlayBackRate(6);
        setIsVideoPlaying(true);
      },
      'play-pause': () => {
        stopReversePlayback();
        setIsVideoPlaying((playing) => !playing);
      },
      'reverse-playback-slow': () => startReversePlayback(0.5),
      'reverse-playback-2x': () => startReversePlayback(2),
      'reverse-playback-4x': () => startReversePlayback(4),
      'reverse-playback-6x': () => startReversePlayback(6),
      'toggle-angle1': () => {
        setViewMode((prev) => {
          if (prev === 'dual') return 'angle1';
          if (prev === 'angle1') return 'dual';
          if (prev === 'angle2') return 'angle1';
          return 'angle1';
        });
      },
      'toggle-angle2': () => {
        setViewMode((prev) => {
          if (prev === 'dual') return 'angle2';
          if (prev === 'angle2') return 'dual';
          if (prev === 'angle1') return 'angle2';
          return 'angle2';
        });
      },
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
      'skip-forward-small': () => {
        setVideoPlayBackRate(1);
      },
      'skip-forward-medium': () => {
        setVideoPlayBackRate(1);
      },
      'skip-forward-large': () => {
        setVideoPlayBackRate(1);
      },
      'skip-forward-xlarge': () => {
        setVideoPlayBackRate(1);
      },
      'reverse-playback-slow': stopReversePlayback,
      'reverse-playback-2x': stopReversePlayback,
      'reverse-playback-4x': stopReversePlayback,
      'reverse-playback-6x': stopReversePlayback,
    }),
    [setVideoPlayBackRate, stopReversePlayback],
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
