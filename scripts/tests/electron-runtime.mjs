import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const checker = fileURLToPath(
  new URL('../check-electron-runtime.mjs', import.meta.url),
);
test('allows Electron raw filesystem while rejecting unpackaged dependencies', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'electron-runtime-'));
  const main = path.join(root, 'build/electron/src/main.js');
  const run = () =>
    spawnSync(process.execPath, [checker], {
      cwd: root,
      encoding: 'utf8',
      timeout: 15000,
    });
  try {
    await fs.mkdir(path.dirname(main), { recursive: true });
    await fs.writeFile(
      main,
      "require('original-fs'); require('electron'); require('node:fs'); require('./relative');",
    );
    const accepted = run();
    assert.equal(accepted.status, 0, accepted.stderr);
    const helper = path.join(path.dirname(main), 'helper.cjs');
    for (const code of [
      "require('external-package');",
      "import('external-package');",
      "import raw from 'original-fs-extra';",
    ]) {
      await fs.writeFile(helper, code);
      const rejected = run();
      assert.notEqual(rejected.status, 0);
      assert.match(rejected.stderr, /unpackaged runtime dependency/);
    }
    await fs.writeFile(
      helper,
      "require('node:fs'); require('./relative.cjs');",
    );
    assert.equal(run().status, 0);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
