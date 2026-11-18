'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const path = require('node:path');
const esbuild = require('esbuild');
const bundle = esbuild.buildSync({
  entryPoints: [
    path.join(
      __dirname,
      '../../electron/src/nativePlayback/runtime/groupSurfaceTransport.ts',
    ),
  ],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  write: false,
}).outputFiles[0].text;
const owner = { generation: 'synthetic-group', sourceKey: 'a'.repeat(64) };
const intent = (sequence = 1, seekId = 1) => ({
  ...owner,
  sequence,
  seekId,
  targetTime: 5,
  playing: false,
  rate: 1,
  audioTrack: 0,
  volume: 1,
  muted: false,
});
function packet(id = 1, patch = {}) {
  const angle = (id - 1) % 2;
  return {
    id,
    operation: 1,
    seekId: 1,
    pair: Math.ceil(id / 2),
    angle,
    sourceEpoch: 1,
    sourceIndex: angle,
    sourcePTS: 600000 + angle * 60000,
    sourceEndPTS: 602002 + angle * 60000,
    globalTicks: 600000,
    globalStart: 600000,
    globalEnd: 602002,
    content: 'image',
    handle: Buffer.alloc(8),
    surfaceID: 101 + angle,
    ...patch,
  };
}
const plan = {
  key: owner.sourceKey,
  angleIds: ['a', 'b'],
  end: 10,
  sources: ['a', 'b'].map((angleId, i) => ({
    angleId,
    sourceKey: String(i).repeat(64),
  })),
  resolve: (time) =>
    ['a', 'b'].map((angleId, i) =>
      time < 10 - i * 0.5
        ? {
            angleId,
            kind: 'source',
            sourceKey: String(i).repeat(64),
            sourceTime: time + i * 0.5,
            sourceTimeOffset: i * 0.5,
            globalStart: 0,
            globalEnd: 10 - i * 0.5,
          }
        : { angleId, kind: 'blank', globalStart: 9.5, globalEnd: 10 },
    ),
};
const flush = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
function fixture({
  packets = [packet(), packet(2)],
  releaseError,
  transferError,
  openError,
  listenerError,
  expectedHeight,
} = {}) {
  const listeners = new Map(),
    timers = new Set(),
    held = new Map(),
    releases = [],
    draws = [],
    imports = [],
    sent = [],
    blank = [],
    cancelled = [];
  const queue = [...packets];
  let closed = 0,
    openCalls = 0;
  const contents = {
    mainFrame: {},
    send: (channel, meta) => blank.push({ channel, meta }),
  };
  const window = { webContents: contents, isDestroyed: () => false };
  const native = {
    open() {
      openCalls++;
      if (openError) throw openError;
    },
    setPeer() {},
    request() {},
    poll() {
      const p = queue.shift();
      if (p) held.set(p.id, p);
      return p ?? null;
    },
    drawn: (id) => draws.push(id),
    release(id) {
      releases.push(id);
      if (releaseError) throw releaseError;
      const imported = imports.find((p) => p.meta?.id === id);
      if (imported)
        assert.equal(
          imported.released,
          true,
          'Main import must be released first',
        );
      assert.ok(held.delete(id));
    },
    count: () => held.size,
    close() {
      closed++;
      assert.equal(held.size, 0);
      assert.equal(queue.length, 0);
    },
  };
  const electron = {
    ipcMain: {
      on(name, fn) {
        if (listenerError && listeners.size === 1) throw listenerError;
        listeners.set(name, fn);
      },
      removeListener: (name) => listeners.delete(name),
    },
    sharedTexture: {
      importSharedTexture(options) {
        const entry = { options, released: false, meta: null };
        const texture = {
          release: () => {
            entry.released = true;
          },
        };
        entry.texture = texture;
        imports.push(entry);
        return texture;
      },
      sendSharedTexture({ importedSharedTexture }, meta) {
        const entry = imports.find((p) => p.texture === importedSharedTexture);
        entry.meta = meta;
        sent.push(meta);
        return transferError
          ? Promise.reject(transferError)
          : Promise.resolve();
      },
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle, {
    module,
    exports: module.exports,
    Buffer,
    performance,
    setInterval(fn) {
      timers.add(fn);
      return fn;
    },
    clearInterval: (fn) => timers.delete(fn),
    setTimeout,
    require: (name) => (name === 'electron' ? electron : require(name)),
  });
  const transport = module.exports.createGroupSurfaceTransport(
    'fixtures/Receiver.node',
    () => window,
    plan,
    owner,
    () => {},
    (...args) => cancelled.push(args),
    () => native,
    expectedHeight,
  );
  const ack = (meta, drawn = true, sender = contents) =>
    listeners.get('native-group-surface-drawn')?.(
      { sender, senderFrame: contents.mainFrame },
      { document: meta.document, id: meta.id, drawn },
    );
  return {
    transport,
    ack,
    listeners,
    timers,
    held,
    releases,
    draws,
    imports,
    sent,
    blank,
    cancelled,
    counts: () => ({ closed, openCalls }),
    native,
  };
}
test('real Main adapter keeps independent transfer/ACK/GPU milestones and excludes native handles', async () => {
  const f = fixture();
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  f.transport.ready(2);
  assert.equal(f.imports.length, 2);
  assert.equal(f.sent[0].handle, undefined);
  assert.deepEqual(
    f.sent.map((m) => m.angle),
    [0, 1],
  );
  f.ack(f.sent[0], true, {});
  assert.equal(f.draws.length, 0);
  for (const item of f.imports) item.options.allReferencesReleased();
  f.ack(f.sent[0]);
  assert.equal(f.transport.presented(), null);
  f.ack(f.sent[1]);
  assert.deepEqual(Array.from(f.transport.presented().ids), [1, 2]);
  assert.equal(f.releases.length, 0);
  await flush();
  assert.deepEqual(f.releases, [1, 2]);
  await assert.rejects(f.transport.drain(false), /EXIT_UNCONFIRMED/);
  await f.transport.drain(true);
  f.transport.close();
  f.transport.close();
  assert.equal(f.counts().closed, 1);
  assert.equal(f.listeners.size, 0);
  assert.equal(f.timers.size, 0);
});
test('a released command preserves the last actually drawn complete pair, not a requested position', async () => {
  const f = fixture();
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  f.transport.ready(2);
  f.ack(f.sent[0]);
  f.transport.intent(intent(2, 1));
  f.ack(f.sent[1]);
  assert.equal(f.transport.presented().operation, 1);
  assert.equal(f.transport.presented().globalTicks, 600000);
  assert.deepEqual(f.draws, [1]);
  const snapshot = f.transport.presented();
  snapshot.ids[0] = 99;
  assert.deepEqual(Array.from(f.transport.presented().ids), [1, 2]);
  for (const item of f.imports) item.options.allReferencesReleased();
  await flush();
  await f.transport.drain(true);
  f.transport.close();
});
test('an empty local queue does not prove the producer exited or authorize receiver close', () => {
  const f = fixture({ packets: [] });
  f.transport.start();
  assert.throws(() => f.transport.close(), /DRAIN_UNCONFIRMED/);
  assert.equal(f.counts().closed, 0);
});
test('a Main stop fence names both published slots and cannot invent a requested clock', async () => {
  const f = fixture();
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  f.transport.ready(2);
  const first = f.sent[0];
  const proof = {
    document: first.document,
    generation: first.generation,
    operation: 1,
    seekId: 1,
    pair: 1,
    globalTicks: 600000,
    ids: [1, 2],
  };
  assert.equal(
    f.transport.validateStop(proof, intent(2, 1)).globalTicks,
    600000,
  );
  assert.throws(
    () =>
      f.transport.validateStop({ ...proof, globalTicks: 600001 }, intent(2, 1)),
    /UNPUBLISHED/,
  );
  assert.throws(() => f.transport.validateStop(proof, intent(2, 2)), /OWNER/);
  f.transport.stopRequests();
  assert.throws(() => f.transport.validateStop(proof, intent(2, 1)), /CLOSING/);
  for (const item of f.imports) item.options.allReferencesReleased();
  for (const meta of f.sent) f.ack(meta);
  await flush();
  await f.transport.drain(true);
  f.transport.close();
});
test('a source from the wrong angle is released before import and reports the original cause', async () => {
  const f = fixture({ packets: [packet(1, { sourceIndex: 1 })] });
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  assert.equal(f.imports.length, 0);
  assert.deepEqual(f.releases, [1]);
  assert.match(f.cancelled[0][1].message, /FRAME_SOURCE/);
  await f.transport.drain(true);
  f.transport.close();
});
test('old commands cannot become current Drawn and pre-transfer stale frames are drained', async () => {
  const f = fixture();
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  f.transport.intent(intent(2, 2));
  f.transport.ready(2);
  assert.deepEqual(f.releases, [2]);
  assert.equal(f.imports.length, 1);
  f.ack(f.sent[0]);
  f.imports[0].options.allReferencesReleased();
  await flush();
  assert.equal(f.draws.length, 0);
  assert.deepEqual(f.releases, [2, 1]);
  await f.transport.drain(true);
  f.transport.close();
});
test('unnoticed frames are drained after producer exit without texture imports', async () => {
  const f = fixture();
  f.transport.start();
  f.transport.intent(intent());
  f.transport.stopRequests();
  await f.transport.drain(true);
  f.transport.close();
  assert.deepEqual(f.releases, [1, 2]);
  assert.equal(f.imports.length, 0);
});
test('requests document-scoped preload drainage once, but still waits for actual ACK/transfer/GPU milestones', async () => {
  const f = fixture();
  f.transport.start(); f.transport.intent(intent());
  f.transport.ready(1); f.transport.ready(2);
  f.transport.stopRequests(); f.transport.stopRequests();
  const requests = f.blank.filter((value) => value.channel === 'native-group-surface-drain');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].meta.document, f.sent[0].document);
  assert.equal(requests[0].meta.generation, owner.generation);
  assert.equal(f.releases.length, 0); // Main's notification is not physical release.
  for (const meta of f.sent) f.ack(meta, false);
  await flush(); assert.equal(f.releases.length, 0);
  for (const entry of f.imports) entry.options.allReferencesReleased();
  await flush(); assert.deepEqual(f.releases, [1, 2]);
  assert.equal(f.draws.length, 0);
  await f.transport.drain(true); f.transport.close();
  assert.equal(f.blank.filter((value) => value.channel === 'native-group-surface-drain').length, 1);
});
test('release uncertainty retains ownership, its cause and exactly one attempt', async () => {
  const cause = Error('original native release');
  const f = fixture({ packets: [packet()], releaseError: cause });
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  f.imports[0].options.allReferencesReleased();
  f.ack(f.sent[0]);
  await flush();
  await assert.rejects(
    f.transport.drain(true),
    (error) => error.cause === cause,
  );
  let first;
  try {
    f.transport.close();
  } catch (error) {
    first = error;
  }
  assert.ok(first);
  assert.throws(
    () => f.transport.close(),
    (error) => error === first,
  );
  f.imports[0].options.allReferencesReleased();
  assert.deepEqual(f.releases, [1]);
  assert.equal(f.counts().closed, 0);
  assert.equal(f.held.size, 1);
  assert.equal(f.timers.size, 0);
});
test('unknown transfer does not release native data even after other callbacks', async () => {
  const f = fixture({
    packets: [packet()],
    transferError: Error('transfer outcome unknown'),
  });
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  await flush();
  f.ack(f.sent[0], false);
  f.imports[0].options.allReferencesReleased();
  await assert.rejects(f.transport.drain(true), /RELEASE_UNCONFIRMED/);
  assert.deepEqual(f.releases, []);
  assert.equal(f.held.size, 1);
});
for (const phase of ['open', 'listener'])
  test('owns partial initialization: ' + phase, async () => {
    const f = fixture({
      packets: [],
      ...(phase === 'open'
        ? { openError: Error('registration') }
        : { listenerError: Error('listener') }),
    });
    assert.throws(() => f.transport.start(), /registration|listener/);
    await f.transport.drain(true);
    f.transport.close();
    assert.equal(f.counts().closed, 1);
    assert.equal(f.listeners.size, 0);
  });
