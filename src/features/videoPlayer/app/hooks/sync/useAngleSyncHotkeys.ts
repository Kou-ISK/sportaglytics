import { useEffect, useRef } from 'react';
import type { AngleSyncCommand } from '../../../../../types/ipc/angleSync';

/** Identical capture-phase shortcuts in the video and detached timeline windows. */
export const useAngleSyncHotkeys = (
  enabled: boolean,
  send: (command: AngleSyncCommand) => void,
): void => {
  const current = useRef(send);
  current.current = send;
  useEffect(() => {
    if (!enabled) return;
    const key = (event: KeyboardEvent): void => {
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"], [role="combobox"], [role="menu"]',
          ))
      )
        return;
      let command: AngleSyncCommand | undefined;
      if (/^[1-8]$/.test(event.key))
        command = { action: 'select', index: Number(event.key) - 1 };
      else if (event.key === '0') command = { action: 'select', index: null };
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
        current.current(command);
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [enabled]);
};
