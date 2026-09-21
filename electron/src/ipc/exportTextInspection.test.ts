import { describe, expect, it, vi } from 'vitest';
import {
  inspectExportText,
  assertExportTextFits,
} from './exportTextInspection';
import { DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS } from '../../../src/shared/clipExport/clipExportTypes';
import type { ClipExportPayload } from '../../../src/shared/clipExport/clipExportTypes';
vi.mock('./packageMediaCompositionService', () => ({
  probeMedia: vi.fn(async (file: string) => ({
    width: file.includes('portrait') ? 1080 : 1920,
    height: file.includes('portrait') ? 1920 : 1080,
  })),
}));
vi.mock('./exportVirtualTimelineSource', () => ({
  planExportSource: vi.fn(async (sourcePath: string) => ({ sourcePath })),
}));
const payload = (memo: string): ClipExportPayload => ({
  sourcePath: '/fixture.mp4',
  clips: [{ id: 'one', actionName: 'Fixture', startTime: 0, endTime: 1, memo }],
  overlay: DEFAULT_CLIP_EXPORT_OVERLAY_SETTINGS,
});
describe('export text preflight', () => {
  it('checks every clip before starting an export', async () => {
    const request = payload('Short');
    request.clips.push({
      ...request.clips[0],
      id: 'two',
      memo: 'long\n'.repeat(9),
    });
    await expect(assertExportTextFits(request)).rejects.toThrow('2. Fixture');
    request.overlay = { ...request.overlay, showMemo: false };
    await expect(assertExportTextFits(request)).resolves.toBeUndefined();
  });
  it('uses selected per-clip sources and combines both aspect ratios', async () => {
    const request = payload('Note');
    request.sourcePath2 = '/portrait.mp4';
    request.mode = 'dual';
    const [dual] = await inspectExportText([request]);
    expect(dual.width / dual.height).toBeCloseTo(16 / 9 + 9 / 16, 2);
    request.clips[0].angleType = 'angle2';
    const [single] = await inspectExportText([request]);
    expect(single.width / single.height).toBeCloseTo(9 / 16);
  });
  it('does not inspect videos for an export without text', async () => {
    const request = payload('long\n'.repeat(50));
    request.overlay = { ...request.overlay, enabled: false };
    await expect(assertExportTextFits(request)).resolves.toBeUndefined();
  });
});
