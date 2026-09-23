import { useEffect, useLayoutEffect, useRef } from 'react';
import type { CodingPanelWindowCommand } from '../../../../../types/ipc/codingPanelWindow';
import { subscribeCodingPanelWindowCommand } from '../gateways/codingPanelWindowGateway';

/** Keep IPC connected while the package clock and the active recording change. */
export const useCodingPanelCommands = (
  handler: (command: CodingPanelWindowCommand) => void,
): void => {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  }, [handler]);
  useEffect(
    () =>
      subscribeCodingPanelWindowCommand((command) => latest.current(command)),
    [],
  );
};
