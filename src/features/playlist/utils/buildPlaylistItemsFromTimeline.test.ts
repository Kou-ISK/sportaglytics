import { describe, expect, it } from 'vitest';
import { buildPlaylistItemsFromTimeline } from './buildPlaylistItemsFromTimeline';

describe('buildPlaylistItemsFromTimeline', () => {
  it('maps timeline items with deterministic ids, timestamps, and video sources', () => {
    const playlistItems = buildPlaylistItemsFromTimeline(
      [
        {
          id: 'timeline-1',
          actionName: 'TeamA Pass',
          startTime: 12,
          endTime: 15,
          memo: 'switch play',
          labels: [{ name: 'success', group: 'result' }],
        },
      ],
      {
        now: () => 100,
        createId: () => 'playlist-1',
        videoSources: {
          primary: '/video/a.mp4',
          secondary: '/video/b.mp4',
        },
      },
    );

    expect(playlistItems).toEqual([
      {
        id: 'playlist-1',
        timelineItemId: 'timeline-1',
        actionName: 'TeamA Pass',
        startTime: 12,
        endTime: 15,
        memo: 'switch play',
        labels: [{ name: 'success', group: 'result' }],
        addedAt: 100,
        videoSource: '/video/a.mp4',
        videoSource2: '/video/b.mp4',
      },
    ]);
  });
});
