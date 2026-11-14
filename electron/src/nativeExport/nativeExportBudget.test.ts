import { describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, unlink } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runNativeExportProbe } from './nativeExportProcess';
vi.mock('./nativeExportProcess', async (original) => { const actual = await original<typeof import('./nativeExportProcess')>(); return { ...actual, runNativeExportProbe: vi.fn() }; });
vi.mock('../mediaTools', () => ({ getFfprobePath: () => 'ffprobe' }));
import { estimateNativeBytes, estimateRequestBytes } from './nativeExportBudget';
const request = { sourcePath: '/source', outputPath: '/out', start: 1, duration: 6585, audioTrack: 1 };
const metadata = { streams: [{ codec_type: 'video', bit_rate: '20888758' }, { codec_type: 'audio', bit_rate: '1000' }, { codec_type: 'audio', bit_rate: '192000' }] };
describe('selected native stream estimate', () => {
  it('estimates the selected streams with finite headroom', () => {
    const result = estimateNativeBytes(metadata, request, 24_226_343_134);
    expect(result).toBeGreaterThan(17_000_000_000);
    expect(result).toBeLessThanOrEqual(24_226_343_134 + 16 * 1024 ** 2);
  });
  it('rejects missing selected audio or bitrate', () => {
    expect(() => estimateNativeBytes(metadata, { ...request, audioTrack: 2 }, 100)).toThrow();
    expect(() => estimateNativeBytes({ streams: [{ codec_type: 'video' }, metadata.streams[1]] }, { ...request, audioTrack: 0 }, 100)).toThrow();
  });
});

it('stops when the source disappears during a failed probe', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'estimate-test-'));
  const sourcePath = path.join(directory, 'in.mp4');
  await writeFile(sourcePath, 'sample');
  vi.mocked(runNativeExportProbe).mockImplementationOnce(async () => { await unlink(sourcePath); throw new Error('probe failed'); });
  await expect(estimateRequestBytes({ ...request, sourcePath })).rejects.toMatchObject({ name: 'NativeExportSourceChanged' });
});
it('stops when the source changes even if probe emits invalid JSON', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'estimate-test-'));
  const sourcePath = path.join(directory, 'in.mp4');
  await writeFile(sourcePath, 'sample');
  vi.mocked(runNativeExportProbe).mockImplementationOnce(async () => { await writeFile(sourcePath, 'replacement'); return 'invalid'; });
  await expect(estimateRequestBytes({ ...request, sourcePath })).rejects.toMatchObject({ name: 'NativeExportSourceChanged' });
});
