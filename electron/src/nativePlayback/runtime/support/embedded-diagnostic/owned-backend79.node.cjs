const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path');
const { createOwnedBackend } = require('./owned-backend.cjs');
test('spawn notification failure retains close handlers, sends quit and awaits actual close', async () => {
  const run = await fs.mkdtemp(path.join(os.tmpdir(), 'native-owner79-'));
  const child = new EventEmitter();
  child.pid = 123;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let quit = 0,
    pipeClosed = 0,
    invalid = 0,
    registeredAtSpawn = false;
  const owner = { generation: 'fixture', sourceKey: 'fixture' };
  try {
    const backend = createOwnedBackend(
      {
        manifest: { version: 1 },
        run,
        host: '/synthetic/helper',
        surfaceReady() {},
        note(kind) {
          if (kind === 'host-spawn') {
            registeredAtSpawn =
              child.listenerCount('close') === 1 &&
              child.listenerCount('error') === 1;
            throw Error('simulated storage failure');
          }
        },
      },
      {
        spawn() {
          setImmediate(() => child.emit('spawn'));
          return child;
        },
        createControlPipe: () => ({
          inputFd: 1,
          closeReader() {},
          close: async () => {
            pipeClosed++;
          },
          write: async (text) => {
            assert.equal(text, 'q\n');
            quit++;
            setImmediate(() => {
              child.stdout.emit(
                'data',
                Buffer.from(
                  JSON.stringify({
                    type: 'drained',
                    generation: 'fixture',
                    nativeDrained: true,
                    requiresOwnerExitZero: true,
                    resultPersisted: true,
                    success: false,
                    stoppedClock: null,
                  }) + '\n',
                ),
              );
              child.emit('exit', 1, null);
              child.emit('close', 1, null);
            });
          },
        }),
      },
    );
    const owned = backend.factory(owner, () => invalid++);
    const closed = await Promise.race([
      backend.done(),
      new Promise((_, reject) =>
        setTimeout(() => reject(Error('drain timeout')), 1000),
      ),
    ]);
    assert.equal(registeredAtSpawn, true);
    assert.equal(quit, 1);
    assert.equal(pipeClosed, 1);
    assert.equal(invalid, 1);
    assert.equal(closed.processExited, true);
    assert.deepEqual(await owned.close(), closed);
  } finally {
    await fs.rm(run, { recursive: true, force: true });
  }
});
