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

const navigationTimeline: TimelineData[] = [
  { ...timeline[0], id: 'middle', startTime: 12, endTime: 14 },
  { ...timeline[1], id: 'other', startTime: 4, endTime: 6 },
  { ...timeline[0], id: 'last', startTime: 22, endTime: 24 },
  { ...timeline[0], id: 'first', startTime: 2, endTime: 3 },
];

const setupNavigation = (selectedIds: string[] = ['first']) => {
  const container = createTimelineContainer();
  const elements = new Map<string, HTMLDivElement>();
  for (const entry of navigationTimeline) {
    const element = document.createElement('div');
    element.dataset.timelineItemId = entry.id;
    element.tabIndex = 0;
    container.append(element);
    elements.set(entry.id, element);
  }
  const onSelectionChange = vi.fn();
  const onFocusItemChange = vi.fn();
  const onSeek = vi.fn();
  renderHook(() =>
    useTimelineGlobalShortcuts({
      selectedIds,
      selectedRowIds: [],
      timeline: navigationTimeline,
      scrollContainerRef: { current: container },
      onSelectionChange,
      onFocusItemChange,
      onSeek,
    }),
  );
  return { container, elements, onSelectionChange, onFocusItemChange, onSeek };
};

describe('legacy Tab action navigation', () => {
  it.each([
    { selected: 'first', shiftKey: false, next: 'middle', time: 12 },
    { selected: 'middle', shiftKey: true, next: 'first', time: 2 },
    { selected: 'last', shiftKey: false, next: 'first', time: 2 },
    { selected: 'first', shiftKey: true, next: 'last', time: 22 },
    { selected: 'other', shiftKey: false, next: 'other', time: 4 },
  ])(
    'moves $selected to $next with Shift=$shiftKey and moves DOM focus',
    ({ selected, shiftKey, next, time }) => {
      const { elements, onSelectionChange, onFocusItemChange, onSeek } =
        setupNavigation([selected]);
      const element = elements.get(selected)!;
      element.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(onSelectionChange).toHaveBeenCalledExactlyOnceWith([next]);
      expect(onFocusItemChange).toHaveBeenCalledExactlyOnceWith(next);
      expect(onSeek).toHaveBeenCalledExactlyOnceWith(time);
      expect(document.activeElement).toBe(elements.get(next));
    },
  );

  it('supports Tab after mouse selection leaves focus on the timeline surface', () => {
    const { container, elements, onSelectionChange } = setupNavigation();
    dispatchKey(container, 'Tab');
    expect(onSelectionChange).toHaveBeenCalledWith(['middle']);
    expect(document.activeElement).toBe(elements.get('middle'));
  });

  it.each(['metaKey', 'ctrlKey', 'altKey'] as const)(
    'does not consume OS or application %s+Tab combinations',
    (modifier) => {
      const { elements, onSelectionChange, onSeek } = setupNavigation();
      for (const shiftKey of [false, true]) {
        const event = new KeyboardEvent('keydown', {
          key: 'Tab',
          [modifier]: true,
          shiftKey,
          bubbles: true,
          cancelable: true,
        });
        elements.get('first')!.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
      expect(onSelectionChange).not.toHaveBeenCalled();
      expect(onSeek).not.toHaveBeenCalled();
    },
  );

  it.each([{ selected: [] }, { selected: ['missing'] }])(
    'keeps native Tab when there is no valid selection: %j',
    ({ selected }) => {
      const { container, onSelectionChange } = setupNavigation(selected);
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(onSelectionChange).not.toHaveBeenCalled();
    },
  );

  it('keeps native focus navigation in editable fields, controls, dialogs and outside the timeline', () => {
    const { container, onSelectionChange, onSeek } = setupNavigation();
    const targets: HTMLElement[] = [
      'input',
      'textarea',
      'select',
      'button',
    ].map((tag) => document.createElement(tag));
    const editable = document.createElement('div');
    editable.setAttribute('contenteditable', 'true');
    const text = document.createElement('span');
    editable.append(text);
    const textbox = document.createElement('div');
    textbox.setAttribute('role', 'textbox');
    const slider = document.createElement('div');
    slider.setAttribute('role', 'slider');
    const row = document.createElement('button');
    row.dataset.testid = 'timeline-row-header-row';
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const dialogItem = document.createElement('div');
    dialogItem.dataset.timelineItemId = 'first';
    dialog.append(dialogItem);
    container.append(...targets, editable, textbox, slider, row, dialog);
    for (const target of [
      ...targets,
      text,
      textbox,
      slider,
      row,
      dialogItem,
      document.body,
    ]) {
      for (const shiftKey of [false, true]) {
        const event = new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey,
          bubbles: true,
          cancelable: true,
        });
        target.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
      }
    }
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onSeek).not.toHaveBeenCalled();
  });

  it('does not move selection during composition or after another handler consumes the key', () => {
    const { elements, onSelectionChange } = setupNavigation();
    for (const composing of [true, false]) {
      const event = new KeyboardEvent('keydown', {
        key: 'Tab',
        isComposing: composing,
        bubbles: true,
        cancelable: true,
      });
      if (!composing) event.preventDefault();
      elements.get('first')!.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(!composing);
    }
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it.each([
    ['ArrowDown', 'first', 'middle', 12],
    ['ArrowUp', 'first', 'last', 22],
  ] as const)('retains Alt+%s navigation', (key, selected, next, time) => {
    const { container, onSelectionChange, onSeek } = setupNavigation([
      selected,
    ]);
    dispatchKey(container, key, { altKey: true });
    expect(onSelectionChange).toHaveBeenCalledWith([next]);
    expect(onSeek).toHaveBeenCalledWith(time);
  });
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

it('supports editing, select all and native Tab after Escape clears selection', () => {
  const container = createTimelineContainer();
  const item = document.createElement('div');
  item.dataset.timelineItemId = 'item-2';
  container.append(item);
  const onEditItem = vi.fn(),
    onSelectAll = vi.fn(),
    onClearSelection = vi.fn();
  const { rerender } = renderHook(
    ({ selectedIds }) =>
      useTimelineGlobalShortcuts({
        selectedIds,
        selectedRowIds: [],
        timeline,
        scrollContainerRef: { current: container },
        onSelectionChange: vi.fn(),
        onSeek: vi.fn(),
        onEditItem,
        onSelectAll,
        onClearSelection,
      }),
    { initialProps: { selectedIds: ['item-1'] } },
  );
  dispatchKey(item, 'Enter');
  dispatchKey(container, 'a', { ctrlKey: true });
  dispatchKey(container, 'Escape');
  rerender({ selectedIds: [] });
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
