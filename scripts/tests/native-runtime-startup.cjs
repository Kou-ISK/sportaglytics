const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  vm = require('node:vm');
const fs = require('node:fs'),
  fsp = require('node:fs/promises'),
  os = require('node:os'),
  path = require('node:path');
const esbuild = require('esbuild');
async function fixture(mode) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'native-startup95-'));
  let capturedManifest;
  const receiptError = Error('missing native receipt');
  const abnormal = mode.startsWith('abnormal');
  const counts = {
    create: 0,
    start: 0,
    drain: 0,
    close: 0,
    factory: 0,
    ownedClose: 0,
    activityStop: 0,
    listenerRemoved: 0,
  };
  const closed = {
    generation: 'fixture',
    processStarted: false,
    processExited: true,
    nativeDrained: true,
    pipesClosed: true,
    stopped: null,
  };
  if (mode === 'filesystem')
    await fsp.writeFile(path.join(root, 'sessions'), 'occupied');
  const code = esbuild.transformSync(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../electron/src/nativePlayback/runtime/nativeRuntime.ts',
      ),
      'utf8',
    ),
    { loader: 'ts', format: 'cjs' },
  ).code;
  const module = { exports: {} };
  const load = (name) => {
    if (name === 'electron')
      return {
        app: { getPath: () => root },
        ipcMain: {
          on() {},
          removeListener() {
            counts.listenerRemoved++;
          },
        },
        powerSaveBlocker: {},
      };
    if (name.endsWith('surfaceTransport'))
      return {
        createSurfaceTransport: () => {
          counts.create++;
          if (mode === 'addon') throw Error('missing addon');
          return {
            service: 'fixture',
            start() {
              counts.start++;
              if (mode === 'registration') throw Error('registration failed');
            },
            stopRequests() {},
            drain: async () => {
              counts.drain++;
              if (mode === 'cleanup' || mode === 'abnormal-surface')
                throw Error('uncertain surface');
            },
            close() {
              counts.close++;
            },
          };
        },
      };
    if (name.endsWith('playbackActivity'))
      return {
        createPlaybackActivity: () => ({
          start() {
            if (mode === 'activity' || mode === 'cleanup')
              throw Error('activity failed');
            return { registered: true };
          },
          stop() {
            counts.activityStop++;
            return { registered: false };
          },
        }),
      };
    if (name.endsWith('owned-backend.cjs'))
      return {
        createOwnedBackend: ({ manifest }) => (
          (capturedManifest = manifest),
          {
            factory() {
              counts.factory++;
              if (mode === 'factory') throw Error('factory uncertain');
              return {
                write: async () => {},
                close: async () => {
                  counts.ownedClose++;
                  if (abnormal) throw receiptError;
                  return closed;
                },
              };
            },
            done: async () => {
              if (abnormal) throw receiptError;
            },
            termination: async () => {
              if (mode === 'abnormal-control') throw Error('pipe close failed');
              return {
                generation:
                  mode === 'abnormal-generation' ? 'stale' : 'fixture',
                processStarted: true,
                processExited: true,
                pipesClosed: true,
              };
            },
          }
        ),
      };
    if (name.endsWith('nativeHostConfiguration'))
      return { nativeHostConfiguration: () => ({ version: 1 }) };
    if (name.endsWith('nativeHeaderProbe'))
      return { probeNativeHeader: async () => ({}) };
    if (name.endsWith('recorder.cjs')) return { createRecorder: () => null };
    if (name.endsWith('sessionStorage')) {
      const code = esbuild.transformSync(
        fs.readFileSync(
          path.join(
            __dirname,
            '../../electron/src/nativePlayback/runtime/sessionStorage.ts',
          ),
          'utf8',
        ),
        { loader: 'ts', format: 'cjs' },
      ).code;
      const m = { exports: {} };
      vm.runInNewContext(code, { module: m, exports: m.exports, require });
      return m.exports;
    }
    return require(name);
  };
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: load,
    PRIVATE_NATIVE_ROOT: root,
    process,
    performance,
    setTimeout,
    clearTimeout,
  });
  return {
    root,
    counts,
    closed,
    receiptError,
    manifest: () => capturedManifest,
    create: () =>
      module.exports
        .createNativePlaybackRuntime({
          state: root,
          host: '/synthetic/helper',
          receiver: '/synthetic/Receiver.node',
        })
        .createBackend(
          {},
          '/synthetic/source.mp4',
          { presentation: { mutedOnly: mode === 'trial' ? false : true } },
          async () => {},
          { generation: 'fixture' },
          () => {},
        ),
    remove: () => fsp.rm(root, { recursive: true, force: true }),
  };
}
for (const mode of ['filesystem', 'addon', 'registration', 'activity'])
  test(mode + ' failure returns a closeable no-process owner', async () => {
    const f = await fixture(mode);
    try {
      let backend;
      assert.doesNotThrow(() => {
        backend = f.create();
      });
      await assert.rejects(backend.write({}));
      const first = backend.close();
      assert.equal(backend.close(), first);
      assert.deepEqual(JSON.parse(JSON.stringify(await first)), f.closed);
      assert.equal(f.counts.factory, mode === 'activity' ? 1 : 0);
      assert.equal(f.counts.ownedClose, mode === 'activity' ? 1 : 0);
      assert.equal(
        f.counts.close,
        ['registration', 'activity'].includes(mode) ? 1 : 0,
      );
    } finally {
      await f.remove();
    }
  });
