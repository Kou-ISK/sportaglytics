// @vitest-environment jsdom
import { useEffect, useRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type {
  PlaylistFileLoadResult,
  PlaylistItem,
} from '../../../../types/playlist/core';
import type { PlaylistSyncData } from '../../../../types/playlist/window';
import { usePlaylistHistory } from './usePlaylistHistory';
import { usePlaylistLoader } from './usePlaylistLoader';
import { usePlaylistIpcSync } from './usePlaylistIpcSync';
import { usePlaylistWindowCoreState } from './usePlaylistWindowCoreState';

const ipc = vi.hoisted(() => ({
  load: vi.fn(),
  external: [] as Array<(path: string) => void>,
  add: [] as Array<(item: PlaylistItem) => void>,
  sync: [] as Array<(data: PlaylistSyncData) => void>,
}));
vi.mock('../../gateway/playlistWindowGateway', () => ({
  loadPlaylistFile: ipc.load,
  subscribePlaylistExternalOpen: (callback: (path: string) => void) => {
    ipc.external.push(callback);
    return () => {};
  },
  subscribePlaylistAddItem: (callback: (item: PlaylistItem) => void) => {
    ipc.add.push(callback);
    return () => {};
  },
  subscribePlaylistSync: (callback: (data: PlaylistSyncData) => void) => {
    ipc.sync.push(callback);
    return () => {};
  },
  subscribePlaylistSaveProgress: () => () => {},
  requestPlaylistSync: () => {},
}));

const item = (id: string): PlaylistItem => ({
  id,
  timelineItemId: null,
  actionName: id,
  startTime: 0,
  endTime: 5,
  addedAt: 1,
  note: 'original',
});
const document = (id: string): PlaylistFileLoadResult => ({
  filePath: `./${id}.stpl`,
  playlist: {
    id,
    name: id,
    type: 'reference',
    items: [item(id)],
    createdAt: 1,
    updatedAt: 1,
  },
});
const deferred = () => {
  let resolve: (value: PlaylistFileLoadResult | null) => void = () => {};
  const promise = new Promise<PlaylistFileLoadResult | null>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const useHarness = () => {
  const core = usePlaylistWindowCoreState();
  const history = usePlaylistHistory([item('current')]);
  const setName = core.setPlaylistName;
  useEffect(() => setName('current'), [setName]);
  const loadedPath = useRef(vi.fn());
  const common = {
    ...core,
    setItemsWithHistory: history.setItems,
  };
  const loader = usePlaylistLoader({
    ...common,
    setLoadedFilePath: loadedPath.current,
  });
  usePlaylistIpcSync(common);
  return {
    history,
    loader,
    core,
    name: core.playlistName,
    dirty: core.hasUnsavedChanges,
    loadedPath: loadedPath.current,
    edit: () => {
      history.setItems((previous) =>
        previous.map((clip) => ({ ...clip, note: 'edited while loading' })),
      );
      core.setHasUnsavedChanges(true);
    },
  };
};

beforeEach(() => {
  ipc.load.mockReset();
  ipc.external.length = 0;
  ipc.add.length = 0;
  ipc.sync.length = 0;
});

it('applies saved contents before queued additions in FIFO order without duplicating an item', async () => {
  const held = deferred();
  ipc.load.mockReturnValue(held.promise);
  const { result } = renderHook(useHarness);
  act(() => {
    ipc.external[0]('./saved.stpl');
    ipc.add[0](item('first'));
    ipc.add[0](item('second'));
    ipc.add[0](item('first'));
  });
  await act(async () => {
    held.resolve(document('saved'));
    await held.promise;
  });
  expect(result.current.history.items.map((clip) => clip.id)).toEqual([
    'saved',
    'first',
    'second',
  ]);
  expect(result.current.dirty).toBe(true);
});

it('keeps a newer edit and additions instead of replacing them with an old disk snapshot', async () => {
  const held = deferred();
  ipc.load.mockReturnValue(held.promise);
  const { result } = renderHook(useHarness);
  act(() => {
    ipc.external[0]('./saved.stpl');
    result.current.edit();
    ipc.add[0](item('new'));
  });
  await act(async () => {
    held.resolve(document('saved'));
    await held.promise;
  });
  expect(result.current.history.items.map((clip) => clip.id)).toEqual([
    'current',
    'new',
  ]);
  expect(result.current.history.items[0].note).toBe('edited while loading');
  expect(result.current.name).toBe('current');
  expect(result.current.loadedPath).not.toHaveBeenCalled();
});

it('rejects an older load completion after a newer document generation', async () => {
  const old = deferred(),
    latest = deferred();
  ipc.load.mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise);
  const { result } = renderHook(useHarness);
  act(() => {
    ipc.external[0]('./old.stpl');
    ipc.external[0]('./latest.stpl');
    ipc.add[0](item('new'));
  });
  await act(async () => {
    latest.resolve(document('latest'));
    await latest.promise;
    old.resolve(document('old'));
    await old.promise;
  });
  expect(result.current.history.items.map((clip) => clip.id)).toEqual([
    'latest',
    'new',
  ]);
  expect(result.current.name).toBe('latest');
});

it('keeps a newer sync generation and subsequent additions when an old load finishes', async () => {
  const held = deferred();
  ipc.load.mockReturnValue(held.promise);
  const { result } = renderHook(useHarness);
  const playlist = document('synced').playlist;
  act(() => {
    ipc.external[0]('./old.stpl');
    ipc.add[0](item('before-sync'));
    ipc.sync[0]({
      state: {
        playlists: [playlist],
        activePlaylistId: playlist.id,
        playingItemId: null,
        loopMode: 'none',
      },
      videoPath: null,
      videoPath2: null,
      videoSources: [],
      currentTime: 0,
    });
    ipc.add[0](item('after-sync'));
  });
  await act(async () => {
    held.resolve(document('old'));
    await held.promise;
  });
  expect(result.current.history.items.map((clip) => clip.id)).toEqual([
    'synced',
    'after-sync',
  ]);
  expect(result.current.name).toBe('synced');
});

it('releases queued additions after a cancelled load and ignores completion after unmount', async () => {
  const held = deferred();
  ipc.load.mockReturnValue(held.promise);
  const { result, unmount } = renderHook(useHarness);
  act(() => {
    ipc.external[0]('./cancel.stpl');
    ipc.add[0](item('new'));
  });
  await act(async () => {
    held.resolve(null);
    await held.promise;
  });
  expect(result.current.history.items.map((clip) => clip.id)).toEqual([
    'current',
    'new',
  ]);
  const later = deferred();
  ipc.load.mockReturnValue(later.promise);
  act(() => ipc.external[0]('./later.stpl'));
  const setter = result.current.loadedPath;
  unmount();
  await act(async () => {
    later.resolve(document('later'));
    await later.promise;
  });
  expect(setter).not.toHaveBeenCalled();
});

it('keeps held loads and delivery queues independent between renderers', async () => {
  const one = deferred(),
    two = deferred();
  ipc.load.mockReturnValueOnce(one.promise).mockReturnValueOnce(two.promise);
  const first = renderHook(useHarness),
    second = renderHook(useHarness);
  act(() => {
    ipc.external[0]('./one.stpl');
    ipc.external[1]('./two.stpl');
    ipc.add[0](item('one-add'));
    ipc.add[1](item('two-add'));
  });
  await act(async () => {
    one.resolve(document('one'));
    await one.promise;
  });
  expect(first.result.current.history.items.map((clip) => clip.id)).toEqual([
    'one',
    'one-add',
  ]);
  expect(second.result.current.history.items.map((clip) => clip.id)).toEqual([
    'current',
  ]);
  await act(async () => {
    two.resolve(document('two'));
    await two.promise;
  });
  expect(second.result.current.history.items.map((clip) => clip.id)).toEqual([
    'two',
    'two-add',
  ]);
});

it('preserves loaded row membership while applying additions before the next React render', async () => {
  const held = deferred();
  ipc.load.mockReturnValue(held.promise);
  const { result } = renderHook(useHarness);
  const saved = document('saved');
  saved.playlist.rows = [
    { id: 'saved-row', name: 'Saved row', enabled: true, order: 0 },
  ];
  saved.playlist.items[0].rowId = 'saved-row';
  act(() => {
    ipc.external[0]('./saved.stpl');
    ipc.add[0](item('new'));
  });
  await act(async () => {
    held.resolve(saved);
    await held.promise;
  });
  expect(result.current.history.items.map((clip) => clip.rowId)).toEqual([
    'saved-row',
    'saved-row',
  ]);
  expect(result.current.core.playlistRows).toEqual(saved.playlist.rows);
});

it('protects another edit while the document was already dirty at load start', async () => {
  const held = deferred();
  ipc.load.mockReturnValue(held.promise);
  const { result } = renderHook(useHarness);
  act(() => result.current.edit());
  act(() => {
    ipc.external[0]('./saved.stpl');
    result.current.core.setPlaylistName('newer title');
    result.current.core.setHasUnsavedChanges(true);
  });
  await act(async () => {
    held.resolve(document('saved'));
    await held.promise;
  });
  expect(result.current.name).toBe('newer title');
  expect(result.current.history.items[0].note).toBe('edited while loading');
  expect(result.current.dirty).toBe(true);
});

it('coalesces duplicate external-open notifications for the same active document', async () => {
  const held = deferred();
  ipc.load.mockReturnValue(held.promise);
  const { result } = renderHook(useHarness);
  act(() => {
    ipc.external[0]('./saved.stpl');
    ipc.add[0](item('first'));
    ipc.external[0]('./saved.stpl');
    ipc.add[0](item('second'));
  });
  await act(async () => {
    held.resolve(document('saved'));
    await held.promise;
  });
  expect(result.current.history.items.map((clip) => clip.id)).toEqual([
    'saved',
    'first',
    'second',
  ]);
  expect(ipc.load).toHaveBeenCalledTimes(1);
});

it('keeps the optional file-picker call usable when no document is loading', async () => {
  ipc.load.mockResolvedValue(null);
  const { result } = renderHook(useHarness);
  await act(async () => result.current.loader.loadPlaylistFromPath());
  expect(ipc.load).toHaveBeenCalledWith(undefined);
  expect(result.current.history.items[0].id).toBe('current');
});
