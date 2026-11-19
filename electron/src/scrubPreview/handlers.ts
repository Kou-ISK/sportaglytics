import { scrubIdleSignal } from './exportPriority';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { getValidatedEventSenderWindow } from '../ipc/windowSenderGuards';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import { resolveNativeSource } from '../nativePlayback/nativeSourceAccess';
import type { NativeSourceAccess } from '../nativePlayback/nativeSourceAccess';
import {
  scrubPreviewChannels as channels,
  scrubRequest,
  scrubToken,
} from '../../../src/types/ipc/scrubPreview';
import type { ScrubPreviewStrip } from '../../../src/types/ipc/scrubPreview';
import { produceScrubPreview } from './produce';

interface Lease {
  window: BrowserWindow;
  packagePath: string;
  token: string;
  abort: AbortController;
  source?: NativeSourceAccess;
  producing: boolean;
  release: () => void;
}
let active: Lease | null = null;
const packageOf = (window: BrowserWindow): string | null => {
  const session = getPackageSessionForWindow(window);
  return session?.mainWindow === window && session.packageBound
    ? session.packagePath
    : null;
};
const authorized = (event: IpcMainInvokeEvent): BrowserWindow => {
  const window = getValidatedEventSenderWindow(event);
  if (!window) throw Error('SCRUB_UNAUTHORIZED');
  return window;
};
const current = async (lease: Lease): Promise<boolean> => {
  if (
    active !== lease ||
    lease.abort.signal.aborted ||
    packageOf(lease.window) !== lease.packagePath ||
    !lease.source
  )
    return false;
  await lease.source.assertCurrent();
  return (
    active === lease &&
    !lease.abort.signal.aborted &&
    packageOf(lease.window) === lease.packagePath
  );
};
export const registerScrubPreviewHandlers = (): void => {
  ipcMain.handle(
    channels.prepare,
    async (event, raw: unknown): Promise<ScrubPreviewStrip | null> => {
      const window = authorized(event),
        location = packageOf(window),
        request = scrubRequest(raw);
      if (
        process.platform !== 'darwin' ||
        !location ||
        active ||
        scrubIdleSignal().aborted
      )
        return null;
      const contents = window.webContents,
        abort = new AbortController();
      const detach = (): void => {
        contents.removeListener('did-start-navigation', release);
        contents.removeListener('render-process-gone', release);
        contents.removeListener('destroyed', release);
        if (active === lease) active = null;
      };
      const release = (): void => {
        abort.abort();
        if (!lease.producing) detach();
      };
      const lease: Lease = {
        window,
        packagePath: location,
        token: request.token,
        abort,
        producing: true,
        release,
      };
      active = lease;
      contents.once('destroyed', release);
      contents.once('render-process-gone', release);
      contents.once('did-start-navigation', release);
      try {
        lease.source = await resolveNativeSource(location);
        if (!(await current(lease))) throw Error('SCRUB_EXPIRED');
        const strip = await produceScrubPreview(
          lease.source,
          request.time,
          AbortSignal.any([abort.signal, scrubIdleSignal()]),
        );
        if (!(await current(lease))) throw Error('SCRUB_EXPIRED');
        return strip;
      } catch {
        abort.abort();
        return null;
      } finally {
        lease.producing = false;
        if (abort.signal.aborted) detach();
      }
    },
  );
  ipcMain.handle(
    channels.validate,
    async (event, raw: unknown): Promise<boolean> => {
      const window = authorized(event),
        token = scrubToken(raw),
        lease = active;
      if (!lease || lease.window !== window || lease.token !== token)
        return false;
      try {
        if (await current(lease)) return true;
      } catch {
        /* original is authoritative */
      }
      lease.release();
      return false;
    },
  );
  ipcMain.handle(channels.release, (event, raw: unknown): void => {
    const window = authorized(event),
      token = scrubToken(raw);
    if (active?.window === window && active.token === token) active.release();
  });
};
