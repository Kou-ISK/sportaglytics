import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { booleanValue, exactKeys, integerValue, objectValue } from '../../../src/shared/validation/jsonValues';
import { nativeCommandLeftChannels as channels } from '../../../src/types/ipc/nativeCommandLeft';
import { parseNativePlaybackIntent } from '../../../src/types/ipc/nativePlayback';
import { getValidatedEventSenderWindow } from '../ipc/windowSenderGuards';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import type { MainCommandInput } from './commandLeftMain';

const sender = (event: IpcMainInvokeEvent | IpcMainEvent): BrowserWindow => {
  const window = getValidatedEventSenderWindow(event);
  const session = window && getPackageSessionForWindow(window);
  if (!window || !session?.packageBound || session.mainWindow !== window)
    throw Error('NATIVE_UNAUTHORIZED');
  return window;
};
const gesture = (raw: unknown): { gesture: number; epoch: number } => {
  const value = objectValue(raw);
  exactKeys(value, ['gesture', 'epoch']);
  return { gesture: integerValue(value.gesture, 1), epoch: integerValue(value.epoch, 1) };
};
/** Invoke only after the signed Main-only monitor has started successfully. */
export const registerCommandLeftIpc = (source: MainCommandInput | Promise<MainCommandInput | null>): void => {
  const target = async (event: IpcMainInvokeEvent | IpcMainEvent): Promise<{ window: BrowserWindow; main: MainCommandInput | null }> => {
    const window = sender(event); const main = await source;
    if (sender(event) !== window) throw Error('NATIVE_UNAUTHORIZED');
    return { window, main };
  };
  ipcMain.handle(channels.ready, async (event) => { const { window, main } = await target(event); return main?.arm(window) ?? null; });
  ipcMain.handle(channels.claim, async (event, raw: unknown) => {
    sender(event); const value = gesture(raw); const { window, main } = await target(event);
    if (!main) return 'invalid';
    return main.claim(window, value.gesture, value.epoch);
  });
  ipcMain.handle(channels.apply, async (event, raw: unknown) => {
    sender(event); const value = objectValue(raw);
    exactKeys(value, ['gesture', 'epoch', 'intent']);
    const { window, main } = await target(event);
    if (!main) throw Error('NATIVE_COMMAND_UNAVAILABLE');
    await main.apply(window, integerValue(value.gesture, 1), integerValue(value.epoch, 1), parseNativePlaybackIntent(value.intent));
  });
  ipcMain.handle(channels.retire, async (event, raw: unknown) => {
    sender(event); const value = gesture(raw); const { window, main } = await target(event);
    if (!main) return false;
    return main.retire(window, value.gesture, value.epoch);
  });
  ipcMain.handle(channels.revoke, async (event, raw: unknown) => {
    sender(event); const epoch = integerValue(raw, 1); const { window, main } = await target(event);
    return main?.revoke(window, epoch) ?? 'rejected';
  });
  ipcMain.on(channels.acknowledgement, (event, raw: unknown) => {
    try {
      sender(event); const value = objectValue(raw);
      exactKeys(value, ['epoch', 'serial', 'accepted']);
      const epoch = integerValue(value.epoch, 1), serial = integerValue(value.serial, 1);
      const accepted = booleanValue(value.accepted);
      void target(event).then(({ window, main }) => { main?.acknowledge(window, epoch, serial, accepted); }).catch(() => {});
    } catch { /* no valid acknowledgement: the pending deadline closes admission */ }
  });
};
