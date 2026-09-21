import { useEffect, useState } from 'react';
import {
  buildClipExportRequests,
  resolveClipExportSourceSelection,
} from './clipExportService';
import type {
  ClipExportAngleOption,
  ClipExportItem,
  ClipExportOverlaySettings,
  ClipExportTextPreviewResult,
} from './clipExportTypes';

export interface ClipExportTextPreviewState extends ClipExportTextPreviewResult {
  loading: boolean;
  blocked: boolean;
  index: number;
  select: (index: number) => void;
  retry: () => void;
}
interface Options {
  open: boolean;
  clips: ClipExportItem[];
  videoSources?: string[];
  angleOption: ClipExportAngleOption;
  selectedAngleIndex: number;
  overlayChoice: boolean | null;
  overlaySettings: ClipExportOverlaySettings;
  primarySource?: string;
  secondarySource?: string;
}

export const useClipExportTextPreview = (
  options: Options,
): ClipExportTextPreviewState => {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    result: ClipExportTextPreviewResult;
  } | null>(null);
  const active =
    options.open && options.overlayChoice === true && options.clips.length > 0;
  // Values, rather than caller array identities, identify a preview and invalidate stale results.
  const key = JSON.stringify({ ...options, index, attempt });
  useEffect(() => {
    if (!active) {
      setState(null);
      return;
    }
    let disposed = false;
    const timer = setTimeout(() => {
      const run = async (): Promise<void> => {
        try {
          // key is produced only by serializing the typed Options immediately above.
          const {
            clips,
            videoSources,
            angleOption,
            selectedAngleIndex,
            overlaySettings,
            primarySource,
            secondarySource,
            index: requestedIndex,
          } = JSON.parse(key) as Options & { index: number };
          const exports = buildClipExportRequests({
            clips,
            videoSources,
            angleOption,
            selectedAngleIndex,
            overlay: overlaySettings,
            resolvedSources: resolveClipExportSourceSelection(
              videoSources,
              primarySource,
              secondarySource,
            ),
            exportMode: 'single',
            exportFileName: '',
          });
          const count = exports.reduce(
            (sum, payload) => sum + payload.clips.length,
            0,
          );
          const api = window.electronAPI?.previewClipExportText;
          if (!api)
            throw new Error(
              'プレビューAPIが利用できません。アプリを再起動してください。',
            );
          const result = await api({
            exports,
            previewIndex: Math.min(requestedIndex, Math.max(0, count - 1)),
          });
          if (!disposed) setState({ key, result });
        } catch (error) {
          if (!disposed)
            setState({
              key,
              result: {
                clips: [],
                error:
                  error instanceof Error
                    ? error.message
                    : 'プレビューを取得できません',
              },
            });
        }
      };
      void run();
    }, 250);
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [active, key]);
  const result = state?.key === key ? state.result : { clips: [] };
  const loading = active && state?.key !== key;
  return {
    ...result,
    loading,
    blocked:
      active &&
      (loading ||
        Boolean(result.error) ||
        result.clips.some((clip) => clip.layout.overflow)),
    index: Math.min(index, Math.max(0, result.clips.length - 1)),
    select: setIndex,
    retry: () => setAttempt((value) => value + 1),
  };
};
