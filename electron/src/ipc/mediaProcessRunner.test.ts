import { describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
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

it('cancels an owned running media child and waits for it to close', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'media-probe-cancel-'));
  const ready = path.join(root, 'ready');
  const controller = new AbortController();
  let task: Promise<unknown> | undefined;
  try {
    task = runMediaProcess(
      process.execPath,
      [
        '-e',
        "require('node:fs').writeFileSync(process.argv[1], 'ready'); setInterval(() => {}, 1000)",
        ready,
      ],
      { timeoutMs: 10000, maxOutputBytes: 1024, signal: controller.signal },
    );
    const rejected = expect(task).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(async () =>
      expect(await fs.readFile(ready, 'utf8')).toBe('ready'),
    );
    controller.abort();
    await rejected;
  } finally {
    controller.abort();
    await task?.catch(() => undefined);
    await fs.rm(root, { recursive: true, force: true });
  }
});
