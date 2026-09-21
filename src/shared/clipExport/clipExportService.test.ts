import { describe, expect, it, vi } from 'vitest';
import type { ClipExportItem } from './clipExportTypes';
import {
  executeClipExport,
  buildClipExportRequests,
  resolveClipExportSourceSelection,
  validateClipExportSources,
} from './clipExportService';

const sampleClips: ClipExportItem[] = [
  {
    id: 'clip-1',
    actionName: 'Try',
    startTime: 12,
    endTime: 16,
  },
];

describe('clipExportService', () => {
  it('resolves multi-angle sources from available video sources', () => {
    const resolved = resolveClipExportSourceSelection(
      [' main.mp4 ', 'sub.mp4'],
      undefined,
      undefined,
    );

    expect(resolved).toEqual({
      sourcePath: 'main.mp4',
      sourcePath2: 'sub.mp4',
    });
  });

  it('validates single-angle selection', () => {
    const validationMessage = validateClipExportSources({
      angleOption: 'single',
      videoSources: ['main.mp4'],
      selectedAngleIndex: 1,
      resolvedSources: {},
    });

    expect(validationMessage).toBe('選択されたアングルの映像が取得できません');
  });

  it('executes all-angle export with suffixed file names and progress updates', async () => {
    const executeExport = vi.fn().mockResolvedValue({ success: true });
    const onProgress = vi.fn();

    const result = await executeClipExport({
      executeExport,
      clips: sampleClips,
      videoSources: ['main.mp4', 'sub.mp4'],
      angleOption: 'allAngles',
      selectedAngleIndex: 0,
      resolvedSources: {},
      exportMode: 'single',
      exportFileName: 'playlist-export',
      overlay: {
        enabled: true,
        showActionName: true,
        showActionIndex: true,
        showLabels: true,
        showMemo: true,
      },
      successMessage: 'unused',
      onProgress,
    });

    expect(result).toEqual({
      success: true,
      message: '全2アングルの書き出しが完了しました',
    });
    expect(executeExport).toHaveBeenNthCalledWith(1, {
      sourcePath: 'main.mp4',
      sourcePath2: undefined,
      mode: 'single',
      exportMode: 'single',
      angleOption: 'single',
      outputFileName: 'playlist-export_angle1',
      clips: sampleClips,
      overlay: {
        enabled: true,
        showActionName: true,
        showActionIndex: true,
        showLabels: true,
        showMemo: true,
      },
    });
    expect(executeExport).toHaveBeenNthCalledWith(2, {
      sourcePath: 'sub.mp4',
      sourcePath2: undefined,
      mode: 'single',
      exportMode: 'single',
      angleOption: 'single',
      outputFileName: 'playlist-export_angle2',
      clips: sampleClips,
      overlay: {
        enabled: true,
        showActionName: true,
        showActionIndex: true,
        showLabels: true,
        showMemo: true,
      },
    });
    expect(onProgress).toHaveBeenCalledWith({
      current: 1,
      total: 2,
      message: 'アングル1 / 2 を書き出し中...',
    });
    expect(onProgress).toHaveBeenCalledWith({
      current: 2,
      total: 2,
      message: 'アングル2 / 2 を書き出し中...',
    });
    expect(onProgress).toHaveBeenLastCalledWith(null);
  });
});

it('selects each playlist item’s own secondary source and Paint layers for single and all-angle exports', async () => {
  const clips = [
    {
      ...sampleClips[0],
      videoSource: 'first-main.mp4',
      videoSource2: 'first-sub.mp4',
    },
    {
      ...sampleClips[0],
      id: 'clip-2',
      videoSource: 'second-main.mp4',
      videoSource2: 'second-sub.mp4',
    },
  ];
  for (const angleOption of ['single', 'allAngles'] as const) {
    const executeExport = vi.fn().mockResolvedValue({ success: true });
    const result = await executeClipExport({
      executeExport,
      clips,
      videoSources: ['first-main.mp4', 'first-sub.mp4'],
      angleOption,
      selectedAngleIndex: 1,
      resolvedSources: {},
      exportMode: 'single',
      exportFileName: 'paint',
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
      successMessage: 'done',
    });
    expect(result.success).toBe(true);
    expect(executeExport.mock.lastCall?.[0].clips).toEqual(
      clips.map((clip) => ({ ...clip, angleType: 'angle2' })),
    );
    if (angleOption === 'allAngles')
      expect(executeExport.mock.calls[0][0].clips[0].angleType).toBe('angle1');
  }
});

it.each(['single', 'allAngles', 'multi'] as const)(
  'fails before exporting if one playlist item lacks the chosen angle (%s)',
  async (angleOption) => {
    const executeExport = vi.fn();
    const result = await executeClipExport({
      executeExport,
      clips: [{ ...sampleClips[0], videoSource: 'main.mp4' }],
      videoSources: ['main.mp4', 'sub.mp4'],
      angleOption,
      selectedAngleIndex: 1,
      resolvedSources: { sourcePath: 'main.mp4', sourcePath2: 'sub.mp4' },
      exportMode: 'single',
      exportFileName: '',
      overlay: {
        enabled: false,
        showActionName: false,
        showActionIndex: false,
        showLabels: false,
        showMemo: false,
      },
      successMessage: 'done',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('アングルがない');
    expect(executeExport).not.toHaveBeenCalled();
  },
);

const angleRequest = {
  videoSources: ['one.mp4', 'two.mp4'],
  selectedAngleIndex: 0,
  resolvedSources: { sourcePath: 'one.mp4', sourcePath2: 'two.mp4' },
  exportMode: 'single' as const,
  exportFileName: 'review',
  overlay: {
    enabled: false,
    showActionName: false,
    showActionIndex: false,
    showLabels: false,
    showMemo: false,
  },
};
const mixedClips: ClipExportItem[] = [
  {
    ...sampleClips[0],
    videoSource: 'first-one.mp4',
    videoSource2: 'first-two.mp4',
    angleType: 'angle1',
  },
  {
    ...sampleClips[0],
    id: 'second',
    videoSource: 'second-one.mp4',
    videoSource2: 'second-two.mp4',
    angleType: 'angle2',
    annotationPngSecondary: 'secondary-paint',
  },
];
it('keeps per-instance angles and Paint in one single-file export request', () => {
  const requests = buildClipExportRequests({
    ...angleRequest,
    angleOption: 'defaultAngles',
    clips: mixedClips,
  });
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    mode: 'single',
    exportMode: 'single',
    clips: mixedClips,
  });
});
it('allows an explicit fixed-angle override, and removes single-angle hints for dual export', () => {
  const fixed = buildClipExportRequests({
    ...angleRequest,
    angleOption: 'single',
    clips: mixedClips,
  });
  expect(fixed[0].clips.map((clip) => clip.angleType)).toEqual([
    'angle1',
    'angle1',
  ]);
  const dual = buildClipExportRequests({
    ...angleRequest,
    angleOption: 'multi',
    clips: mixedClips,
  });
  expect(dual[0].mode).toBe('dual');
  expect(dual[0].clips.every((clip) => clip.angleType === undefined)).toBe(
    true,
  );
});
it('rejects a missing default angle instead of substituting a different clip or angle', () => {
  expect(() =>
    buildClipExportRequests({
      ...angleRequest,
      angleOption: 'defaultAngles',
      clips: [{ ...mixedClips[1], videoSource2: undefined }],
    }),
  ).toThrow('既定アングルの映像がない');
});
