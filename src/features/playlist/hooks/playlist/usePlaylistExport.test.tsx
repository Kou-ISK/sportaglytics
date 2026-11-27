// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistItem } from '../../../../types/playlist/core';
import {
  DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
  type ClipExportPayload,
} from '../../../../shared/clipExport/clipExportTypes';
import { usePlaylistExport } from './usePlaylistExport';

vi.mock('../../utils/slideCanvas', () => ({
  renderSlideFrame: async () => 'data:image/png;base64,AA==',
}));

const clip: PlaylistItem = {
  id: 'clip', timelineItemId: null, actionName: 'Lineout',
  startTime: 8, endTime: 12, addedAt: 0, videoSource: 'wide.mp4',
  note: 'Look at the jump',
  annotation: { objects: [{
    id: 'arrow', type: 'arrow', startX: 0, startY: 0, endX: 20, endY: 20,
    color: '#fff', strokeWidth: 3, timestamp: 9,
  }], freezeDuration: 2, freezeAt: 9 },
};
const slide: PlaylistItem = {
  id: 'slide', timelineItemId: null, actionName: 'タイトル',
  startTime: 0, endTime: 3, addedAt: 0, slide: { title: 'Review', body: '' },
};
const size = { width: 1280, height: 720 };
const rect = { ...size, offsetX: 0, offsetY: 0 };

function setup(overrides: Partial<Parameters<typeof usePlaylistExport>[0]> = {}) {
  const exportApi = vi.fn(async (_payload: ClipExportPayload) => ({ success: true }));
  vi.stubGlobal('electronAPI', { exportClipsWithOverlay: exportApi });
  const hook = renderHook(() => usePlaylistExport({
    items: [slide, clip],
    selectedItems: [],
    videoSources: ['wide.mp4'],
    exportMode: 'single',
    exportScope: 'all',
    exportFileName: 'Review',
    content: { includeEffects: true, includeSlides: true },
    angleOption: 'defaultAngles',
    selectedAngleIndex: 0,
    overlaySettings: DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
    itemAnnotations: {},
    minFreezeDuration: 2,
    primaryContentRect: rect,
    secondaryContentRect: rect,
    primarySourceSize: size,
    secondarySourceSize: size,
    renderAnnotationPng: () => 'data:image/png;base64,AA==',
    ...overrides,
  }));
  return {
    exportApi,
    run: () => act(() => hook.result.current.handleExportPlaylist()),
  };
}

afterEach(() => vi.unstubAllGlobals());
const toggles = [false, true];

describe('Playlist MP4 payload', () => {
  it.each(toggles.flatMap((includeEffects) => toggles.flatMap((includeSlides) =>
    toggles.map((includeText) => ({ includeEffects, includeSlides, includeText })))
  ))('keeps content options independent: %j', async ({ includeEffects, includeSlides, includeText }) => {
    const { exportApi, run } = setup({
      content: { includeEffects, includeSlides },
      overlaySettings: { ...DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS, enabled: includeText },
    });
    await run();
    expect(exportApi).toHaveBeenCalledTimes(1);
    const [payload] = exportApi.mock.calls[0];
    expect(payload.overlay.enabled).toBe(includeText);
    expect(payload.clips.map((item) => item.id)).toEqual(includeSlides ? ['slide', 'clip'] : ['clip']);
    const video = payload.clips.find((item) => item.id === 'clip');
    expect(video).toMatchObject({ startTime: 8, endTime: 12, videoSource: 'wide.mp4', memo: clip.note });
    expect(video?.freezeFrames?.length).toBe(includeEffects ? 1 : 0);
  });

  it('passes only slide frames, with no media source, for an included slide-only selection', async () => {
    const { exportApi, run } = setup({
      videoSources: [],
      exportMode: 'organizerRows',
      exportScope: 'selected',
      selectedItems: [slide],
      angleOption: 'allAngles',
    });
    await run();
    expect(exportApi).toHaveBeenCalledTimes(1);
    const [payload] = exportApi.mock.calls[0];
    expect(payload.sourcePath).toBe('');
    expect(payload.overlay.enabled).toBe(false);
    expect(payload.clips).toEqual([expect.objectContaining({
      id: 'slide', endTime: 3, slideFrame: 'data:image/png;base64,AA==',
      organizerRow: expect.objectContaining({ id: expect.any(String) }),
    })]);
  });

  it('never invokes encoder when a slide-only selection is excluded', async () => {
    const { exportApi, run } = setup({
      exportScope: 'selected', selectedItems: [slide],
      content: { includeEffects: true, includeSlides: false },
    });
    await run();
    expect(exportApi).not.toHaveBeenCalled();
  });
});
