import type { IElectronAPI } from '../../../src/renderer';

interface PackageOpenTransport {
  on: (
    channel: 'open-package-directory',
    listener: (event: unknown, path: unknown) => void,
  ) => unknown;
}

/** One package session per window; retain its latest open until React subscribes. */
export const createPackageOpenBridge = (
  transport: PackageOpenTransport,
): Pick<IElectronAPI, 'onPackageDirectoryOpen'> => {
  let pending: string | null = null;
  let owner: { callback: (path: string) => void } | null = null;
  const deliver = (): void => {
    if (!owner || pending === null) return;
    const path = pending;
    pending = null;
    owner.callback(path);
  };

  // This listener belongs to the preload context, not a React effect. Main can
  // send immediately after did-finish-load, before React mounts its receiver.
  transport.on('open-package-directory', (_event, path) => {
    if (
      typeof path !== 'string' ||
      !path.trim() ||
      path.length > 32768 ||
      path.includes('\0')
    )
      return;
    pending = path;
    deliver();
  });

  return {
    onPackageDirectoryOpen: (callback) => {
      const subscription = { callback };
      owner = subscription;
      // StrictMode can replace the subscriber before the microtask runs. Read
      // the current owner so the pending request is delivered once to that owner.
      queueMicrotask(deliver);
      return () => {
        if (owner === subscription) owner = null;
      };
    },
  };
};
