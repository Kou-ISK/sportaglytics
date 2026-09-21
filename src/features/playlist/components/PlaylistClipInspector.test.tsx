// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlaylistClipInspector } from './PlaylistClipInspector';

const item = {
  id: 'clip-1',
  timelineItemId: 'timeline-1',
  actionName: 'Scrum',
  startTime: 12,
  endTime: 20.2,
  labels: [{ name: 'Own', group: 'team' }],
  note: 'Good initial hit',
  addedAt: 1,
  videoSource: '/video/angle-1.mp4',
};

describe('PlaylistClipInspector', () => {
  it('shows selected clip details and keeps editing/playback as callbacks', () => {
    const onEditNote = vi.fn();
    const onPlay = vi.fn();
    render(
      <PlaylistClipInspector
        item={item}
        annotation={{ objects: [], freezeAt: 0, freezeDuration: 3 }}
        width={280}
        onEditNote={onEditNote}
        onPlay={onPlay}
        onUpdateNote={vi.fn()}
      />,
    );

    expect(screen.getByText('Scrum')).toBeTruthy();
    expect(screen.getByDisplayValue('Good initial hit')).toBeTruthy();
    expect(screen.getByText(/Freeze 3.0s/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('クリップを再生'));
    fireEvent.click(screen.getByLabelText('ノートを編集'));
    expect(onPlay).toHaveBeenCalledWith('clip-1');
    expect(onEditNote).toHaveBeenCalledWith('clip-1');
  });

  it('has an explicit empty state', () => {
    render(
      <PlaylistClipInspector
        item={null}
        width={280}
        onEditNote={vi.fn()}
        onPlay={vi.fn()}
        onUpdateNote={vi.fn()}
      />,
    );
    expect(
      screen.getByText('クリップを選択すると詳細を表示します。'),
    ).toBeTruthy();
  });
});
