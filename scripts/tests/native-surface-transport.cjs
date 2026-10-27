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
      '../../electron/src/nativePlayback/runtime/surfaceTransport.ts',
    ),
  ],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  external: ['electron'],
  write: false,
}).outputFiles[0].text;
for (const failure of ['open', 'second-listener'])
  test(
    'deferred surface start owns partial initialization: ' + failure,
    async () => {
      let opens = 0,
        closes = 0;
      const listeners = new Map();
      const native = {
        open() {
          opens++;
          if (failure === 'open') throw Error('registration failed');
        },
        close() {
          closes++;
        },
        count: () => 0,
        poll: () => null,
      };
      const electron = {
        ipcMain: {
          on(name, fn) {
            if (failure === 'second-listener' && listeners.size === 1)
              throw Error('listener failed');
            listeners.set(name, fn);
          },
          removeListener: (name) => listeners.delete(name),
        },
        sharedTexture: {},
      };
      const module = { exports: {} };
      vm.runInNewContext(bundle, {
        module,
        exports: module.exports,
        Buffer,
        performance,
        setInterval,
        clearInterval,
        setTimeout,
        require: (name) =>
          name === 'electron'
            ? electron
            : name.endsWith('/Receiver.node')
              ? native
              : require(name),
      });
      const s = module.exports.createSurfaceTransport(
        '/synthetic/Receiver.node',
        () => null,
        () => {},
        () => {},
        true,
      );
      assert.equal(opens, 0);
      assert.throws(() => s.start(), /failed/);
      assert.throws(() => s.start(), /attempted/);
      s.stopRequests();
      await s.drain();
      s.close();
      s.close();
      assert.equal(closes, failure === 'open' ? 0 : 1);
      assert.equal(listeners.size, 0);
    },
  );