test('blank metadata clears only its slot without importing a placeholder texture', async () => {
  const blank = packet(1, {
    angle: 1,
    sourceIndex: 32,
    sourcePTS: 0,
    sourceEndPTS: 0,
    globalTicks: 1170000,
    globalStart: 1140000,
    globalEnd: 1200000,
    content: 'blank',
  });
  const f = fixture({ packets: [blank] });
  f.transport.start();
  f.transport.intent(intent());
  f.transport.ready(1);
  assert.equal(f.imports.length, 0);
  assert.equal(f.blank.length, 1);
  assert.equal(f.blank[0].channel, 'native-group-surface-blank');
  f.ack(f.blank[0].meta);
  assert.deepEqual(f.releases, [1]);
  await f.transport.drain(true);
  f.transport.close();
});

test('imports a qualified 720p packet with its actual size and transfer function', async () => {
  const f = fixture({ expectedHeight: 720, packets: [packet(1, { surfaceHeight: 720 })] });
  f.transport.start(); f.transport.intent(intent()); f.transport.ready(1);
  const { codedSize, visibleRect, colorSpace } = f.imports[0].options.textureInfo;
  assert.equal(codedSize.width, 1280); assert.equal(codedSize.height, 720);
  assert.equal(visibleRect.width, 1280); assert.equal(visibleRect.height, 720);
  assert.equal(colorSpace.transfer, 'iec61966-2-4');
  assert.equal(f.sent[0].surfaceHeight, undefined);
  f.ack(f.sent[0]); f.imports[0].options.allReferencesReleased(); await flush();
  await f.transport.drain(true); f.transport.close();
});

