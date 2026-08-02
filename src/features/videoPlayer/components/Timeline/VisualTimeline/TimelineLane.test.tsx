/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../../theme';
import type { TimelineData } from '../../../../../types/timeline/core';
import { TimelineLane } from './TimelineLane';

const timelineItem: TimelineData = {
  id: 'instance-1',
  actionName: 'Attack',
  startTime: 10,
  endTime: 20,
  memo: '',
  color: '#ff0000',
};

const renderLane = (overrides: Record<string, unknown> = {}) => {
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
    currentTimePosition: 100,
    formatTime: (seconds: number) => String(seconds),
    firstTeamName: 'Attack',
    onSeek: vi.fn(),
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
  it('creates an instance by dragging the playhead with Option + Command', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 30,
      width: 1000,
      height: 30,
      toJSON: () => ({}),
    });
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

  it('requires Option + Command to resize an instance edge', () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 1000,
      bottom: 30,
      width: 1000,
      height: 30,
      toJSON: () => ({}),
    });
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
      altKey: true,
      metaKey: true,
    });
    fireEvent.mouseMove(document, { clientX: 50 });
    fireEvent.mouseUp(document);
    expect(onUpdateTimeRange).toHaveBeenCalledWith('instance-1', 5, 20);
  });
});