function fixture({
  failingEvent,
  releaseFails = false,
  packetID = 1,
  seekId = 1,
} = {}) {
  let now = 0,
    timer = null,
    requests = 0,
    releases = 0,
    closed = false,
    polls = 0,
    imports = 0,
    gpuRelease = null;
  const held = new Map(),
    listeners = new Map(),
    cancelled = [],
    records = [];
  const webContents = { mainFrame: {} };
  const queue = [
    {
      id: packetID,
      generation: 1,
      seekId,
      pts: 864003140,
      surfaceID: 11,
      handle: Buffer.alloc(8),
    },
  ];
  const native = {
    open() {},
    setPeer() {},
    poll() {
      polls++;
      const packet = queue.shift();
      if (!packet) return null;
      held.set(packet.id, packet);
      return packet;
    },
    request() {
      requests++;
    },
    drawn() {},
    release(id) {
      releases++;
      assert.ok(held.has(id));
      if (releaseFails) throw Error('uncertain release');
      held.delete(id);
    },
    count: () => held.size,
    close() {
      assert.equal(held.size, 0);
      assert.equal(queue.length, 0);
      closed = true;
    },
  };
  const electron = {
    ipcMain: {
      on: (name, callback) => listeners.set(name, callback),
      removeListener: (name) => listeners.delete(name),
    },
    sharedTexture: {
      importSharedTexture(options) {
        imports++;
        gpuRelease = options.allReferencesReleased;
        return { release() {} };
      },
      sendSharedTexture: () => Promise.resolve(),
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(bundle, {
    module,
    exports: module.exports,
    Buffer,
    performance: { now: () => now },
    setInterval: (callback) => {
      assert.equal(timer, null);
      timer = callback;
      return 1;
    },
    clearInterval() {
      timer = null;
    },
    setTimeout,
    require: (name) =>
      name === 'electron'
        ? electron
        : name === 'node:crypto'
          ? { randomUUID: () => 'document' }
          : name.endsWith('/Receiver.node')
            ? native
            : require(name),
  });
  const transport = module.exports.createSurfaceTransport(
    '/diagnostic/Receiver.node',
    () => ({ webContents }),
    (kind, value) => {
      records.push({ kind, value });
      if (kind === failingEvent || kind === 'surface-failure')
        throw Error('trace bound');
    },
    (reason) => cancelled.push(reason),
  );
  transport.intent({ generation: 'owner', seekId: 1 });
  const event = { sender: webContents, senderFrame: webContents.mainFrame };
  return {
    transport,
    pump: () => {
      now += 10;
      assert.ok(timer);
      timer();
    },
    gpu: () => gpuRelease(),
    ack: () =>
      listeners.get('diagnostic-surface-drawn')(event, {
        id: packetID,
        document: 'document',
        drawn: true,
      }),
    demand: () =>
      listeners.get('diagnostic-surface-request')(event, 'document'),
    state: () => ({
      held: held.size,
      requests,
      releases,
      closed,
      cancelled,
      records,
      polls,
      imports,
      timer: timer !== null,
    }),
  };
}
test('notification receives once with no normal timer; GPU, transfer and draw all precede release', async () => {
  const f = fixture();
  assert.equal(f.state().timer, false);
  f.transport.ready(1);
  assert.equal(f.state().imports, 1);
  await Promise.resolve();
  f.ack();
  assert.equal(f.state().releases, 0);
  f.gpu();
  assert.equal(f.state().releases, 1);
  f.transport.stopRequests();
  await f.transport.drain();
  f.transport.close();
  assert.equal(f.state().closed, true);
  assert.equal(f.state().timer, false);
});
test('packet returned before trace failure is released once and cancellation survives failure logging', async () => {
  const f = fixture({ failingEvent: 'surface-notice' });
  assert.doesNotThrow(() => f.transport.ready(1));
  const s = f.state();
  assert.equal(s.releases, 1);
  assert.equal(s.held, 0);
  assert.equal(s.imports, 0);
  assert.equal(s.cancelled.length, 1);
  assert.match(s.cancelled[0], /trace bound/);
  await f.transport.drain();
  f.transport.close();
});
test('demand trace failure cancels and stops subsequent requests; cleanup still recovers unread packet', async () => {
  const f = fixture({ failingEvent: 'surface-demand' });
  f.demand();
  f.demand();
  assert.equal(f.state().requests, 1);
  assert.equal(f.state().cancelled.length, 1);
  assert.equal(f.state().polls, 0);
  f.transport.stopRequests();
  f.pump();
  assert.equal(f.state().releases, 1);
  await f.transport.drain();
  f.transport.close();
});
test('cleanup recovers missing notice before producer exit; late notice cannot poll or release twice', async () => {
  const f = fixture();
  f.transport.stopRequests();
  f.transport.stopRequests();
  f.pump();
  const before = f.state();
  assert.equal(before.held, 0);
  assert.equal(before.releases, 1);
  assert.equal(before.imports, 0);
  f.transport.ready(1);
  assert.equal(f.state().polls, before.polls);
  assert.equal(f.state().releases, 1);
  assert.equal(f.state().cancelled.length, 0);
  await f.transport.drain();
  f.transport.close();
});
test('duplicate notice is rejected before another receive', async () => {
  const f = fixture({ seekId: 2 });
  f.transport.ready(1);
  const before = f.state();
  f.transport.ready(1);
  assert.equal(f.state().polls, before.polls);
  assert.equal(f.state().releases, 1);
  assert.match(f.state().cancelled[0], /sequence/);
  await f.transport.drain();
  f.transport.close();
});
for (const id of [0, 1.5, 2, NaN, Infinity])
  test('bad/out-of-order notice does not poll ' + id, async () => {
    const f = fixture();
    f.transport.ready(id);
    assert.equal(f.state().polls, 0);
    assert.equal(f.state().cancelled.length, 1);
    f.transport.stopRequests();
    f.pump();
    assert.equal(f.state().releases, 1);
    await f.transport.drain();
    f.transport.close();
  });
test('notice mismatch releases only the actually owned unimported packet and fails', async () => {
  const f = fixture({ packetID: 2 });
  f.transport.ready(1);
  assert.equal(f.state().imports, 0);
  assert.equal(f.state().releases, 1);
  assert.match(f.state().cancelled[0], /mismatch/);
  await f.transport.drain();
  f.transport.close();
});
test('missing packet is a failure, not successful notification', async () => {
  const f = fixture({ seekId: 2 });
  f.transport.ready(1);
  f.transport.ready(2);
  assert.equal(f.state().releases, 1);
  assert.match(f.state().cancelled[0], /without packet/);
  await f.transport.drain();
  f.transport.close();
});
test('uncertain pre-transfer release is not retried by notice or cleanup and cannot drain', async () => {
  const f = fixture({ failingEvent: 'surface-notice', releaseFails: true });
  f.transport.ready(1);
  f.transport.stopRequests();
  f.pump();
  f.transport.ready(1);
  assert.equal(f.state().releases, 1);
  assert.equal(f.state().held, 1);
  assert.equal(f.state().cancelled.length, 1);
  await assert.rejects(f.transport.drain(), /uncertain/);
  assert.throws(() => f.transport.close(), /ownership/);
  assert.equal(f.state().releases, 1);
});
test('uncertain imported release is retained and later duplicate GPU callback cannot retry', async () => {
  const f = fixture({ releaseFails: true });
  f.transport.ready(1);
  await Promise.resolve();
  f.ack();
  f.gpu();
  f.gpu();
  assert.equal(f.state().releases, 1);
  assert.equal(f.state().held, 1);
  assert.equal(f.state().cancelled.length, 1);
  assert.throws(() => f.transport.close(), /ownership/);
});
