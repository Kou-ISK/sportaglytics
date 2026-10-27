// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { TimelineWindowCommand } from '../../../../types/ipc/timelineWindow';
import { useTimelineWindowIntegration } from './useTimelineWindowIntegration';

const bus = vi.hoisted(() => ({
  receive: (_command: TimelineWindowCommand): void => {},
  unsubscribe: vi.fn(),
}));
vi.mock('../gateways/timelineWindowGateway', () => ({
  openTimelineWindow: vi.fn(async () => {}),
  closeTimelineWindow: vi.fn(async () => {}),
  syncTimelineWindow: vi.fn(),
  syncTimelineWindowClock: vi.fn(),
  subscribeTimelineWindowCommand: (listener: typeof bus.receive) => {
    bus.receive = listener;
    return bus.unsubscribe;
  },
}));
const make = () => {
  const params: Parameters<typeof useTimelineWindowIntegration>[0] = {
    isFileSelected: true,
    timeline: [],
    rows: [],
    maxSec: 300,
    currentTime: 40,
    isPlaying: false,
    playbackRate: 1,
    selectedIds: [],
    teamNames: [],
    videoSources: ['synthetic.mp4'],
    hotkeys: [],
    hotkeyHandlers: {},
    hotkeyKeyUpHandlers: {},
    onAngleSyncCommand: vi.fn(),
    onAngleSyncSeekRelative: vi.fn(),
    onSeek: vi.fn(),
    onSelectionChange: vi.fn(),
    onDeleteItems: vi.fn(),
    onUpdateMemo: vi.fn(),
    onUpdateRange: vi.fn(),
    onUpdateItem: vi.fn(),
    onBulkUpdateItems: vi.fn(),
    onSplitItem: vi.fn(),
    onMergeItems: vi.fn(),
    onDuplicateItem: () => null,
    onCreateItem: vi.fn(),
    onAddRow: vi.fn(),
    onUpdateRow: vi.fn(),
    onMoveRow: vi.fn(),
    onDeleteRows: vi.fn(),
    onPasteItems: () => [],
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onAddToPlaylist: vi.fn(),
  };
  return {
    params,
    ...renderHook(useTimelineWindowIntegration, { initialProps: params }),
  };
};
afterEach(() => vi.clearAllMocks());

it('routes every relative IPC command before a React commit and cleans up the listener', () => {
  const f = make();
  act(() => {
    for (let n = 0; n < 3; n++)
      bus.receive({ type: 'seek-relative', seconds: 10 });
  });
  expect(f.params.onSeek).toHaveBeenNthCalledWith(1, 50);
  expect(f.params.onSeek).toHaveBeenNthCalledWith(2, 60);
  expect(f.params.onSeek).toHaveBeenNthCalledWith(3, 70);
  f.unmount();
  expect(bus.unsubscribe).toHaveBeenCalledOnce();
});

it('invalidates old relative input when owner clocks commit away and back without another command', () => {
  const f = make();
  act(() => bus.receive({ type: 'seek-relative', seconds: 10 }));
  f.rerender({ ...f.params, currentTime: 50 });
  f.rerender({ ...f.params, currentTime: 40 });
  act(() => bus.receive({ type: 'seek-relative', seconds: 10 }));
  expect(f.params.onSeek).toHaveBeenLastCalledWith(50);
  f.unmount();
});

it('invalidates pending input when the document closes and reopens at the same position', () => {
  const f = make();
  act(() => bus.receive({ type: 'seek-relative', seconds: 10 }));
  f.rerender({ ...f.params, isFileSelected: false });
  f.rerender(f.params);
  act(() => bus.receive({ type: 'seek-relative', seconds: 10 }));
  expect(f.params.onSeek).toHaveBeenLastCalledWith(50);
  f.unmount();
});

it('delegates manual relative input to its transport without using the global clock', () => {
  const f = make();
  f.rerender({
    ...f.params,
    angleSync: {
      angles: [{ name: 'One', point: null }],
      selected: 0,
      busy: false,
      saving: false,
      analyzing: false,
      changed: false,
      canMark: false,
      canAlign: false,
      frameAvailable: true,
      message: '',
    },
  });
  act(() => {
    bus.receive({ type: 'seek-relative', seconds: 10 });
    bus.receive({ type: 'seek-relative', seconds: -1 });
  });
  expect(f.params.onAngleSyncSeekRelative).toHaveBeenNthCalledWith(1, 10);
  expect(f.params.onAngleSyncSeekRelative).toHaveBeenNthCalledWith(2, -1);
  expect(f.params.onSeek).not.toHaveBeenCalled();
  f.unmount();
});
