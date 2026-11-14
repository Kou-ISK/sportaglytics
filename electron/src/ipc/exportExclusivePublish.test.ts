// @vitest-environment node
import * as fs from 'node:fs/promises';
import { expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', async (original) => ({
  ...(await original<typeof import('node:fs/promises')>()),
  link: vi.fn(),
}));
vi.mock('electron', () => ({ app: { isPackaged: false } }));
import { publishExclusive } from './exportExclusivePublish';

it('uses an exclusive fallback only for unsupported link errors', async () => {
  vi.mocked(fs.link).mockRejectedValueOnce(
    Object.assign(new Error('unsupported'), { code: 'ENOTSUP' }),
  );
  const fallback = vi.fn(async () => undefined);
  await publishExclusive('/staging', '/target', fallback);
  expect(fallback).toHaveBeenCalledWith('/staging', '/target');
});

it('does not retry on a destination collision or unrelated error', async () => {
  const fallback = vi.fn();
  for (const code of ['EEXIST', 'EIO']) {
    vi.mocked(fs.link).mockRejectedValueOnce(
      Object.assign(new Error(code), { code }),
    );
    await expect(
      publishExclusive('/staging', '/target', fallback),
    ).rejects.toMatchObject({ code });
  }
  expect(fallback).not.toHaveBeenCalled();
});

it('does not convert an indeterminate fallback into success or retry', async () => {
  vi.mocked(fs.link).mockRejectedValueOnce(
    Object.assign(new Error('unsupported'), { code: 'ENOTSUP' }),
  );
  const fallback = vi.fn(async () => {
    throw new Error('uncertain');
  });
  await expect(
    publishExclusive('/staging', '/target', fallback),
  ).rejects.toThrow('uncertain');
  expect(fallback).toHaveBeenCalledOnce();
});
