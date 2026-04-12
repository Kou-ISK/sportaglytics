import type { AnalysisView } from '../../../../types/analysis/view';

const noop = (): void => undefined;

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const subscribeAnalysisStatsMenu = (
  callback: (requestedView?: AnalysisView) => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onMenuShowStats) {
    return noop;
  }

  try {
    return api.onMenuShowStats(callback);
  } catch (error: unknown) {
    console.debug('[menuEventGateway] onMenuShowStats failed', error);
    return noop;
  }
};

export const subscribeTimelineUndoRedoMenu = (
  onUndo: () => void,
  onRedo: () => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onTimelineUndo || !api.onTimelineRedo) {
    return noop;
  }

  try {
    const unsubscribeUndo = api.onTimelineUndo(onUndo);
    const unsubscribeRedo = api.onTimelineRedo(onRedo);
    return () => {
      unsubscribeUndo();
      unsubscribeRedo();
    };
  } catch (error: unknown) {
    console.debug(
      '[menuEventGateway] timeline undo/redo subscribe failed',
      error,
    );
    return noop;
  }
};

export const subscribeSyncMenu = ({
  onResyncAudio,
  onResetSync,
  onManualSync,
  onSetSyncMode,
}: {
  onResyncAudio: () => void;
  onResetSync: () => void;
  onManualSync: () => void;
  onSetSyncMode: (mode: 'auto' | 'manual') => void;
}): (() => void) => {
  const api = getElectronApi();
  if (
    !api?.onResyncAudio ||
    !api.onResetSync ||
    !api.onManualSync ||
    !api.onSetSyncMode
  ) {
    return noop;
  }

  try {
    api.onResyncAudio(onResyncAudio);
    api.onResetSync(onResetSync);
    api.onManualSync(onManualSync);
    api.onSetSyncMode(onSetSyncMode);

    return () => {
      api.offResyncAudio?.(onResyncAudio);
      api.offResetSync?.(onResetSync);
      api.offManualSync?.(onManualSync);
      api.offSetSyncMode?.(onSetSyncMode);
    };
  } catch (error: unknown) {
    console.debug('[menuEventGateway] sync menu subscribe failed', error);
    return noop;
  }
};
