// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../types/playlist/core';
import { usePlaylistHistory } from '../hooks/playlist/usePlaylistHistory';
import { usePlaylistMediaReferences } from './usePlaylistMediaReferences';

const original: PlaylistItem = {
  id: 'one',
  timelineItemId: null,
  actionName: 'Test',
  addedAt: 1,
  startTime: 0,
  endTime: 4,
  videoSource: '/source/test.stpkg/video.mp4',
  mediaReference: {
    packageId: 'id',
    packagePath: '/source/test.stpkg',
    mediaPath: 'video.mp4',
  },
};

afterEach(() => vi.unstubAllGlobals());

it('keeps existing dirty state on derived reference refresh, but marks a real relink dirty', async () => {
  const derived = {
    ...original,
    mediaReference: {
      ...original.mediaReference!,
      relativePackagePath: '../test.stpkg',
    },
  };
  const resolve = vi
    .fn()
    .mockResolvedValue({ items: [derived], missingItemIds: [] });
  vi.stubGlobal('electronAPI', {
    playlist: { resolveMediaReferences: resolve },
  });
  const { result } = renderHook(() => {
    const history = usePlaylistHistory([original]);
    const [dirty, setDirty] = useState(false);
    usePlaylistMediaReferences({
      items: history.items,
      currentItem: history.items[0],
      reconcile: history.reconcileMedia,
      setDirty,
    });
    return { ...history, dirty, setDirty };
  });
  await waitFor(() =>
    expect(result.current.items[0].mediaReference?.relativePackagePath).toBe(
      '../test.stpkg',
    ),
  );
  expect(result.current.dirty).toBe(false);
  act(() => result.current.setDirty(true));
  const moved = {
    ...derived,
    mediaReference: {
      ...derived.mediaReference,
      relativePackagePath: '../../test.stpkg',
    },
  };
  resolve.mockResolvedValue({ items: [moved], missingItemIds: [] });
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() =>
    expect(result.current.items[0].mediaReference?.relativePackagePath).toBe(
      '../../test.stpkg',
    ),
  );
  expect(result.current.dirty).toBe(true);
  act(() => result.current.setDirty(false));
  resolve.mockResolvedValue({
    items: [{ ...moved, videoSource: '/new/video.mp4' }],
    missingItemIds: [],
  });
  act(() => window.dispatchEvent(new Event('focus')));
  await waitFor(() => expect(result.current.dirty).toBe(true));
});

it('preserves a concurrent note and rejects a stale result after a manual reconnect', async () => {
  const pending = Promise.withResolvers<{
    items: PlaylistItem[];
    missingItemIds: string[];
  }>();
  const resolve = vi
    .fn()
    .mockReturnValueOnce(pending.promise)
    .mockReturnValue(new Promise(() => {}));
  vi.stubGlobal('electronAPI', {
    playlist: { resolveMediaReferences: resolve },
  });
  const { result } = renderHook(() => {
    const history = usePlaylistHistory([original]);
    const [dirty, setDirty] = useState(false);
    usePlaylistMediaReferences({
      items: history.items,
      currentItem: history.items[0],
      reconcile: history.reconcileMedia,
      setDirty,
    });
    return { ...history, dirty };
  });
  act(() =>
    result.current.setItems((items) =>
      items.map((item) => ({
        ...item,
        note: 'changed',
        videoSource: '/manual.mp4',
      })),
    ),
  );
  await act(async () =>
    pending.resolve({
      items: [{ ...original, videoSource: '/stale.mp4' }],
      missingItemIds: [],
    }),
  );
  expect(result.current.items[0].note).toBe('changed');
  expect(result.current.items[0].videoSource).toBe('/manual.mp4');
  expect(result.current.dirty).toBe(false);
});
