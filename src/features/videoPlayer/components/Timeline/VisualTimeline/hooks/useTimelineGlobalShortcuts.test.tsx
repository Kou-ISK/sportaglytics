/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TimelineData } from '../../../../../../types/timeline/core';
import { useTimelineGlobalShortcuts } from './useTimelineGlobalShortcuts';

const timeline: TimelineData[] = [
  {
    id: 'item-1',
    startTime: 1,
    endTime: 2,
    actionName: 'Scrum',
    labels: [],
    memo: '',
  },
  {
    id: 'item-2',
    startTime: 3,
    endTime: 4,
    actionName: 'Lineout',
    labels: [],
    memo: '',
  },
  {
    id: 'item-3',
    startTime: 5,
    endTime: 6,
    actionName: 'Try',
    labels: [],
    memo: '',
  },
];

const createTimelineContainer = (): HTMLDivElement => {
  const container = document.createElement('div');
  container.tabIndex = 0;
  document.body.appendChild(container);
  container.focus();
  return container;
};

const dispatchKey = (
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
): void => {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, ...init }),
  );
};

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('useTimelineGlobalShortcuts', () => {
  it('adds selected timeline items to playlist with command shift p', () => {
    const onAddToPlaylist = vi.fn();
    const container = createTimelineContainer();

    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1', 'item-3'],
        timeline,
        scrollContainerRef: {
          current: container,
        } satisfies React.RefObject<HTMLDivElement>,
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onAddToPlaylist,
        selectedRowIds: [],
      }),
    );

    dispatchKey(container, 'p', { metaKey: true, shiftKey: true });

    expect(onAddToPlaylist).toHaveBeenCalledWith([timeline[0], timeline[2]]);
  });

  it('copies instances and pastes them into the single selected row', () => {
    const onCopyItems = vi.fn();
    const onPasteItems = vi.fn();
    const container = createTimelineContainer();

    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1', 'item-3'],
        selectedRowIds: ['row-target'],
        timeline,
        scrollContainerRef: {
          current: container,
        } satisfies React.RefObject<HTMLDivElement>,
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onCopyItems,
        onPasteItems,
      }),
    );

    dispatchKey(container, 'c', { metaKey: true });
    dispatchKey(container, 'v', { metaKey: true });

    expect(onCopyItems).toHaveBeenCalledWith([timeline[0], timeline[2]]);
    expect(onPasteItems).toHaveBeenCalledWith('row-target');
  });

  it('requests deletion for selected rows before instance deletion', () => {
    const onRequestDeleteRows = vi.fn();
    const onDeleteItems = vi.fn();
    const container = createTimelineContainer();

    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1'],
        selectedRowIds: ['row-1', 'row-2'],
        timeline,
        scrollContainerRef: {
          current: container,
        } satisfies React.RefObject<HTMLDivElement>,
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onDeleteItems,
        onRequestDeleteRows,
      }),
    );

    dispatchKey(container, 'Delete');

    expect(onRequestDeleteRows).toHaveBeenCalledWith(['row-1', 'row-2']);
    expect(onDeleteItems).not.toHaveBeenCalled();
  });

  it('deletes all selected instances with Delete and Backspace', () => {
    const onDeleteItems = vi.fn();
    const container = createTimelineContainer();

    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1', 'item-3'],
        selectedRowIds: [],
        timeline,
        scrollContainerRef: {
          current: container,
        } satisfies React.RefObject<HTMLDivElement>,
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onDeleteItems,
      }),
    );

    dispatchKey(container, 'Delete');
    dispatchKey(container, 'Backspace');

    expect(onDeleteItems).toHaveBeenNthCalledWith(1, ['item-1', 'item-3']);
    expect(onDeleteItems).toHaveBeenNthCalledWith(2, ['item-1', 'item-3']);
  });

  it.each([
    ['input', 'input'],
    ['textarea', 'textarea'],
    ['select', 'select'],
    ['contenteditable', 'div'],
    ['role textbox', 'div'],
  ])('ignores Delete while editing %s', (kind, tagName) => {
    const onDeleteItems = vi.fn();
    const container = createTimelineContainer();
    const target = document.createElement(tagName);
    if (kind === 'contenteditable')
      target.setAttribute('contenteditable', 'true');
    if (kind === 'role textbox') target.setAttribute('role', 'textbox');
    container.appendChild(target);

    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1'],
        selectedRowIds: [],
        timeline,
        scrollContainerRef: {
          current: container,
        } satisfies React.RefObject<HTMLDivElement>,
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onDeleteItems,
      }),
    );

    dispatchKey(target, 'Delete');

    expect(onDeleteItems).not.toHaveBeenCalled();
  });

  it('ignores Delete from controls inside a dialog', () => {
    const onDeleteItems = vi.fn();
    const container = createTimelineContainer();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    container.appendChild(dialog);

    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1'],
        selectedRowIds: [],
        timeline,
        scrollContainerRef: {
          current: container,
        } satisfies React.RefObject<HTMLDivElement>,
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onDeleteItems,
      }),
    );

    dispatchKey(button, 'Delete');

    expect(onDeleteItems).not.toHaveBeenCalled();
  });
});

