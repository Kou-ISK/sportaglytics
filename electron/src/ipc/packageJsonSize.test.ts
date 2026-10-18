import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { MAX_PACKAGE_JSON_BYTES } from '../../../src/shared/packageJsonLimits';
import { readPackageJson } from './packageCompatibilityValidation';

it('accepts exactly the shared UTF-8 limit and refuses one byte more on disk', async () => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-json-size-'),
  );
  const file = path.join(directory, 'synthetic.json');
  try {
    const prefix = '{"memo":"',
      suffix = '"}';
    const available =
      MAX_PACKAGE_JSON_BYTES - Buffer.byteLength(prefix + suffix);
    const memo =
      'あ'.repeat(Math.floor(available / 3)) + 'a'.repeat(available % 3);
    await fs.writeFile(file, prefix + memo + suffix, 'utf8');
    expect((await fs.stat(file)).size).toBe(MAX_PACKAGE_JSON_BYTES);
    expect(await readPackageJson(file)).toEqual({ memo });
    await fs.appendFile(file, ' ');
    expect((await fs.stat(file)).size).toBe(MAX_PACKAGE_JSON_BYTES + 1);
    await expect(readPackageJson(file)).rejects.toThrow('PACKAGE_JSON_UNSAFE');
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
