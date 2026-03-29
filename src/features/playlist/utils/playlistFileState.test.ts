import { describe, expect, it } from 'vitest';
import type { Playlist } from '../../../types/Playlist';
import {
  buildLoadedPlaylistSnapshot,
  buildPlaylistPayload,
} from './playlistFileState';

describe('playlistFileState', () => {
  it('builds playlist payload with inherited sources and annotations', () => {
    const payload = buildPlaylistPayload({
      items: [
        {
          id: 'item-1',
          timelineItemId: 'timeline-1',
          actionName: 'Pass',
          startTime: 5,
          endTime: 10,
          addedAt: 1,
        },
      ],
      videoSources: ['/video/a.mp4', '/video/b.mp4'],
      packagePath: '/package/demo',
      itemAnnotations: {
        'item-1': {
          objects: [],
          freezeAt: 0,
          freezeDuration: 0,
        },
      },
      name: 'Demo Playlist',
      type: 'embedded',
      createId: () => 'playlist-1',
      now: () => 100,
    });

    expect(payload).toEqual({
      id: 'playlist-1',
      name: 'Demo Playlist',
      type: 'embedded',
      items: [
        {
          id: 'item-1',
          timelineItemId: 'timeline-1',
          actionName: 'Pass',
          startTime: 5,
          endTime: 10,
          addedAt: 1,
          videoSource: '/video/a.mp4',
          videoSource2: '/video/b.mp4',
          annotation: {
            objects: [],
            freezeAt: 0,
            freezeDuration: 0,
          },
        },
      ],
      sourcePackagePath: '/package/demo',
      createdAt: 100,
      updatedAt: 100,
    });
  });

  it('normalizes loaded playlist state for the window runtime', () => {
    const playlist: Playlist = {
      id: 'playlist-1',
      name: 'Loaded',
      type: 'reference',
      items: [
        {
          id: 'item-1',
          timelineItemId: 'timeline-1',
          actionName: 'Carry',
          startTime: 10,
          endTime: 12,
          addedAt: 1,
          videoSource: '/video/a.mp4',
          videoSource2: '/video/b.mp4',
          annotation: {
            objects: [],
            freezeAt: 0,
            freezeDuration: 0,
          },
        },
      ],
      sourcePackagePath: '/package/source',
      createdAt: 1,
      updatedAt: 1,
    };

    expect(buildLoadedPlaylistSnapshot(playlist, '/playlist/demo.playlist')).toEqual(
      {
        items: playlist.items,
        hasUnsavedChanges: false,
        playlistName: 'Loaded',
        playlistType: 'reference',
        packagePath: '/package/source',
        loadedFilePath: '/playlist/demo.playlist',
        isDirty: false,
        itemAnnotations: {
          'item-1': {
            objects: [],
            freezeAt: 0,
            freezeDuration: 0,
          },
        },
        videoSources: ['/video/a.mp4', '/video/b.mp4'],
        viewMode: 'dual',
        currentIndex: 0,
      },
    );
  });
});
