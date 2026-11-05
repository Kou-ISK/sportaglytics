import { useMemo } from 'react';
import type { HotkeyConfig } from '../../../../types/settings/coreTypes';
import { angleIndexForHotkey } from '../../../../shared/media/angleView';
import { useGlobalHotkeys } from '../../../../hooks/useGlobalHotkeys';
import { useNativeCommandLeft } from './useNativeCommandLeft';

export const useWorkspaceHotkeys = (
  syncMode: 'auto' | 'manual',
  combinedHotkeys: HotkeyConfig[],
  handlers: Record<string, () => void>,
  keyUpHandlers: Record<string, () => void>,
  onControls: (playing: boolean, rate: number) => void,
  onFailure: () => void,
): HotkeyConfig[] => {
  const hotkeys = useMemo(() => syncMode === 'manual'
    ? combinedHotkeys.filter((hotkey) => ['manual-sync', 'toggle-manual-mode'].includes(hotkey.id) || angleIndexForHotkey(hotkey.id) !== null)
    : combinedHotkeys, [combinedHotkeys, syncMode]);
  useNativeCommandLeft(hotkeys, onControls, onFailure);
  useGlobalHotkeys(hotkeys, handlers, keyUpHandlers);
  return hotkeys;
};
