interface PackageOpenWindow {
  isDestroyed: () => boolean;
  readonly webContents: {
    isDestroyed: () => boolean;
    isLoading: () => boolean;
    once: (event: 'did-stop-loading', listener: () => void) => unknown;
    send: (channel: 'open-package-directory', filePath: string) => void;
  };
}

/** Deliver to a loaded preload, including the interval after did-finish-load. */
export const sendPackageOpenWhenReady = (
  window: PackageOpenWindow,
  filePath: string,
): void => {
  if (window.isDestroyed()) return;
  const contents = window.webContents;
  if (contents.isDestroyed()) return;
  const send = (): void => {
    if (!window.isDestroyed() && !contents.isDestroyed()) {
      contents.send('open-package-directory', filePath);
    }
  };
  // isLoading remains true at did-finish-load and even when loadURL resolves.
  // Its corresponding completion event is did-stop-loading; waiting for another
  // did-finish-load here can leave an OS package-open request pending forever.
  if (contents.isLoading()) contents.once('did-stop-loading', send);
  else send();
};
