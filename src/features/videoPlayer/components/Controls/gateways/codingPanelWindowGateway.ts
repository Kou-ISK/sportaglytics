import type {
  CodingPanelWindowCommand,
  CodingPanelWindowSyncPayload,
} from '../../../../../types/ipc/codingPanelWindow';

const getCodingPanelWindowApi = () =>
  globalThis.window.electronAPI?.codingPanelWindow;
const noop = (): void => undefined;

export const openCodingPanelWindow = async (): Promise<boolean> => {
  const api = getCodingPanelWindowApi();
  if (!api?.openWindow) {
    return false;
  }

  try {
    await api.openWindow();
    return true;
  } catch (error: unknown) {
    console.debug('[CodingPanelWindowGateway] openWindow failed', error);
    return false;
  }
};

export const syncCodingPanelWindow = (
  payload: CodingPanelWindowSyncPayload,
): void => {
  const api = getCodingPanelWindowApi();
  if (!api?.syncToWindow) {
    return;
  }

  try {
    api.syncToWindow(payload);
  } catch (error: unknown) {
    console.debug('[CodingPanelWindowGateway] syncToWindow failed', error);
  }
};

export const sendCodingPanelWindowCommand = (
  command: CodingPanelWindowCommand,
): void => {
  const api = getCodingPanelWindowApi();
  if (!api?.sendCommand) {
    return;
  }

  try {
    api.sendCommand(command);
  } catch (error: unknown) {
    console.debug('[CodingPanelWindowGateway] sendCommand failed', error);
  }
};

export const subscribeCodingPanelWindowCommand = (
  callback: (command: CodingPanelWindowCommand) => void,
): (() => void) => {
  const api = getCodingPanelWindowApi();
  if (!api?.onCommand || !api?.offCommand) {
    return noop;
  }

  try {
    api.onCommand(callback);
    return () => {
      try {
        api.offCommand(callback);
      } catch (error: unknown) {
        console.debug('[CodingPanelWindowGateway] offCommand failed', error);
      }
    };
  } catch (error: unknown) {
    console.debug('[CodingPanelWindowGateway] onCommand failed', error);
    return noop;
  }
};

export const subscribeCodingPanelWindowSync = (
  callback: (payload: CodingPanelWindowSyncPayload) => void,
): (() => void) => {
  const api = getCodingPanelWindowApi();
  if (!api?.onSync || !api?.offSync) {
    return noop;
  }

  try {
    api.onSync(callback);
    return () => {
      try {
        api.offSync(callback);
      } catch (error: unknown) {
        console.debug('[CodingPanelWindowGateway] offSync failed', error);
      }
    };
  } catch (error: unknown) {
    console.debug('[CodingPanelWindowGateway] onSync failed', error);
    return noop;
  }
};
