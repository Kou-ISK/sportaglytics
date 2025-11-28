import { useMemo, RefObject } from 'react';
import type { HotkeyConfig } from '../../../types/Settings';
import type { ActionDefinition } from '../../../types/Settings';
import type { TimelineActionSectionHandle } from '../components/TimelineActionSection';

interface UseHotkeyBindingsParams {
  currentTime: number;
  isVideoPlaying: boolean;
  teamNames: string[];
  settingsHotkeys: HotkeyConfig[];
  activeActions: ActionDefinition[];
  timelineActionRef: RefObject<TimelineActionSectionHandle>;
  setVideoPlayBackRate: (rate: number) => void;
  setIsVideoPlaying: (value: boolean) => void;
  handleCurrentTime: (event: Event, time: number) => void;
  performUndo: () => void;
  performRedo: () => void;
  resyncAudio: () => void;
  resetSync: () => void;
  manualSyncFromPlayers: () => void;
  setSyncMode: (update: (prev: 'auto' | 'manual') => 'auto' | 'manual') => void;
  onAnalyze: () => void;
}

export const useHotkeyBindings = ({
  currentTime,
  isVideoPlaying,
  teamNames,
  settingsHotkeys,
  activeActions,
  timelineActionRef,
  setVideoPlayBackRate,
  setIsVideoPlaying,
  handleCurrentTime,
  performUndo,
  performRedo,
  resyncAudio,
  resetSync,
  manualSyncFromPlayers,
  setSyncMode,
  onAnalyze,
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
      analyze: onAnalyze,
      undo: performUndo,
      redo: performRedo,
      'resync-audio': () => void resyncAudio(),
      'reset-sync': resetSync,
      'manual-sync': () => void manualSyncFromPlayers(),
      'toggle-manual-mode': () =>
        setSyncMode((prev) => (prev === 'auto' ? 'manual' : 'auto')),
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
      setSyncMode,
      setVideoPlayBackRate,
      onAnalyze,
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

  const combinedHotkeys = useMemo(
    () => [...settingsHotkeys, ...actionHotkeys],
    [settingsHotkeys, actionHotkeys],
  );

  const combinedHandlers = useMemo(
    () => ({ ...hotkeyHandlers, ...actionHandlers }),
    [hotkeyHandlers, actionHandlers],
  );

  return { combinedHotkeys, combinedHandlers, keyUpHandlers };
};
