import { useEffect, useRef } from 'react';
import type { HotkeyConfig } from '../../../../../types/settings/coreTypes';
import {
  findMatchingHotkey,
  sortHotkeysBySpecificity,
} from '../../../../../hooks/globalHotkeyUtils';
import { angleIndexForHotkey } from '../../../../../shared/media/angleView';
import type { AngleSyncCommand } from '../../../../../types/ipc/angleSync';

/** Identical capture-phase shortcuts in the video and detached timeline windows. */
export const useAngleSyncHotkeys = (
  enabled: boolean,
  send: (command: AngleSyncCommand) => void,
  hotkeys: HotkeyConfig[],
): void => {
  const current = useRef({ send, hotkeys });
  current.current = { send, hotkeys };
  useEffect(() => {
    if (!enabled) return;
    const key = (event: KeyboardEvent): void => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest(
          'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="menu"]',
        )
      )
        return;
      let command: AngleSyncCommand | undefined;
      const binding = findMatchingHotkey(
        event,
        sortHotkeysBySpecificity(current.current.hotkeys),
      );
      const index = binding ? angleIndexForHotkey(binding.id) : null;
      if (index !== null) command = { action: 'select', index };
      else if (event.metaKey || event.ctrlKey || event.altKey) return;
      else if (event.key === 'Escape') command = { action: 'cancel' };
      else if (event.key.toLowerCase() === 's') command = { action: 'mark' };
      else if (event.key === ' ') {
        if (
          event.target instanceof HTMLElement &&
          event.target.closest('button')
        )
          return;
        command = { action: 'toggle' };
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const direction = event.key === 'ArrowLeft' ? -1 : 1;
        command = event.shiftKey
          ? { action: 'skip', seconds: direction }
          : { action: 'step', direction };
      }
      if (!command) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (
        !event.repeat ||
        command.action === 'step' ||
        command.action === 'skip'
      )
        current.current.send(command);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [enabled]);
};