test('rejects a layout change before import and releases the owned packet', async () => {
  for (const [expectedHeight, patch] of [[1080, { surfaceHeight: 720 }], [720, {}]]) {
    const f = fixture({ expectedHeight, packets: [packet(1, patch)] });
    f.transport.start(); f.transport.intent(intent()); f.transport.ready(1);
    assert.equal(f.imports.length, 0); assert.equal(f.cancelled.length, 1);
    assert.deepEqual(f.releases, [1]);
    await f.transport.drain(true); f.transport.close();
  }
});

test('a second layout mismatch cannot present a pair and both loans drain', async () => {
  const f = fixture({ expectedHeight: 720, packets: [packet(1, { surfaceHeight: 720 }), packet(2)] });
  f.transport.start(); f.transport.intent(intent()); f.transport.ready(1); f.transport.ready(2);
  assert.equal(f.imports.length, 1); assert.deepEqual(f.releases, [2]);
  assert.equal(f.transport.presented(), null); assert.equal(f.cancelled.length, 1);
  f.ack(f.sent[0], false);
  f.imports[0].options.allReferencesReleased(); await flush();
  assert.equal(f.transport.presented(), null);
  await f.transport.drain(true); f.transport.close();
  assert.deepEqual(f.releases, [2, 1]);
});