it('leaves navigation and playlist shortcuts alone outside the timeline or in inputs', () => {
  const container = createTimelineContainer();
  const input = document.createElement('input');
  container.append(input);
  const onSelectionChange = vi.fn();
  const onAddToPlaylist = vi.fn();
  renderHook(() =>
    useTimelineGlobalShortcuts({
      selectedIds: ['item-1'],
      selectedRowIds: [],
      timeline,
      scrollContainerRef: { current: container },
      onSelectionChange,
      onSeek: vi.fn(),
      onAddToPlaylist,
    }),
  );
  for (const target of [input, document.body]) {
    for (const key of ['Tab', 'ArrowDown', 'p']) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        altKey: key === 'ArrowDown',
        metaKey: key === 'p',
        shiftKey: key === 'p',
      });
      target.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
  }
  expect(onSelectionChange).not.toHaveBeenCalled();
  expect(onAddToPlaylist).not.toHaveBeenCalled();
});

it('supports editing, select all and escape without trapping Tab when no item is selected', () => {
  const container = createTimelineContainer();
  const item = document.createElement('div');
  item.dataset.timelineItemId = 'item-2';
  container.append(item);
  const onEditItem = vi.fn(),
    onSelectAll = vi.fn(),
    onClearSelection = vi.fn();
  renderHook(() =>
    useTimelineGlobalShortcuts({
      selectedIds: [],
      selectedRowIds: [],
      timeline,
      scrollContainerRef: { current: container },
      onSelectionChange: vi.fn(),
      onSeek: vi.fn(),
      onEditItem,
      onSelectAll,
      onClearSelection,
    }),
  );
  dispatchKey(item, 'Enter');
  dispatchKey(container, 'a', { ctrlKey: true });
  dispatchKey(container, 'Escape');
  const tab = new KeyboardEvent('keydown', {
    key: 'Tab',
    bubbles: true,
    cancelable: true,
  });
  container.dispatchEvent(tab);
  expect(tab.defaultPrevented).toBe(false);
  expect(onEditItem).toHaveBeenCalledWith('item-2');
  expect(onSelectAll).toHaveBeenCalledOnce();
  expect(onClearSelection).toHaveBeenCalledOnce();
});

it.each(['metaKey', 'ctrlKey'])(
  'routes range edits only from the timeline with %s',
  (modifier) => {
    const container = createTimelineContainer();
    const input = document.createElement('input');
    container.append(input);
    const onSplit = vi.fn();
    const onMerge = vi.fn();
    renderHook(() =>
      useTimelineGlobalShortcuts({
        selectedIds: ['item-1'],
        selectedRowIds: [],
        timeline,
        scrollContainerRef: { current: container },
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onSplit,
        onMerge,
      }),
    );
    for (const target of [input, document.body]) {
      dispatchKey(target, 'K', { [modifier]: true, shiftKey: true });
      dispatchKey(target, 'J', { [modifier]: true, shiftKey: true });
    }
    expect(onSplit).not.toHaveBeenCalled();
    expect(onMerge).not.toHaveBeenCalled();
    dispatchKey(container, 'K', { [modifier]: true, shiftKey: true });
    dispatchKey(container, 'J', { [modifier]: true, shiftKey: true });
    dispatchKey(container, 'K', {
      [modifier]: true,
      shiftKey: true,
      repeat: true,
    });
    expect(onSplit).toHaveBeenCalledOnce();
    expect(onMerge).toHaveBeenCalledOnce();
  },
);
