/** The desktop handshake is optional in browser previews and isolated hooks. */
export const registerTimelineCloseHandler = (
  flush: () => Promise<boolean>,
  resume: () => void,
): (() => void) =>
  globalThis.window.electronAPI?.timelinePersistence?.registerCloseHandler(
    flush,
    resume,
  ) ?? (() => undefined);