test('close before initialization acquires no filesystem, surface or process resources', async () => {
  const f = await fixture('normal');
  try {
    const b = f.create();
    assert.deepEqual(JSON.parse(JSON.stringify(await b.close())), f.closed);
    assert.deepEqual(f.counts, {
      create: 0,
      start: 0,
      drain: 0,
      close: 0,
      factory: 0,
      ownedClose: 0,
      activityStop: 0,
      listenerRemoved: 1,
    });
    assert.equal(fs.existsSync(path.join(f.root, 'sessions')), false);
  } finally {
    await f.remove();
  }
});
for (const mode of ['cleanup', 'factory'])
  test(
    mode + ' uncertainty stays failed rather than claiming a no-process drain',
    async () => {
      const f = await fixture(mode);
      try {
        const b = f.create();
        await assert.rejects(b.write({}));
        const first = b.close();
        await assert.rejects(
          first,
          mode === 'factory' ? /INITIALIZATION_UNKNOWN/ : /uncertain surface/,
        );
        assert.equal(b.close(), first);
        assert.equal(f.counts.close, 0);
      } finally {
        await f.remove();
      }
    },
  );

for (const mode of [
  'abnormal',
  'abnormal-control',
  'abnormal-generation',
  'abnormal-surface',
])
  test(
    mode +
      ' preserves receipt failure and cleans only confirmed resources once',
    async () => {
      const f = await fixture(mode);
      try {
        const b = f.create();
        await b.write({});
        const first = b.close();
        assert.equal(b.close(), first);
        await assert.rejects(first, (error) => error === f.receiptError);
        assert.equal(b.close(), first);
        assert.equal(f.counts.ownedClose, 1);
        const canDrain = mode === 'abnormal' || mode === 'abnormal-surface';
        assert.equal(f.counts.drain, canDrain ? 1 : 0);
        assert.equal(f.counts.close, mode === 'abnormal' ? 1 : 0);
        assert.equal(f.counts.listenerRemoved, mode === 'abnormal' ? 1 : 0);
        assert.equal(f.counts.activityStop, 1);
        assert.equal(fs.readdirSync(path.join(f.root, 'sessions')).length, 1);
      } finally {
        await f.remove();
      }
    },
  );

for (const mode of ['normal', 'trial'])
  test(
    mode + ' does not configure a custom decoder or trial audio switch',
    async () => {
      const f = await fixture(mode);
      try {
        const b = f.create();
        await b.write({});
        assert.deepEqual(Object.keys(f.manifest()).sort(), [
          'surfaceOwnerPID',
          'surfaceService',
          'version',
        ]);
        await b.close();
      } finally {
        await f.remove();
      }
    },
  );
