import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { run } from './media-tools/process.mjs';

// Real unsigned local helper, FIFO, AVPlayer, metadata reader, native addon,
// IOSurface/Mach, stop fence and process/pipe-close. Drawn is a synthetic ACK;
// no Electron window, renderer canvas, speaker or signed-distribution acceptance.
if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw Error('Group Host contract requires macOS arm64');
const require = createRequire(import.meta.url);
const {
  createOwnedBackend,
} = require('../electron/src/nativePlayback/runtime/support/embedded-diagnostic/owned-backend.cjs');
const receiver = require(
  resolve('.cache/native-playback/darwin-arm64/Receiver.node'),
);
const host = resolve('.cache/native-playback/darwin-arm64/NativeProductHost');
const work = await mkdtemp(join(tmpdir(), 'native-group-player-host-'));
let safeToRemove = true;
try {
  const fixture = join(work, 'fixture');
  await run('xcrun', [
    'clang++',
    '-arch',
    'arm64',
    '-std=c++17',
    '-O2',
    '-fobjc-arc',
    'scripts/testing/native-group-player-fixture.mm',
    '-framework',
    'Foundation',
    '-framework',
    'AVFoundation',
    '-framework',
    'CoreMedia',
    '-framework',
    'CoreGraphics',
    '-framework',
    'ImageIO',
    '-framework',
    'QuartzCore',
    '-o',
    fixture,
  ]);
  // Use the actual Main configuration function, not a second handwritten wire
  // contract. Only TypeScript syntax is erased; no runtime function is mocked.
  const typescript = require('typescript');
  const configSource = await readFile(
    'electron/src/nativePlayback/nativeHostConfiguration.ts',
    'utf8',
  );
  const compiledConfig = typescript.transpileModule(configSource, {
    compilerOptions: {
      module: typescript.ModuleKind.CommonJS,
      target: typescript.ScriptTarget.ES2022,
    },
  }).outputText;
  const configFile = join(work, 'configuration.cjs');
  await writeFile(configFile, compiledConfig, { flag: 'wx' });
  const { nativeGroupHostConfiguration } = require(configFile);
  const source = join(work, 'vfr.mov');
  await run(fixture, [source]);
  for (const forgedStop of [false, true]) {
    const service = 'local.sportaglytics.surface.group-' + randomUUID();
    receiver.openGroupV2(service);
    const directory = join(work, forgedStop ? 'forged' : 'normal');
    await mkdir(join(directory, 'native-run-1'), { recursive: true });
    const owner = { generation: randomUUID(), sourceKey: 'a'.repeat(64) };
    const packets = [],
      notices = [],
      observations = [],
      notes = [];
    let receipt, closeResult, owned, backend;
    const poll = () => {
      for (let i = 0; i < 6; ++i) {
        const packet = receiver.groupPoll(service);
        if (!packet) break;
        packets.push(packet);
      }
    };
    const until = async (predicate, milliseconds = 12000) => {
      const end = performance.now() + milliseconds;
      while (!predicate() && performance.now() < end) {
        poll();
        await delay(3);
      }
      assert.ok(predicate(), 'bounded Host condition did not complete');
    };
    try {
      backend = createOwnedBackend({
        host,
        run: directory,
        manifest: {
          ...nativeGroupHostConfiguration(
            {
              angleIds: ['left', 'right'],
              sources: [0, 1].map((angle) => ({
                angleId: angle ? 'right' : 'left',
                path: source,
                globalStart: 0,
                globalEnd: (angle ? 22022 : 24024) / 120000,
                sourceTimeOffset: (angle ? 2002 : 0) / 120000,
              })),
            },
            'left',
          ),
          surfaceService: service,
          surfaceOwnerPID: process.pid,
        },
        note: (kind, value) => {
          notes.push({ kind, value });
          if (kind === 'host-spawn') receiver.groupSetPeer(service, value.pid);
          if (kind === 'native-drained') receipt = value;
        },
        surfaceReady: (id) => notices.push(id),
      });
      safeToRemove = false;
      owned = backend.factory(owner, (value) => observations.push(value));
      const intent = {
        ...owner,
        sequence: 1,
        seekId: 1,
        targetTime: 4004 / 120000,
        playing: false,
        rate: -0.5,
        audioTrack: 0,
        volume: 0,
        muted: true,
      };
      await owned.write(intent);
      await until(() => packets.length === 2);
      const [a, b] = packets;
      assert.deepEqual(
        packets.map((p) => p.angle),
        [0, 1],
      );
      assert.equal(a.sourcePTS, 2002);
      assert.equal(b.sourcePTS, 6006);
      assert.equal(a.globalTicks, 4004);
      assert.equal(b.globalTicks, 4004);
      assert.notEqual(a.surfaceID, b.surfaceID);
      await until(() => notices.length === 2);
      assert.deepEqual(notices, [a.id, b.id]);
      assert.ok(!observations.some((o) => o?.videoReady));
      // ACK both members, but retain the actual image loans through a new
      // operation. Stop proof must be validated independently of release.
      for (const packet of packets) receiver.groupDrawn(service, packet.id);
      await until(() =>
        observations.some((o) => o?.phase === 'paused' && o.videoReady),
      );
      const proofFor = (frame, second, altered = false) => ({
        operation: frame.operation,
        seek: 1,
        pair: frame.pair,
        globalTicks: altered ? 4005 : frame.globalTicks,
        firstID: frame.id,
        secondID: second.id,
      });
      await owned.write(
        forgedStop
          ? { ...intent, sequence: 2, stopProof: proofFor(a, b, true) }
          : { ...intent, sequence: 2, playing: true },
      );
      for (const packet of packets.slice())
        receiver.groupRelease(service, packet.id);
      if (!forgedStop) {
        await until(() => packets.length === 4);
        assert.ok(
          packets
            .slice(2)
            .every((p) => p.operation === 2 && p.globalTicks === 4004),
        );
        // A short re-press survives the previous physical seek. Release with
        // a real published pair fence before its Drawn ACK reaches the Host.
        await owned.write({
          ...intent,
          sequence: 3,
          stopProof: proofFor(packets[2], packets[3]),
        });
        for (const packet of packets.slice(2)) {
          receiver.groupDrawn(service, packet.id);
          receiver.groupRelease(service, packet.id);
        }
        await until(() => packets.length === 6);
        assert.ok(
          packets
            .slice(4)
            .every((p) => p.operation === 3 && p.globalTicks === 4004),
        );
        for (const packet of packets.slice(4)) {
          receiver.groupDrawn(service, packet.id);
          receiver.groupRelease(service, packet.id);
        }
      }
      // Real cooperative close, child close and metadata drainage; no process
      // inventory, listener, force termination or fake exit is used.
      closeResult = await owned.close();
      await backend.done();
      assert.equal(closeResult.nativeDrained, true);
      assert.equal(closeResult.processExited, true);
      assert.equal(closeResult.pipesClosed, true);
      assert.equal(closeResult.stopped, null); // not a measured AVPlayer clock
      assert.equal(receipt.success, !forgedStop);
      const bytes = await readFile(
        join(directory, 'native-run-1/native-result.json'),
      );
      assert.equal(
        createHash('sha256').update(bytes).digest('hex'),
        receipt.resultSHA256,
      );
      const result = JSON.parse(bytes);
      assert.equal(result.heldBytes, 0);
      assert.equal(result.quarantinedBytes, 0);
      assert.equal(
        notes.find((n) => n.kind === 'host-exit').value.code,
        forgedStop ? 1 : 0,
      );
    } finally {
      if (owned && !closeResult) {
        await owned.close();
        await backend.done();
      }
      // Never close with live/unread image loans. Preserve diagnostics if any
      // ownership or child completion remains unknown.
      receiver.groupClose(service);
      safeToRemove = true;
    }
  }
  console.log(
    'Group Host real FIFO/player/sample/pair/stop/receipt/close passed; canvas ACK mocked, unsigned local build.',
  );
} finally {
  if (safeToRemove) await rm(work, { recursive: true });
  else
    console.error(
      'Group Host test retained its owned directory: completion unconfirmed.',
    );
}
