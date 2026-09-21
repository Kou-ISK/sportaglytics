/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useClipExportTextPreview } from './useClipExportTextPreview';
import { DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS } from './clipExportTypes';
import type { ClipExportTextPreviewResult } from './clipExportTypes';
import { layoutClipExportText } from './clipExportTextLayout';
afterEach(() => {
  vi.useRealTimers();
});
it('blocks until the current preview finishes and ignores stale results', async () => {
  vi.useFakeTimers();
  const pending: Array<(value: ClipExportTextPreviewResult) => void> = [];
  const preview = vi.fn(
    () =>
      new Promise<ClipExportTextPreviewResult>((resolve) =>
        pending.push(resolve),
      ),
  );
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: { previewClipExportText: preview },
  });
  const options = {
    open: true,
    clips: [
      { id: 'a', actionName: 'Fixture', startTime: 0, endTime: 1, memo: 'Old' },
    ],
    videoSources: ['/fixture.mp4'],
    angleOption: 'single' as const,
    selectedAngleIndex: 0,
    overlayChoice: true,
    overlaySettings: DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
  };
  const { result, rerender, unmount } = renderHook(
    (props) => useClipExportTextPreview(props),
    { initialProps: options },
  );
  expect(result.current.blocked).toBe(true);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  rerender({ ...options, clips: [{ ...options.clips[0], memo: 'New' }] });
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  await act(async () => pending[0]({ clips: [], error: 'Old error' }));
  expect(result.current.loading).toBe(true);
  expect(result.current.error).toBeUndefined();
  await act(async () =>
    pending[1]({
      clips: [
        {
          title: 'Fixture',
          width: 1920,
          height: 1080,
          layout: layoutClipExportText(
            [{ text: 'New', isBold: false }],
            16 / 9,
          ),
        },
      ],
      image: 'data:image/png;base64,fixture',
    }),
  );
  expect(result.current.blocked).toBe(false);
  rerender({ ...options, open: false });
  rerender(options);
  expect(result.current.blocked).toBe(true);
  unmount();
});
