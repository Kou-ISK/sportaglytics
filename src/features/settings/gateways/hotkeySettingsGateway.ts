export const notifyHotkeysUpdated = (): void => {
  try {
    globalThis.window.electronAPI?.notifyHotkeysUpdated?.();
  } catch (error: unknown) {
    console.debug('[hotkeySettingsGateway] notify failed', error);
  }
};
