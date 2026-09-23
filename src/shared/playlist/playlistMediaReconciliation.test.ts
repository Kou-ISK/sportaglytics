import { expect, it } from 'vitest';
import type { PlaylistItem } from '../../types/playlist/core';
import { reconcilePlaylistMedia } from './playlistMediaReconciliation';

const item: PlaylistItem = {
  id: 'one',
  timelineItemId: null,
  actionName: 'Review',
  addedAt: 1,
  startTime: 0,
  endTime: 4,
  videoSource: '/old/sample.stpkg/one.mp4',
};

it('preserves concurrent edits and order when a reference resolves', () => {
  const second = { ...item, id: 'two' };
  const edited: PlaylistItem = {
    ...item,
    note: 'New note',
    defaultAngle: 'angle2',
  };
  const result = reconcilePlaylistMedia(
    [second, edited],
    [item],
    [{ ...item, videoSource: '/new/sample.stpkg/one.mp4' }],
  );
  expect(result[0]).toBe(second);
  expect(result[1]).toEqual({
    ...edited,
    videoSource: '/new/sample.stpkg/one.mp4',
  });
});

it('ignores stale results when the user already reconnected the source', () => {
  const current = [{ ...item, videoSource: '/manual/sample.stpkg/one.mp4' }];
  expect(
    reconcilePlaylistMedia(
      current,
      [item],
      [{ ...item, videoSource: '/background/sample.stpkg/one.mp4' }],
    ),
  ).toBe(current);
  expect(reconcilePlaylistMedia([], [item], [item])).toEqual([]);
});
