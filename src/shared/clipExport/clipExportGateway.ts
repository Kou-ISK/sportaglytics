import type {
  ClipExportExecutionResult,
  ClipExportOverlaySettings,
  ClipExportPayload,
} from './clipExportTypes';
import type { ExportProgressWindowState } from '../../types/ipc/exportProgressWindow';

const getClipExportApi = () => globalThis.window.electronAPI;
const noop = (): void => undefined;

export const canExportClipsWithOverlay = (): boolean => {
  return Boolean(getClipExportApi()?.exportClipsWithOverlay);
};

export const exportClipsWithOverlay = async (
  payload: ClipExportPayload,
): Promise<ClipExportExecutionResult> => {
  const api = getClipExportApi();
  if (!api?.exportClipsWithOverlay) {
    return {
      success: false,
      error: '書き出しAPIが利用できません',
    };
  }

  try {
    return await api.exportClipsWithOverlay(payload);
  } catch (error: unknown) {
    console.debug('[clipExportGateway] exportClipsWithOverlay failed', error);
    return {
      success: false,
      error: 'クリップ書き出しに失敗しました',
    };
  }
};

export const subscribeClipExportProgressWindowState = (
  callback: (state: ExportProgressWindowState) => void,
): (() => void) => {
  const api = getClipExportApi();
  if (!api?.onExportProgressWindowState) {
    return noop;
  }

  try {
    return api.onExportProgressWindowState(callback);
  } catch (error: unknown) {
    console.debug('[clipExportGateway] onExportProgressWindowState failed', error);
    return noop;
  }
};

export const requestClipExportProgressWindowState =
  async (): Promise<ExportProgressWindowState | null> => {
    const api = getClipExportApi();
    if (!api?.requestExportProgressWindowState) {
      return null;
    }

    try {
      return await api.requestExportProgressWindowState();
    } catch (error: unknown) {
      console.debug(
        '[clipExportGateway] requestExportProgressWindowState failed',
        error,
      );
      return null;
    }
  };

export const loadClipOverlaySettings =
  async (): Promise<ClipExportOverlaySettings | null> => {
    const api = getClipExportApi();
    if (!api?.loadSettings) {
      return null;
    }

    try {
      const settings = await api.loadSettings();
      return settings.overlayClip ?? null;
    } catch (error: unknown) {
      console.debug('[clipExportGateway] loadSettings failed', error);
      return null;
    }
  };

export const subscribeClipExportMenuRequest = (
  callback: () => void,
): (() => void) => {
  const api = getClipExportApi();
  if (!api?.onMenuExportClips) {
    return noop;
  }

  try {
    return api.onMenuExportClips(callback);
  } catch (error: unknown) {
    console.debug('[clipExportGateway] onMenuExportClips failed', error);
    return noop;
  }
};
