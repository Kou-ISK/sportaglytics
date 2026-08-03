import { describe, expect, it } from 'vitest';
import { runMediaProcess } from './mediaProcessRunner';

describe('runMediaProcess', () => {
  it('returns bounded process output', async () => {
    await expect(
      runMediaProcess(process.execPath, ['-e', 'process.stdout.write("ok")'], {
        timeoutMs: 2_000,
        maxOutputBytes: 64,
      }),
    ).resolves.toMatchObject({ stdout: 'ok' });
  });

  it('terminates a process that exceeds the output limit', async () => {
    await expect(
      runMediaProcess(
        process.execPath,
        ['-e', 'process.stdout.write("x".repeat(65))'],
        {
          timeoutMs: 2_000,
          maxOutputBytes: 64,
        },
      ),
    ).rejects.toThrow('output limit exceeded');
  });

  it('terminates a process that exceeds the deadline', async () => {
    await expect(
      runMediaProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
        timeoutMs: 25,
        maxOutputBytes: 64,
      }),
    ).rejects.toThrow('timed out');
  });
});
