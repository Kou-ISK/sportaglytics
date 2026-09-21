// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useClipExportDialogState } from './useClipExportDialogState';

it('requires explicit inclusion/exclusion per export and resets canceled choices', () => {
  const { result } = renderHook(useClipExportDialogState);
  act(() => result.current.setOpen(true));
  expect(result.current.overlayChoice).toBeNull();
  act(() => result.current.chooseOverlay(false));
  expect(result.current.overlayChoice).toBe(false);
  act(() => result.current.setOpen(true));
  expect(result.current.overlayChoice).toBe(false);
  act(() => result.current.setOpen(false));
  act(() => result.current.setOpen(true));
  expect(result.current.overlayChoice).toBeNull();
  act(() => result.current.chooseOverlay(true));
  act(() =>
    result.current.setOverlaySettings((previous) => ({
      ...previous,
      showMemo: false,
    })),
  );
  expect(result.current.overlayChoice).toBe(true);
  act(() => result.current.setOpen(false));
  act(() => result.current.setOpen(true));
  expect(result.current.overlaySettings.showMemo).toBe(true);
  expect(result.current.overlayChoice).toBeNull();
});
