// @vitest-environment jsdom
import type { ReactElement } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { TimelineWindowSyncPayload } from '../../../../types/ipc/timelineWindow';
import { useTimelineWindowController } from './useTimelineWindowController';
import { useTimelineContextMenu } from '../../components/Timeline/VisualTimeline/hooks/useTimelineContextMenu';

const ports = vi.hoisted(() => ({
  sync: (_payload: TimelineWindowSyncPayload): void => {},
  send: vi.fn(),
}));
vi.mock('../gateways/timelineWindowGateway', () => ({
  subscribeTimelineWindowSync: (listener: typeof ports.sync) => {
    ports.sync = listener;
    return () => {};
  },
  subscribeTimelineWindowClock: () => () => {},
  sendTimelineWindowCommand: ports.send,
}));
const ids = ['one', 'two', 'three', 'four'];
const initial: TimelineWindowSyncPayload = {
  documentId: '00000000-0000-4000-8000-000000000001:1',
  syncVersion: 1,
  selectionRequestId: null,
  timeline: ids.map((id) => ({
    id,
    actionName: 'Action',
    startTime: 0,
    endTime: 1,
    memo: '',
  })),
  rows: [{ id: 'row', name: 'Action', color: '#000000' }],
  maxSec: 10,
  currentTime: 0,
  isPlaying: false,
  playbackRate: 1,
  selectedIds: [],
  teamNames: [],
  videoSources: ['synthetic.mp4'],
  hotkeys: [],
  updatedAt: 1,
};
const Surface = (): ReactElement | null => {
  const controller = useTimelineWindowController();
  const selected = controller?.selectedTimelineIdList ?? [];
  const menu = useTimelineContextMenu({
    selectedIds: selected,
    onSelectionChange: (next) => controller?.setSelectedTimelineIdList(next),
  });
  if (!controller) return null;
  return (
    <div>
      <button onClick={() => controller.setSelectedTimelineIdList(ids)}>
        Select all
      </button>
      <button
        onClick={() => controller.setSelectedTimelineIdList(ids.slice(0, 2))}
      >
        Select two
      </button>
      {ids.map((id) => (
        <button
          key={id}
          data-testid={id}
          aria-pressed={selected.includes(id)}
          onContextMenu={(event) => menu.handleItemContextMenu(event, id)}
        >
          {id}
        </button>
      ))}
      <output data-testid="selection">{selected.join(',')}</output>
    </div>
  );
};
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});
const start = (): void => {
  render(<Surface />);
  act(() => ports.sync(initial));
};
it('keeps a newer local four-item intent when a previously queued owner snapshot arrives before acknowledgement', () => {
  start();
  const queued = { ...initial, currentTime: 1, updatedAt: 2, syncVersion: 2 };
  fireEvent.click(screen.getByText('Select all'));
  expect(screen.getByTestId('selection').textContent).toBe(ids.join(','));
  // Only IPC delivery is simulated. Both the detached controller and the
  // context-menu selection behavior are production hooks.
  act(() => ports.sync(queued));
  fireEvent.contextMenu(screen.getByTestId('one'), { button: 2 });
  expect(screen.getByTestId('selection').textContent).toBe(ids.join(','));
});
it('retains the same four-item selection when its owner confirmation arrives before the context click', () => {
  start();
  fireEvent.click(screen.getByText('Select all'));
  const command = ports.send.mock.calls
    .map(([value]) => value)
    .filter((value) => value.type === 'selection-change')
    .at(-1);
  if (!command) throw new Error('Selection command missing');
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids,
      updatedAt: 2,
      syncVersion: 2,
      selectionRequestId: command.requestId,
    }),
  );
  fireEvent.contextMenu(screen.getByTestId('one'), { button: 2 });
  expect(screen.getByTestId('selection').textContent).toBe(ids.join(','));
});

