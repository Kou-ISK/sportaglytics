import type {
  TimelineWindowCommand,
  TimelineWindowClockPayload,
  TimelineWindowSyncPayload,
} from '../../../../types/ipc/timelineWindow';

const getApi = () => window.electronAPI?.timelineWindow;

export const openTimelineWindow = async (): Promise<void> => {
  await getApi()?.openWindow();
};

export const closeTimelineWindow = async (): Promise<void> => {
  await getApi()?.closeWindow();
};

export const syncTimelineWindow = (
  payload: TimelineWindowSyncPayload,
): void => {
  getApi()?.syncToWindow(payload);
};

export const syncTimelineWindowClock = (
  payload: TimelineWindowClockPayload,
): void => {
  getApi()?.syncClockToWindow(payload);
};

export const sendTimelineWindowCommand = (
  command: TimelineWindowCommand,
): void => {
  getApi()?.sendCommand(command);
};

export const subscribeTimelineWindowSync = (
  callback: (payload: TimelineWindowSyncPayload) => void,
): (() => void) => getApi()?.onSync(callback) ?? (() => undefined);

export const subscribeTimelineWindowClock = (
  callback: (payload: TimelineWindowClockPayload) => void,
): (() => void) => getApi()?.onClock(callback) ?? (() => undefined);

export const subscribeTimelineWindowCommand = (
  callback: (command: TimelineWindowCommand) => void,
): (() => void) => getApi()?.onCommand(callback) ?? (() => undefined);

export const subscribeTimelineWindowVisibility = (
  callback: (isOpen: boolean) => void,
): (() => void) => getApi()?.onVisibilityChange(callback) ?? (() => undefined);
