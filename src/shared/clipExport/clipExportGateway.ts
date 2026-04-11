import type { ClipExportExecutionResult, ClipExportOverlaySettings, ClipExportPayload } from './clipExportTypes';

const getClipExportApi = () => globalThis.window.electronAPI;

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

export const loadClipOverlaySettings = async (): Promise<ClipExportOverlaySettings | null> => {
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
