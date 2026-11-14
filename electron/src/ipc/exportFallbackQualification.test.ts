import { beforeEach, expect, it, vi } from 'vitest';
import { qualifySilentFallback } from './exportFallbackQualification';
import { runMediaProcess } from './mediaProcessRunner';
vi.mock('../mediaTools', () => ({ getFfprobePath: () => '/ffprobe' }));
vi.mock('./mediaProcessRunner', () => ({ runMediaProcess: vi.fn() }));
const run = vi.mocked(runMediaProcess);
const result = (frames: unknown[], duration = '0.2', rate = '30/1') => JSON.stringify({ streams: [{ codec_type: 'video', avg_frame_rate: rate, start_time: '0', duration }], format: { start_time: '0', duration }, frames });
const frame = (time: string) => ({ best_effort_timestamp_time: time });
beforeEach(() => run.mockReset());
it('accepts sampled first and end images with bounded probes', async () => {
  run.mockResolvedValueOnce({ stdout: result([frame('0')]), stderr: '' }).mockResolvedValueOnce({ stdout: result([frame('0.166667')]), stderr: '' });
  await expect(qualifySilentFallback('/candidate', 0.2)).resolves.toBeUndefined();
  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[0][2]).toMatchObject({ timeoutMs: 15000, maxOutputBytes: 65536 });
});
it.each([
  ['invalid json', '{'],
  ['missing stream', JSON.stringify({ streams: [], format: {}, frames: [] })],
  ['zero frames', result([])],
  ['short duration', result([frame('0')], '0.05')],
  ['unknown rate', result([frame('0')], '0.2', '0/0')],
])('fails closed for %s', async (_name, stdout) => {
  run.mockResolvedValueOnce({ stdout, stderr: '' });
  await expect(qualifySilentFallback('/candidate', 0.2)).rejects.toThrow();
});
it('rejects missing end frame', async () => {
  run.mockResolvedValueOnce({ stdout: result([frame('0')]), stderr: '' }).mockResolvedValueOnce({ stdout: result([frame('0')]), stderr: '' });
  await expect(qualifySilentFallback('/candidate', 0.2)).rejects.toThrow('end frame');
});
it.each(['timeout', 'cancelled'])('propagates %s without qualifying', async (message) => {
  run.mockRejectedValueOnce(new Error(message));
  await expect(qualifySilentFallback('/candidate', 0.2)).rejects.toThrow(message);
});

it.each(['0.235', '0.165'])('rejects duration beyond one 30fps frame (%s)', async (duration) => {
  run.mockResolvedValueOnce({ stdout: result([frame('0')], duration), stderr: '' });
  await expect(qualifySilentFallback('/candidate', 0.2)).rejects.toThrow();
});
it('rejects a final image after the permitted frame tolerance', async () => {
  run.mockResolvedValueOnce({ stdout: result([frame('0')]), stderr: '' }).mockResolvedValueOnce({ stdout: result([frame('0.24')]), stderr: '' });
  await expect(qualifySilentFallback('/candidate', 0.2)).rejects.toThrow('end frame');
});
