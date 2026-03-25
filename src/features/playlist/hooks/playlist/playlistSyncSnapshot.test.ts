import { describe, expect, it } from 'vitest';
import type { PlaylistSyncData } from '../../../../types/Playlist';
import { buildPlaylistSyncSnapshot } from './playlistSyncSnapshot';

const createSyncData = (
  overrides?: Partial<PlaylistSyncData>,
): PlaylistSyncData => {
  return {
    state: {
      playlists: [
        {
          id: 'playlist-1',
          name: 'Review',
          type: 'embedded',
          items: [
            {
              id: 'item-1',
              timelineItemId: 'timeline-1',
              actionName: 'Carry',
              startTime: 10,
              endTime: 15,
              addedAt: 1,
              annotation: {
                objects: [],
                freezeAt: 0,
                freezeDuration: 0,
              },
            },
          ],
          createdAt: 1,
          updatedAt: 1,
          sourcePackagePath: '/package/from-playlist',
        },
      ],
      activePlaylistId: 'playlist-1',
      playingItemId: 'item-1',
      loopMode: 'none',
    },
    videoPath: '/video/a.mp4',
    videoPath2: '/video/b.mp4',
    videoSources: [],
    currentTime: 12,
    ...overrides,
  };
};

describe('buildPlaylistSyncSnapshot', () => {
  it('normalizes active playlist state into a sync snapshot', () => {
    const snapshot = buildPlaylistSyncSnapshot(
      createSyncData({
        packagePath: '/package/from-sync',
        videoSources: ['/video/a.mp4', '/video/b.mp4'],
      }),
    );

    expect(snapshot).toEqual({
      items: [
        {
          id: 'item-1',
          timelineItemId: 'timeline-1',
          actionName: 'Carry',
          startTime: 10,
          endTime: 15,
          addedAt: 1,
          annotation: {
            objects: [],
            freezeAt: 0,
            freezeDuration: 0,
          },
        },
      ],
      playlistName: 'Review',
      hasUnsavedChanges: false,
      itemAnnotations: {
        'item-1': {
          objects: [],
          freezeAt: 0,
          freezeDuration: 0,
        },
      },
      playlistType: 'embedded',
      packagePath: '/package/from-sync',
      videoSources: ['/video/a.mp4', '/video/b.mp4'],
      viewMode: 'dual',
    });
  });

  it('falls back to item-derived view mode and package path when embedded sources are absent', () => {
    const snapshot = buildPlaylistSyncSnapshot(createSyncData());

    expect(snapshot?.packagePath).toBe('/package/from-playlist');
    expect(snapshot?.viewMode).toBe('angle1');
  });
});
