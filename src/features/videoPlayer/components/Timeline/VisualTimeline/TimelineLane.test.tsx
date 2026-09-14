/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../../theme';
import type { TimelineData } from '../../../../../types/timeline/core';
import type { TimelineLaneProps } from './TimelineLane.types';
import { TimelineLane } from './TimelineLane';

const timelineItem: TimelineData = {
  id: 'instance-1',
  actionName: 'Attack',
  startTime: 10,
  endTime: 20,
  memo: '',
  color: '#ff0000',
};

const renderLane = (overrides: Partial<TimelineLaneProps> = {}): void => {
  const props = {
    rowId: 'row-attack',
    actionName: 'Attack',
    rowColor: '#123456',
    isRowSelected: false,
    items: [timelineItem],
    selectedIds: [],
    hoveredItemId: null,
    focusedItemId: null,
    onHoverChange: vi.fn(),
    onItemClick: vi.fn(),
    onItemContextMenu: vi.fn(),
    onRowClick: vi.fn(),
    onRowContextMenu: vi.fn(),
    onRowDragStart: vi.fn(),
    onRowDragOver: vi.fn(),
    onRowDrop: vi.fn(),
    timeToPosition: (time: number) => time * 10,
    positionToTime: (position: number) => position / 10,
    clientXToContentX: (clientX: number) => clientX,
    currentTimePosition: 100,
    formatTime: (seconds: number) => String(seconds),
    firstTeamName: 'Attack',
    maxSec: 100,
    contentWidth: 1000,
    zoomScale: 1,
    ...overrides,
  };

  render(
    <ThemeProvider theme={getAppTheme()}>
      <TimelineLane {...props} />
    </ThemeProvider>,
  );
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('TimelineLane', () => {
  it('renders the visible instance body at the exact time-proportional width', () => {
    renderLane();

    const instance = screen.getByTestId('timeline-instance-instance-1');
    expect(getComputedStyle(instance).left).toBe('100px');
    expect(getComputedStyle(instance).width).toBe('100px');
    expect(getComputedStyle(instance).boxSizing).toBe('border-box');
  });

  it('does not inflate the visible body of a very short instance', () => {
    renderLane({
      items: [{ ...timelineItem, startTime: 10, endTime: 10.2 }],
    });

    const instance = screen.getByTestId('timeline-instance-instance-1');
    expect(Number.parseFloat(getComputedStyle(instance).width)).toBeCloseTo(2);
  });

  it('creates a range from the fixed playhead with Option + Command', () => {
    const onCreateItem = vi.fn();
    renderLane({ onCreateItem });

    fireEvent.mouseDown(screen.getByTestId('timeline-playhead-Attack'), {
      altKey: true,
      metaKey: true,
      clientX: 100,
    });
    fireEvent.mouseMove(document, { clientX: 600 });
    fireEvent.mouseUp(document);

    expect(onCreateItem).toHaveBeenCalledWith('Attack', 10, 60, '#123456');
  });

  it('lets normal pointer input pass through the line in a lane', () => {
    const onCreateItem = vi.fn();
    renderLane({ onCreateItem });
    const line = screen.getByTestId('timeline-playhead-Attack');
    expect(getComputedStyle(line).pointerEvents).toBe('none');
    fireEvent.mouseDown(line, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 600 });
    fireEvent.mouseUp(document);
    expect(onCreateItem).not.toHaveBeenCalled();
  });

  it('cancels a range draft when the edit modifier is released', () => {
    const onCreateItem = vi.fn();
    renderLane({ onCreateItem });
    fireEvent.mouseDown(screen.getByTestId('timeline-playhead-Attack'), {
      altKey: true,
      metaKey: true,
      clientX: 100,
    });
    fireEvent.mouseMove(document, { clientX: 600 });
    expect(screen.getByTestId('timeline-create-preview')).toBeTruthy();
    fireEvent.keyUp(window, { key: 'Alt', altKey: false, metaKey: true });
    fireEvent.mouseUp(document);
    expect(screen.queryByTestId('timeline-create-preview')).toBeNull();
    expect(onCreateItem).not.toHaveBeenCalled();
  });

  it('requires Option + Command but does not require prior selection to resize an edge', () => {
    const onUpdateTimeRange = vi.fn();
    renderLane({ onUpdateTimeRange });

    fireEvent.mouseDown(screen.getByLabelText('開始位置を調整'), {
      altKey: true,
      metaKey: false,
    });
    fireEvent.mouseMove(document, { clientX: 50 });
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByLabelText('開始位置を調整'), {
      altKey: false,
      metaKey: true,
    });
    fireEvent.mouseMove(document, { clientX: 50 });
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).not.toHaveBeenCalled();

    fireEvent.mouseDown(screen.getByLabelText('開始位置を調整'), {
      altKey: true,
      metaKey: true,
    });
    fireEvent.mouseMove(document, { clientX: 50 });
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).toHaveBeenCalledWith('instance-1', 5, 20);
  });

  it('resizes an unselected instance with Alt + Ctrl without changing the other selection', () => {
    const onUpdateTimeRange = vi.fn();
    const onItemClick = vi.fn();
    renderLane({
      onUpdateTimeRange,
      onItemClick,
      selectedIds: ['other-instance'],
    });
    const edge = screen.getByLabelText('終了位置を調整');
    fireEvent.mouseDown(edge, { altKey: true, ctrlKey: true });
    fireEvent.mouseMove(document, { clientX: 250 });
    expect(
      getComputedStyle(screen.getByTestId('timeline-instance-instance-1'))
        .width,
    ).toBe('150px');
    expect(onUpdateTimeRange).not.toHaveBeenCalled();
    fireEvent.mouseUp(document);
    fireEvent.click(edge, { altKey: true, ctrlKey: true });
    expect(onUpdateTimeRange).toHaveBeenCalledExactlyOnceWith(
      'instance-1',
      10,
      25,
    );
    expect(onItemClick).not.toHaveBeenCalled();
  });

  it('discards the resize preview when the edit modifier is released', () => {
    const onUpdateTimeRange = vi.fn();
    renderLane({
      onUpdateTimeRange,
      selectedIds: ['instance-1'],
    });

    fireEvent.keyDown(window, { key: 'Meta', metaKey: true, altKey: true });
    fireEvent.mouseDown(screen.getByLabelText('終了位置を調整'), {
      altKey: true,
      metaKey: true,
    });
    fireEvent.mouseMove(document, { clientX: 250 });
    expect(onUpdateTimeRange).not.toHaveBeenCalled();
    expect(
      getComputedStyle(screen.getByTestId('timeline-instance-instance-1'))
        .width,
    ).toBe('150px');

    fireEvent.keyUp(window, { key: 'Alt', altKey: false, metaKey: true });
    fireEvent.mouseMove(document, { clientX: 300 });
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).not.toHaveBeenCalled();
    expect(
      getComputedStyle(screen.getByTestId('timeline-instance-instance-1'))
        .width,
    ).toBe('100px');
  });
  it('commits a whole resize once and cancels the next gesture with Escape', () => {
    const onUpdateTimeRange = vi.fn();
    renderLane({ onUpdateTimeRange, selectedIds: ['instance-1'] });
    const edge = screen.getByLabelText('終了位置を調整');
    fireEvent.mouseDown(edge, { altKey: true, metaKey: true });
    for (const clientX of [210, 230, 250])
      fireEvent.mouseMove(document, { clientX });
    expect(onUpdateTimeRange).not.toHaveBeenCalled();
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).toHaveBeenCalledExactlyOnceWith(
      'instance-1',
      10,
      25,
    );
    onUpdateTimeRange.mockClear();
    fireEvent.mouseDown(edge, { altKey: true, metaKey: true });
    fireEvent.mouseMove(document, { clientX: 300 });
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).not.toHaveBeenCalled();
    expect(
      getComputedStyle(screen.getByTestId('timeline-instance-instance-1'))
        .width,
    ).toBe('100px');
  });
  it('does not create history for a resize without movement', () => {
    const onUpdateTimeRange = vi.fn();
    renderLane({ onUpdateTimeRange, selectedIds: ['instance-1'] });
    fireEvent.mouseDown(screen.getByLabelText('終了位置を調整'), {
      altKey: true,
      metaKey: true,
    });
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).not.toHaveBeenCalled();
  });
});
