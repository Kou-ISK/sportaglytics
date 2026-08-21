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

    dispatchKey(window, 'p', { metaKey: true, shiftKey: true });

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
    if (kind === 'contenteditable') target.setAttribute('contenteditable', 'true');
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
