const noop = (): void => undefined;

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const subscribeLabelModeToggle = (
  callback: (checked: boolean) => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onToggleLabelMode) {
    return noop;
  }

  try {
    return api.onToggleLabelMode(callback);
  } catch (error: unknown) {
    console.debug('[labelModeGateway] onToggleLabelMode failed', error);
    return noop;
  }
};

export const setLabelModeChecked = async (
  checked: boolean,
): Promise<boolean> => {
  const api = getElectronApi();
  if (!api?.setLabelModeChecked) {
    return false;
  }

  try {
    return await api.setLabelModeChecked(checked);
  } catch (error: unknown) {
    console.debug('[labelModeGateway] setLabelModeChecked failed', error);
    return false;
  }
};
