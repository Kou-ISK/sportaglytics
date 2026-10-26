'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, rm, stat, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { spawn } = require('node:child_process');
const { createControlPipe } = require('./control-pipe.cjs');
const probe = process.env.NATIVE_CONTROL_PROBE;
if (!probe) throw Error('Use scripts/test-native-playback-runtime.mjs');
async function fixture(mode) {
  const directory = await mkdtemp(join(tmpdir(), 'native-fifo-'));
  const file = join(directory, 'control');
  const pipe = createControlPipe(file);
  assert.equal((await stat(file)).mode & 0o777, 0o600);
  const child = spawn(probe, mode ? [mode] : [], {
    stdio: [pipe.inputFd, 'pipe', 'pipe'],
  });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
  let output = '';
  child.stdout.on('data', (b) => (output += b));
  child.stderr.resume();
  pipe.closeReader();
  return { directory, pipe, done, output: () => output };
}
test(
  'real FIFO delivers commands and EOF after the sole owner closes',
  { timeout: 7000 },
  async () => {
    const f = await fixture();
    await f.pipe.write('synthetic-control\n');
    await f.pipe.close();
    assert.deepEqual(await f.done, { code: 0, signal: null });
    assert.equal(f.output(), 'synthetic-control\n');
    await assert.rejects(f.pipe.write('late\n'));
    assert.equal(f.pipe.close(), f.pipe.close());
    await rm(f.directory, { recursive: true });
  },
);
test(
  'rejects oversized writes and safely closes an unused transport',
  { timeout: 7000 },
  async () => {
    const f = await fixture();
    await assert.rejects(f.pipe.write('x'.repeat(4097)), /bound/);
    await f.pipe.close();
    assert.deepEqual(await f.done, { code: 0, signal: null });
    await rm(f.directory, { recursive: true });
  },
);
test(
  'early child rejection still permits physical FIFO closure without a native receipt',
  { timeout: 7000 },
  async () => {
    const f = await fixture('reject');
    assert.deepEqual(await f.done, { code: 65, signal: null });
    await assert.rejects(f.pipe.write('q\n'));
    await f.pipe.close();
    await rm(f.directory, { recursive: true });
  },
);
test('never replaces an existing path', () => {
  return mkdtemp(join(tmpdir(), 'native-fifo-')).then(async (directory) => {
    const file = join(directory, 'control');
    await writeFile(file, 'existing');
    assert.throws(() => createControlPipe(file));
    await rm(directory, { recursive: true });
  });
});
test(
  'a rejected spawn closes the owned FIFO without pretending a host receipt exists',
  { timeout: 7000 },
  async () => {
    const { assertNativeDrain } = require('./native-receipt.cjs');
    const directory = await mkdtemp(join(tmpdir(), 'native-fifo-'));
    const pipe = createControlPipe(join(directory, 'control'));
    let launchError = null,
      spawned = false,
      actualExit = null;
    const child = spawn(join(directory, 'missing-executable'), [], {
      stdio: [pipe.inputFd, 'pipe', 'pipe'],
    });
    child.once('spawn', () => {
      spawned = true;
    });
    child.once('error', (error) => {
      launchError = error;
    });
    child.once('exit', (code, signal) => {
      actualExit = { code, signal };
    });
    await new Promise((resolve) => child.once('close', resolve));
    await pipe.close();
    const state = {
      owner: { generation: 'synthetic' },
      receipt: null,
      actualExit,
      spawned,
      pendingOutput: '',
      controlClosed: true,
      launchError,
      childPid: child.pid,
    };
    assert.equal(launchError.code, 'ENOENT');
    assert.equal(assertNativeDrain(state).processStarted, false);
    assert.throws(() => assertNativeDrain({ ...state, controlClosed: false }));
    await rm(directory, { recursive: true });
  },
);
