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

async function terminationFixture(options = {}) {
  const run = await fs.mkdtemp(path.join(os.tmpdir(), 'native-termination-'));
  const child = new EventEmitter();
  child.pid = 123;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let pipeClosed = 0;
  const backend = createOwnedBackend(
    {
      manifest: { version: 1 },
      run,
      host: '/synthetic/helper',
      surfaceReady() {},
      note() {},
    },
    {
      spawn() {
        setImmediate(() => child.emit('spawn'));
        return child;
      },
      createControlPipe: () => ({
        inputFd: 1,
        closeReader() {},
        write: async () => {},
        close: async () => {
          pipeClosed++;
          await options.closeControl?.();
        },
      }),
    },
  );
  const owned = backend.factory(
    { generation: options.generation || 'fixture', sourceKey: 'fixture' },
    options.observe || (() => {}),
  );
  await owned.write({});
  return {
    backend,
    owned,
    child,
    pipeClosed: () => pipeClosed,
    receipt(generation = 'fixture') {
      child.stdout.emit(
        'data',
        Buffer.from(
          JSON.stringify({
            type: 'drained',
            generation,
            nativeDrained: true,
            requiresOwnerExitZero: true,
            resultPersisted: true,
            success: true,
            stoppedClock: null,
          }) + '\n',
        ),
      );
    },
    remove: () => fs.rm(run, { recursive: true, force: true }),
  };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

test('explicit media failure reaches owner before confirmed failure drainage', async () => {
  const observations = [];
  let close;
  const fixture = await terminationFixture({
    observe(value) {
      observations.push(value);
      close = fixture.owned.close();
    },
  });
  try {
    const failure = { phase: 'failed', error: 'media', rate: 0 };
    fixture.child.stdout.emit(
      'data',
      Buffer.from(
        JSON.stringify({
          type: 'observation',
          value: failure,
        }) + '\n',
      ),
    );
    fixture.receipt();
    fixture.child.emit('exit', 1, null);
    fixture.child.emit('close', 1, null);
    assert.equal((await close).nativeDrained, true);
    assert.deepEqual(observations, [failure]);
    assert.equal(fixture.pipeClosed(), 1);
  } finally {
    await fixture.remove();
  }
});
test('missing receipt does not erase physical close, and repeated close retains its failure', async () => {
  const f = await terminationFixture();
  try {
    const closing = f.owned.close();
    f.child.emit('exit', 1, null);
    f.child.emit('close', 1, null);
    await assert.rejects(closing, /host cleanup unconfirmed/);
    assert.deepEqual(await f.backend.termination(), {
      generation: 'fixture',
      processStarted: true,
      processExited: true,
      pipesClosed: true,
    });
    assert.equal(f.owned.close(), closing);
    f.receipt(); // A late packet must not retroactively qualify failed close.
    await assert.rejects(f.owned.close(), /host cleanup unconfirmed/);
    assert.equal(f.pipeClosed(), 1);
  } finally {
    await f.remove();
  }
});

test('exit alone cannot permit cleanup; close also waits for the control pipe', async () => {
  let finishControl;
  const control = new Promise((resolve) => {
    finishControl = resolve;
  });
  const f = await terminationFixture({ closeControl: () => control });
  try {
    let terminated = false;
    void f.backend.termination().then(() => {
      terminated = true;
    });
    f.receipt();
    const closing = f.owned.close();
    f.child.emit('exit', 0, null);
    await tick();
    assert.equal(terminated, false);
    assert.equal(f.pipeClosed(), 0);
    f.child.emit('close', 0, null);
    await tick();
    assert.equal(terminated, false);
    assert.equal(f.pipeClosed(), 1);
    finishControl();
    const closed = await closing;
    assert.equal(closed.nativeDrained, true);
    assert.equal((await f.backend.termination()).generation, 'fixture');
  } finally {
    await f.remove();
  }
});

test('control close failure cannot provide physical termination proof', async () => {
  const failure = Error('control close failed');
  const f = await terminationFixture({
    closeControl: () => {
      throw failure;
    },
  });
  try {
    f.receipt();
    const closing = f.owned.close();
    f.child.emit('exit', 0, null);
    f.child.emit('close', 0, null);
    await assert.rejects(closing, (e) => e === failure);
    await assert.rejects(f.backend.termination(), (e) => e === failure);
  } finally {
    await f.remove();
  }
});

for (const mode of ['missing-exit', 'mismatched-exit'])
  test(mode + ' cannot provide physical termination proof', async () => {
    const f = await terminationFixture();
    try {
      const closing = f.owned.close();
      if (mode === 'mismatched-exit') f.child.emit('exit', 1, null);
      f.child.emit('close', 0, null);
      await assert.rejects(closing, /host termination unconfirmed/);
      await assert.rejects(
        f.backend.termination(),
        /host termination unconfirmed/,
      );
    } finally {
      await f.remove();
    }
  });

test('observed signal termination is physical closure but never a normal native drain', async () => {
  const f = await terminationFixture();
  try {
    const closing = f.owned.close();
    // Synthetic ChildProcess events only; this test never sends a signal.
    f.child.emit('exit', null, 'SIGTERM');
    f.child.emit('close', null, 'SIGTERM');
    await assert.rejects(closing, /host cleanup unconfirmed/);
    assert.equal((await f.backend.termination()).processExited, true);
  } finally {
    await f.remove();
  }
});

test('a backend cannot be rebound and late old-owner events cannot terminate a new owner', async () => {
  const old = await terminationFixture({ generation: 'old' });
  const current = await terminationFixture({ generation: 'new' });
  try {
    assert.throws(
      () => old.backend.factory({ generation: 'new' }, () => {}),
      /owner already created/,
    );
    let currentEnded = false;
    void current.backend.termination().then(() => {
      currentEnded = true;
    });
    old.receipt('old');
    old.child.emit('exit', 0, null);
    old.child.emit('close', 0, null);
    await old.owned.close();
    assert.equal((await old.backend.termination()).generation, 'old');
    await tick();
    assert.equal(currentEnded, false);
    current.receipt('new');
    current.child.emit('exit', 0, null);
    current.child.emit('close', 0, null);
    await current.owned.close();
    assert.equal((await current.backend.termination()).generation, 'new');
  } finally {
    await old.remove();
    await current.remove();
  }
});
