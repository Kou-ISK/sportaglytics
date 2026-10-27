import { describe, expect, it } from 'vitest';
import { buildClipExportRequests } from './clipExportService';
import { isClipExportAudioSelections } from './clipExportAudio';
import type { ClipExportAngleOption, ClipExportItem } from './clipExportTypes';
const clip: ClipExportItem = {
  id: 'one',
  actionName: 'Example',
  startTime: 1.25,
  endTime: 3.5,
};
const build = (
  angleOption: ClipExportAngleOption,
  clips = [clip],
  selectedAngleIndex = 0,
) =>
  buildClipExportRequests({
    clips,
    angleOption,
    selectedAngleIndex,
    videoSources: ['/a.mp4', '/b.mp4'],
    resolvedSources: { sourcePath: '/b.mp4', sourcePath2: '/a.mp4' },
    exportMode: 'single',
    exportFileName: '',
    overlay: {
      enabled: false,
      showActionName: false,
      showActionIndex: false,
      showLabels: false,
      showMemo: false,
    },
    audioSelections: [
      { source: '/a.mp4', audioTrackIndex: 2 },
      { source: '/b.mp4', audioTrackIndex: 0 },
    ],
  });
describe('source-bound playback audio in export', () => {
  it('selects each final angle independently and preserves exact ranges', () => {
    expect(build('single')[0].clips[0]).toEqual({
      ...clip,
      audioTrackIndex: 2,
    });
    expect(build('single', [clip], 1)[0].clips[0].audioTrackIndex).toBe(0);
    expect(build('allAngles').map((p) => p.clips[0].audioTrackIndex)).toEqual([
      2, 0,
    ]);
    expect(build('multi')[0].clips[0].audioTrackIndex).toBe(0);
    expect(clip.audioTrackIndex).toBeUndefined();
  });
  it('respects per-clip sources and explicit indices across packages/default angles', () => {
    const entries: ClipExportItem[] = [
      {
        ...clip,
        videoSource: '/a.mp4',
        videoSource2: '/b.mp4',
        angleType: 'angle2',
      },
      { ...clip, id: 'elsewhere', videoSource: '/other-package.mp4' },
      { ...clip, id: 'explicit', videoSource: '/a.mp4', audioTrackIndex: 0 },
    ];
    expect(
      build('defaultAngles', entries)[0].clips.map((c) => c.audioTrackIndex),
    ).toEqual([0, undefined, 0]);
    expect(build('single', [entries[0]], 1)[0].clips[0].audioTrackIndex).toBe(
      0,
    );
  });
  it.each([null, -1, 1.5, Number.NaN, 64])(
    'rejects unconfirmed/invalid selection %s only for the selected source',
    (index) => {
      const request = build('single')[0];
      expect(() =>
        buildClipExportRequests({
          ...request,
          angleOption: 'single',
          selectedAngleIndex: 0,
          videoSources: ['/a.mp4'],
          resolvedSources: { sourcePath: '/a.mp4' },
          exportMode: 'single',
          exportFileName: '',
          clips: [clip],
          audioSelections: [{ source: '/a.mp4', audioTrackIndex: index }],
        }),
      ).toThrow('音声トラック');
    },
  );
  it('validates map membership, uniqueness and index at the IPC boundary', () => {
    expect(
      isClipExportAudioSelections(
        [{ source: '/a', audioTrackIndex: null }],
        ['/a'],
      ),
    ).toBe(true);
    for (const input of [
      null,
      [{ source: '/other', audioTrackIndex: 1 }],
      [{ source: '/a', audioTrackIndex: 64 }],
      [{ source: '/a', audioTrackIndex: 0, extra: true }],
      [
        { source: '/a', audioTrackIndex: 0 },
        { source: '/a', audioTrackIndex: 1 },
      ],
    ])
      expect(isClipExportAudioSelections(input, ['/a', '/b'])).toBe(false);
  });
});
