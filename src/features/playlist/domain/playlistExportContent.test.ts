import { describe, expect, it } from 'vitest';
import type { PlaylistItem } from '../../../types/playlist/core';
import { getPlaylistExportSelection } from './playlistExportContent';

const video: PlaylistItem = {
  id: 'clip', timelineItemId: 'clip', actionName: 'Try', startTime: 3,
  endTime: 6, addedAt: 0, videoSource: 'match.mp4',
};
const slide: PlaylistItem = {
  ...video, id: 'slide', startTime: 0, endTime: 5,
  slide: { title: 'Lineout', body: '' },
};
const items = [slide, video];

describe('playlist MP4 content selection', () => {
  it('includes titles in their original order without touching video timing', () => {
    expect(getPlaylistExportSelection(items, [], 'all', true)).toEqual({
      items, availableSlideCount: 1, hasVideo: true,
    });
    expect(getPlaylistExportSelection(items, [], 'all', false)).toEqual({
      items: [video], availableSlideCount: 1, hasVideo: true,
    });
  });

  it('permits a slide-only selection, then blocks empty output when slides are excluded', () => {
    expect(getPlaylistExportSelection(items, [slide], 'selected', true)).toEqual({
      items: [slide], availableSlideCount: 1, hasVideo: false,
    });
    expect(getPlaylistExportSelection(items, [slide], 'selected', false)).toEqual({
      items: [], availableSlideCount: 1, hasVideo: false,
    });
    expect(getPlaylistExportSelection(items, [], 'selected', true)).toEqual({
      items: [], availableSlideCount: 0, hasVideo: false,
    });
  });
});
