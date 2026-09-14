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
    'changes unselected %s while keeping playback and selection fixed',
    (label) => {
      const item = screen.getByTestId('timeline-instance-row-0-1');
      const edge = item.querySelector(`[aria-label="${label}"]`);
      if (!edge) throw new Error('Missing resize handle');
      fireEvent.mouseDown(edge, { button: 0, metaKey: true, altKey: true });
      fireEvent.mouseMove(document, { clientX: 250 });
      fireEvent.mouseUp(document);
      fireEvent.click(edge, { metaKey: true, altKey: true });
      expect(update).toHaveBeenCalled();
      expect(seek).not.toHaveBeenCalled();
      expect(item.getAttribute('aria-pressed')).toBe('false');
    },
  );
  it('does not seek from the ruler, while the top handle supports keyboard seeking', () => {
    const ruler = screen.getByTestId('timeline-time-origin');
    fireEvent.pointerDown(ruler, { button: 0, clientX: 200 });
    fireEvent.pointerMove(ruler, { clientX: 300 });
    fireEvent.pointerUp(ruler, { clientX: 300 });
    expect(seek).not.toHaveBeenCalled();
    fireEvent.keyDown(
      screen.getByRole('slider', { name: 'タイムラインの再生位置' }),
      { key: 'End' },
    );
    expect(seek).toHaveBeenCalledWith(120);
  });
});
