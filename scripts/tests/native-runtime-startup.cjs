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
  const counts = {
    create: 0,
    start: 0,
    drain: 0,
    close: 0,
    factory: 0,
    ownedClose: 0,
    activityStop: 0,
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
        ipcMain: { on() {}, removeListener() {} },
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
              if (mode === 'cleanup') throw Error('uncertain surface');
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
                  return closed;
                },
              };
            },
            done: async () => {},
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

for (const mode of ['normal', 'trial'])
  test(
    mode + ' forwards only the qualified Main audio permission',
    async () => {
      const f = await fixture(mode);
      try {
        const b = f.create();
        await b.write({});
        assert.equal(f.manifest().allowUnmutedTrial, mode === 'trial');
        await b.close();
      } finally {
        await f.remove();
      }
    },
  );
