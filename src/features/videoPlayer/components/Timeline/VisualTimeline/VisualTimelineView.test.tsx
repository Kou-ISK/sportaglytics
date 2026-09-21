// @vitest-environment jsdom
import { useState } from 'react';
import type { ReactElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../../theme';
import { ActionPresetProvider } from '../../../../../contexts/ActionPresetContext';
import { NotificationProvider } from '../../../../../contexts/NotificationProvider';
import { VisualTimelineView } from './VisualTimelineView';
import { useVisualTimelineController } from './hooks/useVisualTimelineController';
import { reviewTimeline, reviewRows } from '../../../fixtures/timelineReview';

const seek = vi.fn();
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
    currentTime: 45,
    maxSec: 120,
    onDelete: vi.fn(),
    onUpdateTimeRange: update,
  });
  return <VisualTimelineView {...props} />;
};
beforeEach(() => {
  seek.mockClear();
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
      fireEvent.mouseUp(document);
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
    expect(seek).toHaveBeenCalled();
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
});
