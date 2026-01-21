import { useMemo, RefObject } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { HotkeyConfig } from '../../../types/Settings';
import type { ActionDefinition } from '../../../types/Settings';
import type { TimelineActionSectionHandle } from '../components/TimelineActionSection';

interface UseHotkeyBindingsParams {
  currentTime: number;
  isVideoPlaying: boolean;
  teamNames: string[];
  settingsHotkeys: HotkeyConfig[];
  activeActions: ActionDefinition[];
  codeWindowButtons?: { id: string; name: string; hotkey?: string }[];
  timelineActionRef: RefObject<TimelineActionSectionHandle | null>;
  setVideoPlayBackRate: (rate: number) => void;
  setIsVideoPlaying: (value: boolean) => void;
  setViewMode: Dispatch<SetStateAction<'dual' | 'angle1' | 'angle2'>>;
  handleCurrentTime: (event: Event, time: number) => void;
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
  currentTime,
  isVideoPlaying,
  teamNames,
  settingsHotkeys,
  activeActions,
  codeWindowButtons = [],
  timelineActionRef,
  setVideoPlayBackRate,
  setIsVideoPlaying,
  setViewMode,
  handleCurrentTime,
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
  const hotkeyHandlers = useMemo(
    () => ({
      'skip-forward-small': () => {
        setVideoPlayBackRate(0.5);
        setIsVideoPlaying(true);
      },
      'skip-forward-medium': () => {
        setVideoPlayBackRate(2);
        setIsVideoPlaying(true);
      },
      'skip-forward-large': () => {
        setVideoPlayBackRate(4);
        setIsVideoPlaying(true);
      },
      'skip-forward-xlarge': () => {
        setVideoPlayBackRate(6);
        setIsVideoPlaying(true);
      },
      'play-pause': () => {
        setIsVideoPlaying(!isVideoPlaying);
      },
      'skip-backward-medium': () => {
        handleCurrentTime(new Event('hotkey'), currentTime - 5);
      },
      'skip-backward-large': () => {
        handleCurrentTime(new Event('hotkey'), currentTime - 10);
      },
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
      currentTime,
      handleCurrentTime,
      isVideoPlaying,
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
      selectedTimelineIdList,
      deleteTimelineDatas,
      clearSelection,
    ],
  );

  const keyUpHandlers = useMemo(
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
    }),
    [setVideoPlayBackRate],
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
    const teamContext =
      teamNames.length >= 2
        ? { team1Name: teamNames[0], team2Name: teamNames[1] }
        : {
            team1Name: teamNames[0] || 'Team1',
            team2Name: teamNames[1] || 'Team2',
          };

    const replacePlaceholder = (name: string) =>
      name
        .replace(/\$\{Team1\}/g, teamContext.team1Name)
        .replace(/\$\{Team2\}/g, teamContext.team2Name);

    for (const btn of codeWindowButtons) {
      if (!btn.hotkey) continue;
      const actionName = replacePlaceholder(btn.name);
      handlers[`codewindow-${btn.id}`] = () => {
        // ボタン名がチーム名プレフィックスを含むためそのままトリガー
        const team = teamNames.find((t) => actionName.startsWith(`${t} `));
        const resolvedTeam = team || teamNames[0] || '';
        timelineActionRef.current?.triggerAction(resolvedTeam, actionName);
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
