// @vitest-environment jsdom
import { useState } from 'react';
import type { ReactElement } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../../theme';
import { ActionPresetProvider } from '../../../../../contexts/ActionPresetContext';
import { NotificationProvider } from '../../../../../contexts/NotificationProvider';
import { VisualTimelineView } from './VisualTimelineView';
import { useVisualTimelineController } from './hooks/useVisualTimelineController';
import { reviewTimeline, reviewRows } from '../../../fixtures/timelineReview';

const seek = vi.fn();
const play = vi.fn();
const update = vi.fn();
const Harness = (): ReactElement => {
  const [selectedIds, onSelectionChange] = useState<string[]>([]);
  const props = useVisualTimelineController({
    teamNames: ['ホーム', 'アウェイ'],
    timeline: reviewTimeline,
    rows: reviewRows,
    selectedIds,
    onSelectionChange,
    onSeek: seek,
    onReviewInstances: play,
    currentTime: 45,
    maxSec: 120,
    onDelete: vi.fn(),
    onUpdateTimeRange: update,
  });
  return <VisualTimelineView {...props} />;
};
beforeEach(() => {
  seek.mockClear();
  play.mockClear();
  update.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      disconnect(): void {}
    },
  );
  render(
    <ThemeProvider theme={getAppTheme()}>
      <NotificationProvider>
        <ActionPresetProvider>
          <Harness />
        </ActionPresetProvider>
      </NotificationProvider>
    </ThemeProvider>,
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
describe('timeline editing and seeking', () => {
  it('leaves a newly opened row menu in control of keyboard focus', async () => {
    fireEvent.contextMenu(screen.getByRole('button', { name: 'アタック 行' }));
    fireEvent.click(
      screen.getByRole('menuitem', { name: '行内のインスタンスを選択' }),
    );
    fireEvent.contextMenu(
      screen.getByRole('button', { name: 'ディフェンス 行' }),
    );
    const menu = screen.getByRole('menu');
    expect(menu.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(menu, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(document.activeElement).toBe(
      screen.getByRole('region', { name: 'タイムライン' }),
    );
  });
  it('does not reclaim focus moved elsewhere while the selected row menu finishes closing', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    try {
      fireEvent.contextMenu(
        screen.getByRole('button', { name: 'アタック 行' }),
      );
      fireEvent.click(
        screen.getByRole('menuitem', { name: '行内のインスタンスを選択' }),
      );
      outside.focus();
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(outside);
    } finally {
      outside.remove();
    }
  });
  it('retains normal focus restoration when the row menu is dismissed without selecting', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    try {
      fireEvent.contextMenu(
        screen.getByRole('button', { name: 'アタック 行' }),
      );
      fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      expect(document.activeElement).toBe(outside);
      expect(
        document.querySelectorAll(
          '[data-timeline-item-id][aria-pressed="true"]',
        ),
      ).toHaveLength(0);
    } finally {
      outside.remove();
    }
  });
  it('keeps keyboard focus in the timeline after selecting row instances from its menu', async () => {
    const outside = document.createElement('button');
    document.body.append(outside);
    outside.focus();
    try {
      fireEvent.contextMenu(
        screen.getByRole('button', { name: 'アタック 行' }),
      );
      fireEvent.click(
        screen.getByRole('menuitem', { name: '行内のインスタンスを選択' }),
      );
      await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
      const timeline = screen.getByRole('region', {
        name: 'タイムライン',
      });
      expect(document.activeElement).toBe(timeline);
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: 'a',
        metaKey: true,
      });
      expect(
        document.querySelectorAll(
          '[data-timeline-item-id][aria-pressed="true"]',
        ),
      ).toHaveLength(reviewTimeline.length);
    } finally {
      outside.remove();
    }
  });
  it('commits the last held preview when its view unmounts', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const ruler = screen.getByTestId('timeline-time-origin');
    ruler.setPointerCapture = vi.fn();
    fireEvent.pointerDown(ruler, { button: 0, clientX: 200 });
    const last = seek.mock.lastCall?.[0];
    cleanup();
    expect(seek).toHaveBeenLastCalledWith(last, 'scrub');
  });
  it('selects an action without seeking and clears its selection and focus border on blank clicks', () => {
    const item = screen.getByTestId('timeline-instance-row-0-0');
    const unselectedBorder = getComputedStyle(item).borderColor;
    fireEvent.click(item);
    expect(getComputedStyle(item).borderColor).not.toBe(unselectedBorder);
    expect(item.getAttribute('aria-pressed')).toBe('true');
    expect(seek).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('timeline-lane-アタック'));
    expect(item.getAttribute('aria-pressed')).toBe('false');
    expect(getComputedStyle(item).borderColor).toBe(unselectedBorder);
  });
  it.each(['開始位置を調整', '終了位置を調整'])(
    'previews an unselected %s at the changed boundary without selecting it',
    (label) => {
      const item = screen.getByTestId('timeline-instance-row-0-1');
      const edge = item.querySelector(`[aria-label="${label}"]`);
      if (!edge) throw new Error('Missing resize handle');
      fireEvent.mouseDown(edge, { button: 0, metaKey: true, altKey: true });
      fireEvent.mouseMove(document, { clientX: 250 });
      fireEvent.mouseUp(document, { clientX: 250 });
      fireEvent.click(edge, { metaKey: true, altKey: true });
      expect(update).toHaveBeenCalled();
      const [, start, end] = update.mock.lastCall ?? [];
      expect(seek).toHaveBeenLastCalledWith(
        label === '開始位置を調整' ? start : end,
      );
      expect(item.getAttribute('aria-pressed')).toBe('false');
    },
  );
  it('seeks from the ruler and supports keyboard seeking on the top handle', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const ruler = screen.getByTestId('timeline-time-origin');
    ruler.setPointerCapture = vi.fn();
    ruler.hasPointerCapture = () => true;
    ruler.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(ruler, { button: 0, clientX: 200 });
    fireEvent.pointerMove(ruler, { clientX: 300 });
    fireEvent.pointerUp(ruler, { clientX: 300 });
    expect(seek.mock.calls.map((call) => call[1])).toEqual([
      'preview',
      'preview',
      'scrub',
    ]);
    seek.mockClear();
    fireEvent.pointerDown(screen.getByTestId('timeline-lane-アタック'), {
      button: 0,
      clientX: 200,
    });
    expect(seek).not.toHaveBeenCalled();
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'タイムラインの再生位置' }),
      { key: 'End' },
    );
    expect(seek).toHaveBeenCalledWith(120);
  });
  it('commits the last preview once on capture loss and ignores late movement', () => {
    vi.stubGlobal('PointerEvent', MouseEvent);
    const ruler = screen.getByTestId('timeline-time-origin');
    ruler.setPointerCapture = vi.fn();
    ruler.hasPointerCapture = () => true;
    ruler.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(ruler, { button: 0, clientX: 200 });
    fireEvent.pointerMove(ruler, { clientX: 400 });
    const last = seek.mock.lastCall?.[0];
    fireEvent.lostPointerCapture(ruler);
    fireEvent.pointerMove(ruler, { clientX: 600 });
    fireEvent.pointerUp(ruler, { clientX: 600 });
    expect(seek.mock.calls).toHaveLength(3);
    expect(seek).toHaveBeenLastCalledWith(last, 'scrub');
  });
});

it('reviews one instance and all row instances, preserving the editing context menu', () => {
  const item = reviewTimeline.find(
    (instance) => instance.actionName === 'アタック',
  )!;
  fireEvent.doubleClick(screen.getByTestId(`timeline-instance-${item.id}`));
  expect(play).toHaveBeenLastCalledWith([item]);
  fireEvent.doubleClick(screen.getByRole('button', { name: 'アタック 行' }));
  expect(play).toHaveBeenLastCalledWith(
    reviewTimeline
      .filter(({ actionName }) => actionName === 'アタック')
      .sort((a, b) => a.startTime - b.startTime),
  );
  fireEvent.contextMenu(screen.getByRole('button', { name: 'アタック 行' }));
  expect(screen.getByRole('menu')).toBeTruthy();
});
