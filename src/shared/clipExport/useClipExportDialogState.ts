import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
  type ClipExportOverlaySettings,
} from './clipExportTypes';

interface ExportDialogState {
  open: boolean;
  confirmed: boolean;
  overlaySettings: ClipExportOverlaySettings;
}

interface Result {
  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  overlayChoice: boolean | null;
  chooseOverlay: (enabled: boolean) => void;
  overlaySettings: ClipExportOverlaySettings;
  setOverlaySettings: Dispatch<SetStateAction<ClipExportOverlaySettings>>;
}

/** Every new export requires an explicit choice, including menu/hotkey exports. */
export const useClipExportDialogState = (): Result => {
  const [state, setState] = useState<ExportDialogState>({
    open: false,
    confirmed: false,
    overlaySettings: { ...DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS },
  });
  const setOpen = useCallback<Dispatch<SetStateAction<boolean>>>((update) => {
    setState((previous) => {
      const open =
        typeof update === 'function' ? update(previous.open) : update;
      return open && !previous.open
        ? {
            open,
            confirmed: false,
            overlaySettings: { ...DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS },
          }
        : { ...previous, open };
    });
  }, []);
  const chooseOverlay = useCallback((enabled: boolean): void => {
    setState((previous) => ({
      ...previous,
      confirmed: true,
      overlaySettings: { ...previous.overlaySettings, enabled },
    }));
  }, []);
  const setOverlaySettings = useCallback<
    Dispatch<SetStateAction<ClipExportOverlaySettings>>
  >((update) => {
    setState((previous) => ({
      ...previous,
      overlaySettings:
        typeof update === 'function'
          ? update(previous.overlaySettings)
          : update,
    }));
  }, []);
  return {
    open: state.open,
    setOpen,
    overlayChoice: state.confirmed ? state.overlaySettings.enabled : null,
    chooseOverlay,
    overlaySettings: state.overlaySettings,
    setOverlaySettings,
  };
};