const lastSelectionRequest = (): string => {
  const command = ports.send.mock.calls
    .map(([value]) => value)
    .filter((value) => value.type === 'selection-change')
    .at(-1);
  if (!command) throw new Error('Selection command missing');
  return command.requestId;
};
it('keeps the latest intent across earlier confirmations and drops reordered older snapshots', () => {
  start();
  fireEvent.click(screen.getByText('Select all'));
  const first = lastSelectionRequest();
  fireEvent.click(screen.getByText('Select two'));
  const latest = lastSelectionRequest();
  expect(latest).not.toBe(first);
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids,
      syncVersion: 2,
      selectionRequestId: first,
    }),
  );
  expect(screen.getByTestId('selection').textContent).toBe('one,two');
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids.slice(0, 2),
      syncVersion: 3,
      selectionRequestId: latest,
    }),
  );
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids,
      syncVersion: 2,
      selectionRequestId: first,
    }),
  );
  expect(screen.getByTestId('selection').textContent).toBe('one,two');
});
it('does not treat an old equal-value selection as acknowledgement of a new operation', () => {
  start();
  fireEvent.click(screen.getByText('Select two'));
  const first = lastSelectionRequest();
  fireEvent.click(screen.getByText('Select all'));
  const middle = lastSelectionRequest();
  fireEvent.click(screen.getByText('Select two'));
  const latest = lastSelectionRequest();
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids.slice(0, 2),
      syncVersion: 2,
      selectionRequestId: first,
    }),
  );
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids,
      syncVersion: 3,
      selectionRequestId: middle,
    }),
  );
  expect(screen.getByTestId('selection').textContent).toBe('one,two');
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids.slice(0, 2),
      syncVersion: 4,
      selectionRequestId: latest,
    }),
  );
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids,
      syncVersion: 5,
      selectionRequestId: latest,
    }),
  );
  expect(screen.getByTestId('selection').textContent).toBe(ids.join(','));
});
it('cancels pending selection on document replacement even when file and item identities are reused', () => {
  start();
  fireEvent.click(screen.getByText('Select all'));
  const requestId = lastSelectionRequest();
  act(() =>
    ports.sync({
      ...initial,
      documentId: initial.documentId.replace(':1', ':2'),
      selectedIds: ['two'],
      syncVersion: 2,
    }),
  );
  act(() =>
    ports.sync({
      ...initial,
      selectedIds: ids,
      syncVersion: 3,
      selectionRequestId: requestId,
    }),
  );
  expect(screen.getByTestId('selection').textContent).toBe('two');
});
it('restores confirmed selection and requests synchronization after a missing acknowledgement without replaying the edit', () => {
  vi.useFakeTimers();
  start();
  fireEvent.click(screen.getByText('Select all'));
  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByTestId('selection').textContent).toBe('');
  expect(
    ports.send.mock.calls.filter(
      ([command]) => command.type === 'selection-change',
    ),
  ).toHaveLength(1);
  expect(
    ports.send.mock.calls.filter(
      ([command]) => command.type === 'request-sync',
    ),
  ).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});
it('releases the acknowledgement timer when the detached owner unmounts', () => {
  vi.useFakeTimers();
  start();
  fireEvent.click(screen.getByText('Select all'));
  cleanup();
  act(() => vi.advanceTimersByTime(5000));
  expect(vi.getTimerCount()).toBe(0);
  expect(
    ports.send.mock.calls.filter(
      ([command]) => command.type === 'request-sync',
    ),
  ).toHaveLength(1);
});

it('does not return to a retired owner after a distinct source remount', () => {
  start();
  act(() =>
    ports.sync({
      ...initial,
      documentId: '00000000-0000-4000-8000-000000000002:0',
      selectedIds: ['two'],
    }),
  );
  act(() =>
    ports.sync({
      ...initial,
      documentId: initial.documentId.replace(':1', ':2'),
      selectedIds: ids,
      syncVersion: 10,
    }),
  );
  expect(screen.getByTestId('selection').textContent).toBe('two');
});
