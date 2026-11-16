import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, readFile, writeFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { run } from './media-tools/process.mjs';

// Actual unsigned Host, samples and Mach transfer. Synthetic Drawn ACK only;
// these are not physical display, different-camera sync or speaker results.
if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw Error('Native group reverse contract requires macOS arm64');
const require = createRequire(import.meta.url);
const receiver = require(resolve('.cache/native-playback/darwin-arm64/Receiver.node'));
const { createOwnedBackend } = require('../electron/src/nativePlayback/runtime/support/embedded-diagnostic/owned-backend.cjs');
const ts = require('typescript');
const directory = await mkdtemp(join(tmpdir(), 'native-group-reverse-'));
let allDrained = true;
const measurements = [];
try {
  const fixture = join(directory, 'fixture');
  await run('xcrun', ['clang++', '-arch', 'arm64', '-std=c++17', '-O2', '-fobjc-arc',
    'scripts/testing/native-group-player-fixture.mm', '-framework', 'Foundation',
    '-framework', 'AVFoundation', '-framework', 'CoreMedia', '-framework', 'CoreGraphics',
    '-framework', 'ImageIO', '-framework', 'QuartzCore', '-o', fixture]);
  const source = join(directory, 'vfr.mov');
  await run(fixture, [source, 'long']);
  const info = await stat(source, { bigint: true });
  const revision = [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs, info.nlink].join(':');
  const config = ts.transpileModule(await readFile('electron/src/nativePlayback/nativeHostConfiguration.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const modulePath = join(directory, 'config.cjs');
  await writeFile(modulePath, config, { flag: 'wx' });
  const { nativeGroupHostConfiguration } = require(modulePath);
  for (const rate of [-.5, -2, -4, -6]) {
    const service = 'local.sportaglytics.surface.reverse-' + randomUUID();
    receiver.openGroupV2(service);
    const work = join(directory, String(rate));
    await mkdir(join(work, 'native-run-1'), { recursive: true });
    const owner = { generation: randomUUID(), sourceKey: 'a'.repeat(64) };
    const pairs = [], observations = [];
    let first, last, receipt, stopped, stoppingOperation, processClosed = false;
    let backend, owned;
    const poll = async () => {
      for (let i = 0; i < 6; ++i) {
        const value = receiver.groupPoll(service); if (!value) break;
        if (value.operation === stoppingOperation) { receiver.groupRelease(service, value.id); continue; }
        if (value.angle === 0) first = value;
        else {
          assert.ok(first && first.pair === value.pair && first.operation === value.operation);
          assert.equal(first.globalTicks, value.globalTicks);
          // The real presenter draws a complete pair in one RAF. Never ACK
          // one angle early and then use an older pair as a release proof.
          receiver.groupDrawn(service, first.id); receiver.groupDrawn(service, value.id);
          receiver.groupRelease(service, first.id); receiver.groupRelease(service, value.id);
          last = { operation: first.operation, seek: first.seekId, pair: first.pair,
            globalTicks: first.globalTicks, firstID: first.id, secondID: value.id };
          pairs.push({ ms: performance.now(), operation: first.operation, ticks: first.globalTicks,
            sourcePTS: [first.sourcePTS, value.sourcePTS] });
          first = undefined; receiver.groupRequest(service);
        }
      }
      await delay(2);
    };
    const until = async (predicate, maximum = 10000) => {
      const end = performance.now() + maximum;
      while (!predicate() && performance.now() < end) await poll();
      assert.ok(predicate(), 'bounded group reverse condition failed');
    };
    allDrained = false;
    try {
      backend = createOwnedBackend({
        host: resolve('.cache/native-playback/darwin-arm64/NativeProductHost'), run: work,
        manifest: { ...nativeGroupHostConfiguration({ angleIds: ['left', 'right'],
          sources: [0, 1].map((angle) => ({ angleId: angle ? 'right' : 'left', path: source,
            revision, globalStart: 0, globalEnd: (360360 - (angle ? 2002 : 0)) / 120000,
            sourceTimeOffset: (angle ? 2002 : 0) / 120000 })),
        }, 'left'), surfaceService: service, surfaceOwnerPID: process.pid },
        note: (kind, value) => {
          if (kind === 'host-spawn') receiver.groupSetPeer(service, value.pid);
          if (kind === 'native-drained') receipt = value;
        }, surfaceReady: () => {},
      });
      owned = backend.factory(owner, (value) => observations.push(value));
      const intent = { ...owner, sequence: 1, seekId: 1, targetTime: 2, playing: false,
        rate, audioTrack: 0, volume: 0, muted: true };
      await owned.write(intent);
      await until(() => observations.some((o) => o?.sequence === 1 && o.videoReady && o.phase === 'paused'));
      const playIssuedAt = performance.now();
      await owned.write({ ...intent, sequence: 2, playing: true });
      await until(() => pairs.filter((p) => p.operation === 2 && p.ticks < 240000).length >= 3 &&
        pairs.some((p) => p.operation === 2 && p.ticks < 210000) &&
        observations.some((o) => o?.sequence === 2 && o.phase === 'playing' && o.rate === rate && o.time < 2));
      const moving = pairs.filter((p) => p.operation === 2);
      for (let i = 1; i < moving.length; ++i) {
        assert.ok(moving[i].ticks < moving[i - 1].ticks);
        for (const angle of [0, 1]) assert.ok(moving[i].sourcePTS[angle] <= moving[i - 1].sourcePTS[angle]);
      }
      assert.ok(last && last.operation === 2);
      const proof = { ...last };
      stoppingOperation = 2;
      if (first) { receiver.groupRelease(service, first.id); first = undefined; }
      const stopIssuedAt = performance.now();
      const frozenCount = pairs.filter((p) => p.operation === 2).length;
      await owned.write({ ...intent, sequence: 3, playing: false, stopProof: proof });
      await until(() => pairs.some((p) => p.operation === 3));
      assert.ok(pairs.filter((p) => p.operation === 3).every((p) => p.ticks === proof.globalTicks));
      await until(() => observations.some((o) => o?.sequence === 3 && o.phase === 'paused' &&
        Math.round(o.time * 120000) === proof.globalTicks && o.rate === 0));
      const stopAcknowledgedMs = performance.now() - stopIssuedAt;
      assert.equal(pairs.filter((p) => p.operation === 2).length, frozenCount);
      for (const observation of observations.filter((o) => o?.videoReady)) {
        assert.ok(pairs.some((p) => p.operation === observation.sequence &&
          p.ticks === Math.round(observation.time * 120000)), 'observation must name a drawn pair, not the requested clock');
      }
      const progressed = moving.filter((p) => p.ticks < 240000);
      measurements.push({ rate, changedPairs: progressed.length,
        firstMovementMs: progressed[0].ms - playIssuedAt,
        maxPairIntervalMs: Math.max(...progressed.slice(1).map((p, i) => p.ms - progressed[i].ms)),
        backwardTicks: 240000 - proof.globalTicks, stopAcknowledgedMs });
      stopped = await owned.close(); await backend.done(); processClosed = true;
      assert.ok(stopped.nativeDrained && stopped.processExited && stopped.pipesClosed);
      assert.ok(receipt?.success);
      const bytes = await readFile(join(work, 'native-run-1/native-result.json'));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.resultSHA256);
      const result = JSON.parse(bytes);
      assert.equal(result.heldBytes, 0); assert.equal(result.quarantinedBytes, 0);
    } finally {
      if (owned && !processClosed) { await owned.close(); await backend.done(); processClosed = true; }
      receiver.groupClose(service); allDrained = processClosed;
    }
  }
  console.log(JSON.stringify({ syntheticPairMeasurements: measurements }));
  console.log('All four reverse rates: actual two-source samples, monotonic pairs, stop proof and real close passed; Drawn ACK synthetic.');
} finally {
  if (allDrained) await rm(directory, { recursive: true });
  else console.error('Group reverse retained its own directory: completion unconfirmed.');
}
