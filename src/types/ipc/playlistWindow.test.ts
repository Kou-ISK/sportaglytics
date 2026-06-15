import { describe, expect, it } from 'vitest';
import type { PlaylistCommand, PlaylistSyncData } from '../playlist/window';
import {
  isPlaylistCommand,
  isPlaylistItem,
  isPlaylistSyncData,
} from './playlistWindow';

const playlistItem = {
  id: 'item-1',
  timelineItemId: 'timeline-1',
  actionName: 'Carry',
  startTime: 10,
  endTime: 15,
  addedAt: 1,
};

describe('playlistWindow IPC guards', () => {
  it('accepts valid playlist items and sync payloads', () => {
    const syncPayload: PlaylistSyncData = {
      state: {
        playlists: [
          {
            id: 'playlist-1',
            name: 'Review',
            type: 'embedded',
            items: [playlistItem],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        activePlaylistId: 'playlist-1',
        playingItemId: 'item-1',
        loopMode: 'none',
      },
      videoPath: '/video/a.mp4',
      videoPath2: null,
      videoSources: ['/video/a.mp4'],
      currentTime: 12,
      packagePath: '/package',
    };

    expect(isPlaylistItem(playlistItem)).toBe(true);
    expect(isPlaylistSyncData(syncPayload)).toBe(true);
  });

  it('rejects invalid playlist commands', () => {
    const validCommand: PlaylistCommand = {
      type: 'play-item',
      itemId: 'item-1',
    };

    expect(isPlaylistCommand(validCommand)).toBe(true);
    expect(isPlaylistCommand({ type: 'seek', time: '10' })).toBe(false);
    expect(
      isPlaylistCommand({ type: 'save-playlist', playlist: { id: 'broken' } }),
    ).toBe(false);
  });
});
