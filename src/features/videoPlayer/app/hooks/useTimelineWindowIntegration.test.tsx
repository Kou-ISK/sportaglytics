// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { TimelineWindowCommand } from '../../../../types/ipc/timelineWindow';
import { useTimelineWindowIntegration } from './useTimelineWindowIntegration';
import { useTimelineSelection } from './useTimelineSelection';
import { useTimelineSessionController } from './useTimelineSessionController';
import {
  readTimelineFile,
  writeTimelineFile,
} from '../gateways/timelineImportExportGateway';
import { syncTimelineWindow } from '../gateways/timelineWindowGateway';

vi.mock('../gateways/timelineImportExportGateway', () => ({
  readTimelineFile: vi.fn(),
  writeTimelineFile: vi.fn(),
}));

const bus = vi.hoisted(() => ({
  receive: (_command: TimelineWindowCommand): void => {},
  unsubscribe: vi.fn(),
  visibility: (_isOpen: boolean): void => {},
  native: null as { seekCommandTime: number; finishPreview: () => void } | null,
}));
vi.mock('../../shared/nativePlayback/nativePlaybackRegistry', () => ({
  getNativePlayback: () => bus.native,
}));
vi.mock('./usePlaybackAudioSelections', () => ({
  usePlaybackAudioSelections: () => [],
}));
vi.mock('../gateways/timelineWindowGateway', () => ({
  openTimelineWindow: vi.fn(async () => {}),
  closeTimelineWindow: vi.fn(async () => {}),
  syncTimelineWindow: vi.fn(),
  syncTimelineWindowClock: vi.fn(),
  subscribeTimelineWindowVisibility: (listener: typeof bus.visibility) => {
    bus.visibility = listener;
    return () => {};
  },
  subscribeTimelineWindowCommand: (listener: typeof bus.receive) => {
    bus.receive = listener;
    return bus.unsubscribe;
  },
}));
const makeParams = () => {
  const params: Parameters<typeof useTimelineWindowIntegration>[0] = {
    isFileSelected: true,
    timelineEditable: true,
    timeline: [],
    rows: [],
    maxSec: 300,
    currentTime: 40,
    isPlaying: false,
    playbackRate: 1,
    selectedIds: [],
    selectionRequestId: null,
    getDocumentId: () => '00000000-0000-4000-8000-000000000001:1',
    canEditTimeline: () => true,
    onSelectionRequest: vi.fn(),
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
  return params;
};
const make = () => {
  const params = makeParams();
  return {
    params,
    ...renderHook(useTimelineWindowIntegration, { initialProps: params }),
  };
};
afterEach(() => {
  vi.clearAllMocks();
  bus.native = null;
});

it('finishes the held preview on window close only for the same native owner', () => {
  const f = make();
  const first = { seekCommandTime: 40, finishPreview: vi.fn() };
  bus.native = first;
  act(() => bus.receive({ type: 'seek', time: 50, seekMode: 'preview' }));
  act(() => bus.visibility(false));
  expect(first.finishPreview).toHaveBeenCalledOnce();
  act(() => bus.receive({ type: 'seek', time: 60, seekMode: 'preview' }));
  const second = { seekCommandTime: 0, finishPreview: vi.fn() };
  bus.native = second;
  act(() => bus.visibility(false));
  expect(first.finishPreview).toHaveBeenCalledOnce();
  expect(second.finishPreview).not.toHaveBeenCalled();
  f.unmount();
});

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

it('publishes selection and its receipt from the same committed owner state', async () => {
  const params = makeParams();
  const requestId = '00000000-0000-4000-8000-000000000002';
  const f = renderHook(() => {
    const selection = useTimelineSelection(params.getDocumentId);
    useTimelineWindowIntegration({
      ...params,
      selectedIds: selection.selectedTimelineIdList,
      selectionRequestId: selection.selectionRequestId,
      onSelectionRequest: selection.applySelectionRequest,
    });
    return selection;
  });
  await act(async () => {});
  vi.mocked(syncTimelineWindow).mockClear();
  act(() =>
    bus.receive({
      type: 'selection-change',
      documentId: params.getDocumentId(),
      requestId,
      ids: ['one', 'two'],
    }),
  );
  const receipts = vi
    .mocked(syncTimelineWindow)
    .mock.calls.map(([value]) => value);
  expect(receipts.length).toBeGreaterThan(0);
  expect(
    receipts.every(
      (value) =>
        value.selectionRequestId === requestId &&
        value.selectedIds.join(',') === 'one,two',
    ),
  ).toBe(true);
  act(() => f.result.current.setSelectedTimelineIdList(['two']));
  expect(vi.mocked(syncTimelineWindow).mock.calls.at(-1)?.[0]).toMatchObject({
    selectionRequestId: requestId,
    selectedIds: ['two'],
  });
  f.unmount();
});
it('rejects old document selection and deletion synchronously before the replacement commit', () => {
  const params = makeParams();
  let documentId = params.getDocumentId();
  params.getDocumentId = () => documentId;
  const f = renderHook(useTimelineWindowIntegration, { initialProps: params });
  const previous = documentId;
  documentId = documentId.replace(':1', ':2');
  act(() => {
    bus.receive({
      type: 'selection-change',
      documentId: previous,
      requestId: '00000000-0000-4000-8000-000000000002',
      ids: ['one'],
    });
    bus.receive({ type: 'delete-items', documentId: previous, ids: ['one'] });
  });
  expect(params.onSelectionRequest).not.toHaveBeenCalled();
  expect(params.onDeleteItems).not.toHaveBeenCalled();
  f.unmount();
});
it('does not emit a delayed open confirmation after owner unmount', async () => {
  const f = make();
  f.unmount();
  vi.mocked(syncTimelineWindow).mockClear();
  await act(async () => {});
  expect(syncTimelineWindow).not.toHaveBeenCalled();
});

it('does not let an old selection callback modify a replacement document', () => {
  let documentId = '00000000-0000-4000-8000-000000000001:1';
  const getDocumentId = () => documentId;
  const f = renderHook(() => useTimelineSelection(getDocumentId));
  const stale = f.result.current;
  act(() => f.result.current.setSelectedTimelineIdList(['one']));
  documentId = documentId.replace(':1', ':2');
  f.rerender();
  act(() => {
    stale.setSelectedTimelineIdList(['old']);
    stale.applySelectionRequest(
      '00000000-0000-4000-8000-000000000001:1',
      '00000000-0000-4000-8000-000000000002',
      ['old'],
    );
  });
  expect(f.result.current.selectedTimelineIdList).toEqual([]);
  expect(f.result.current.selectionRequestId).toBeNull();
  f.unmount();
});

it.each<{ ids: string[] }>([
  { ids: ['replacement'] },
  { ids: [] },
  { ids: ['previous'] },
])(
  'publishes only the adopted replacement content and clears old selection: $ids',
  async ({ ids: replacementIds }) => {
    const params = makeParams();
    const document = (ids: string[]): string =>
      JSON.stringify({
        version: 2,
        rows: [],
        instances: ids.map((id) => ({
          id,
          actionName: `Action ${id}`,
          startTime: 0,
          endTime: 1,
          memo: '',
        })),
      });
    vi.mocked(readTimelineFile)
      .mockResolvedValueOnce(document(['previous']))
      .mockResolvedValueOnce(document(replacementIds));
    vi.mocked(writeTimelineFile).mockResolvedValue(true);
    const f = renderHook(() => {
      const owner = useTimelineSessionController();
      useTimelineWindowIntegration({
        ...params,
        timelineEditable: owner.timelineEditable,
        timeline: owner.timeline,
        rows: owner.timelineRows,
        selectedIds: owner.selectedTimelineIdList,
        selectionRequestId: owner.selectionRequestId,
        getDocumentId: owner.getDocumentId,
        canEditTimeline: owner.canEditTimeline,
        onSelectionRequest: owner.applySelectionRequest,
        onDeleteItems: owner.deleteTimelineDatas,
      });
      return owner;
    });
    await act(async () =>
      f.result.current.setTimelineFilePath('/synthetic/previous.json'),
    );
    expect(f.result.current.timeline.map((item) => item.id)).toEqual([
      'previous',
    ]);
    act(() => f.result.current.setSelectedTimelineIdList(['previous']));
    vi.mocked(syncTimelineWindow).mockClear();
    await act(async () =>
      f.result.current.setTimelineFilePath('/synthetic/replacement.json'),
    );
    const owner = f.result.current.getDocumentId();
    const packets = vi
      .mocked(syncTimelineWindow)
      .mock.calls.map(([payload]) => payload)
      .filter((payload) => payload.documentId === owner);
    expect(packets.length).toBeGreaterThan(0);
    for (const payload of packets) {
      expect(
        payload.timeline.every((item) => replacementIds.includes(item.id)),
      ).toBe(true);
      expect(
        payload.rows.every((row) =>
          replacementIds.some((id) => row.name === `Action ${id}`),
        ),
      ).toBe(true);
      expect(payload.selectedIds).toEqual([]);
    }
    expect(packets.at(-1)?.timeline.map((item) => item.id)).toEqual(
      replacementIds,
    );
    expect(
      f.result.current.timelineRows.every((row) =>
        replacementIds.some((id) => row.name === `Action ${id}`),
      ),
    ).toBe(true);
    f.unmount();
  },
);
