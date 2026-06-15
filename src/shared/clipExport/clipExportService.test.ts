import { describe, expect, it, vi } from 'vitest';
import type { ClipExportItem } from './clipExportTypes';
import {
  executeClipExport,
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
