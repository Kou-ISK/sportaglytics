import assert from 'node:assert/strict';
import { build } from 'esbuild';
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
  const actorsPath = join(directory, 'actors.cjs');
  await build({ stdin: { contents: `
    export { nativeGroupHostIntent } from './electron/src/nativePlayback/nativeGroupControl';
    export { createNativeGroupControlBridge } from './electron/src/preload/nativeGroupControlBridge';
    export { probeNativeGroupCapability } from './electron/src/nativePlayback/runtime/groupCapability';
    export { NativePlaybackManager } from './electron/src/nativePlayback/nativePlaybackManager';
    export { completeCommandGesture } from './src/features/videoPlayer/shared/nativePlayback/completeCommandGesture';
    export { NativePlaybackController } from './src/features/videoPlayer/shared/nativePlayback/nativePlaybackController';
    export { GroupPresentationLedger } from './electron/src/nativePlayback/runtime/groupPresentationLedger';`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node',
    format: 'cjs', outfile: actorsPath });
  const { NativePlaybackManager, completeCommandGesture, NativePlaybackController, GroupPresentationLedger, nativeGroupHostIntent, createNativeGroupControlBridge, probeNativeGroupCapability } = require(actorsPath);
  // Local build identity/hash is verified by native:build. This is actual
  // helper ABI evidence, not production signature or source qualification.
  const capability = await probeNativeGroupCapability(
    resolve('.cache/native-playback/darwin-arm64/NativeProductHost'),
    new AbortController().signal);
  assert.equal(capability.transport, 2);
  assert.equal(capability.stopAuthority, 'submitted-pair-v1');
  for (const rate of [-.5, -2, -4, -6]) {
    const service = 'local.sportaglytics.surface.reverse-' + randomUUID();
    receiver.openGroupV2(service);
    const work = join(directory, String(rate));
    await mkdir(join(work, 'native-run-1'), { recursive: true });
    let owner;
    const pairs = [], observations = [];
    let first, last, receipt, stopped, processClosed = false;
    let backend, owned, manager, controller, snapshotListener;
    let expectedOperation = 0, expectedSeek = 0, frozen = false;
    let restoredTime = null, recoveryReleased = 0;
    const plan = { angleIds: ['left', 'right'],
      sources: [0, 1].map((angle) => ({ angleId: angle ? 'right' : 'left', path: source,
        revision, globalStart: 0, globalEnd: (360360 - (angle ? 2002 : 0)) / 120000,
        sourceTimeOffset: (angle ? 2002 : 0) / 120000 })) };
    const rangeEnd = Math.min(...plan.sources.map((item) => item.globalEnd));
    const presentation = { width: 1920, height: 1080, start: 0, end: rangeEnd,
      seekEnd: rangeEnd - 2 / 120000, playEnd: rangeEnd - 1 / 120000,
      rates: [1, rate], audioTracks: 1, seekGrid: null, mutedOnly: true,
      exactFloatVolume: false, audioSwitch: false };
    const ledger = new GroupPresentationLedger();
    manager = new NativePlaybackManager({ context: () => 'host-contract',
      publish: (_owner, snapshot) => snapshotListener?.(snapshot),
      qualify: async () => ({ sourceKey: 'a'.repeat(64), sourceUrl: 'file:///synthetic-group',
        sourceEnd: Math.max(...plan.sources.map((item) => item.globalEnd)), presentation,
        scope: { start: 0, end: rangeEnd, audioTracks: 1, rates: [1, rate], clockAuthority: 'drawn-pair' },
        assertCurrent: async () => {}, // qualification adapter; actual helper checks file revision
        createBackend: (acceptedOwner, observe) => {
          owned = backend.factory(acceptedOwner, (value) => { observations.push(value); observe(value); });
          return { write: (value) => owned.write(nativeGroupHostIntent(value,
            (proof, intent) => ledger.stop(proof, intent, acceptedOwner))),
          close: async () => ({ ...await owned.close(), presentedStop: ledger.presented() }),
          confirmsPresentedStop: (proof) => ledger.confirmsStop(proof),
          confirmsPresentation: (value) => ledger.confirms(value.generation, value.sequence, value.seekId, value.time) };
        } }),
    });
    const available = await manager.inspect(); owner = available.owner;
    assert.ok(owner && available.clockAuthority === 'drawn-pair');
    assert.deepEqual(available.presentation.rates, [1, rate]);
    const controlBridge = createNativeGroupControlBridge(owner, {
      freeze: () => {
        frozen = true;
        if (first) { receiver.groupRelease(service, first.id); first = undefined; }
        return ledger.presented();
      },
      expect: (_generation, operation, seekId) => {
        frozen = false; expectedOperation = operation; expectedSeek = seekId;
        if (first && (first.operation !== operation || first.seekId !== seekId)) {
          receiver.groupRelease(service, first.id); first = undefined;
        }
      },
    });
    const poll = async () => {
      for (let i = 0; i < 6; ++i) {
        const value = receiver.groupPoll(service); if (!value) break;
        if (frozen || value.operation !== expectedOperation || value.seekId !== expectedSeek) { receiver.groupRelease(service, value.id); continue; }
        const metadata = { ...value, version: 2, generation: owner.generation,
          document: 'host-contract', content: value.content === 1 ? 'image' : 'blank' };
        ledger.publish(metadata);
        if (value.angle === 0) first = value;
        else {
          assert.ok(first && first.pair === value.pair && first.operation === value.operation);
          assert.equal(first.globalTicks, value.globalTicks);
          // The real presenter draws a complete pair in one RAF. Never ACK
          // one angle early and then use an older pair as a release proof.
          ledger.drawn({ ...first, generation: owner.generation, document: 'host-contract' });
          ledger.drawn(metadata);
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
      assert.ok(predicate(), 'bounded group reverse condition failed: ' + JSON.stringify({
        mainError: manager?.observe(owner).error, lastPhase: observations.at(-1)?.phase,
        lastRate: observations.at(-1)?.rate, lastSequence: observations.at(-1)?.sequence,
        lastSeek: observations.at(-1)?.seekId, lastTime: observations.at(-1)?.time }));
    };
    allDrained = false;
    try {
      backend = createOwnedBackend({
        host: resolve('.cache/native-playback/darwin-arm64/NativeProductHost'), run: work,
        manifest: { ...nativeGroupHostConfiguration(plan, 'left'), surfaceService: service, surfaceOwnerPID: process.pid },
        note: (kind, value) => {
          if (kind === 'host-spawn') receiver.groupSetPeer(service, value.pid);
          if (kind === 'native-drained') receipt = value;
        }, surfaceReady: () => {},
      });
      const intent = { ...owner, sequence: 1, seekId: 1, targetTime: 2, playing: false,
        rate, audioTrack: 0, volume: 0, muted: true };
      controller = new NativePlaybackController({
        freezePresentation: (value) => controlBridge.freeze(value),
        open: async (value) => manager.open(value), apply: async (value) => manager.apply(controlBridge.prepare(value)),
        observe: async () => manager.observe(owner), close: async () => manager.close(owner),
        onSnapshot: (_owner, listener) => { snapshotListener = listener; return () => { snapshotListener = undefined; }; },
      }, owner, 'file:///synthetic-group', 2, intent, {
        pause: () => {}, restore: async (time) => { restoredTime = time; },
        release: () => { recoveryReleased++; },
      }, available.presentation, available.clockAuthority);
      await until(() => observations.some((o) => o?.sequence === 1 && o.videoReady && o.phase === 'paused'));
      const playIssuedAt = performance.now();
      assert.equal(await controller.prepareCommandGesture(-rate), true);
      let retired = 0, normalized = 0, revoked = 0;
      const gesture = controller.reserveCommandGesture(-rate, async () => { revoked++; });
      assert.notEqual(gesture, null);
      assert.equal(await controller.startCommandGesture(gesture,
        (value) => manager.applyGuarded(controlBridge.prepare(value), () => true)), gesture);
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
      if (first) { receiver.groupRelease(service, first.id); first = undefined; }
      const stopIssuedAt = performance.now();
      const frozenCount = pairs.filter((p) => p.operation === 2).length;
      let completionFailed = false;
      const completion = completeCommandGesture(controller, -rate, gesture, controller.commandRevision,
        () => controller, async () => { retired++; return true; }, new AbortController().signal, () => { normalized++; });
      void completion.catch(() => { completionFailed = true; });
      await until(() => pairs.some((p) => p.operation === 3) || completionFailed);
      if (completionFailed) await completion;
      assert.ok(pairs.filter((p) => p.operation === 3).every((p) => p.ticks === proof.globalTicks));
      await until(() => observations.some((o) => o?.sequence === 3 && o.phase === 'paused' &&
        Math.round(o.time * 120000) === proof.globalTicks && o.rate === 0));
      const stopAcknowledgedMs = performance.now() - stopIssuedAt;
      await until(() => normalized === 1 || completionFailed); await completion;
      await until(() => observations.some((o) => o?.sequence === 4 && o.videoReady && o.phase === 'paused' &&
        Math.round(o.time * 120000) === proof.globalTicks));
      assert.equal(retired, 1); assert.equal(revoked, 0); assert.equal(controller.requestedControls.rate, 1);
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
      controller.seek(1, 'preview');
      await until(() => observations.some((o) => o?.sequence === 5 && o.seekId === 2 &&
        o.phase === 'paused' && o.videoReady && o.time === 1));
      controller.seek(1, 'scrub');
      await until(() => observations.some((o) => o?.sequence === 6 && o.seekId === 3 &&
        o.phase === 'paused' && o.videoReady && o.time === 1));
      // Both short releases happen before the selected play writer enters IPC.
      // No old queued frame may change the frozen baseline in this burst.
      const shortStop = ledger.presented(); assert.ok(shortStop);
      controller.controls({ playing: true, rate }); controller.controls({ playing: false });
      controller.controls({ playing: true }); controller.controls({ playing: false });
      await until(() => observations.some((o) => o?.sequence === 10 && o.phase === 'paused' &&
        o.videoReady && Math.round(o.time * 120000) === shortStop.globalTicks));
      assert.ok(pairs.filter((p) => p.operation === 10).every((p) => p.ticks === shortStop.globalTicks));
      assert.equal(manager.observe(owner).error, null, 'normal Main session must accept the actual Host contract');
      await controller.returnToOriginal();
      stopped = await manager.close(owner); await backend.done(); processClosed = true;
      assert.equal(controller.snapshot().phase, 'original');
      assert.equal(restoredTime, 1, 'later explicit scrub owns final restoration, not the old held release');
      assert.equal(recoveryReleased, 1);
      assert.ok(stopped.nativeDrained && stopped.processExited && stopped.pipesClosed);
      assert.ok(receipt?.success);
      const bytes = await readFile(join(work, 'native-run-1/native-result.json'));
      assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.resultSHA256);
      const result = JSON.parse(bytes);
      assert.equal(result.heldBytes, 0); assert.equal(result.quarantinedBytes, 0);
      assert.ok(result.peakChargedImageBytes > 0 && result.peakChargedImageBytes <= 512 * 1024 * 1024);
    } finally {
      if (controller && !processClosed) await controller.closeNative().catch(() => {});
      if (owned && !processClosed) { await owned.close(); await backend.done(); processClosed = true; }
      receiver.groupClose(service); allDrained = processClosed;
    }
  }
  console.log(JSON.stringify({ syntheticPairMeasurements: measurements }));
  console.log('All four reverse rates: normal Controller/gesture/Main manager/session, actual two-source samples, monotonic pairs, stop proof and real close passed; Drawn, source qualification/signature, IPC and gesture permit/retirement adapters; no physical key/screen/speaker acceptance.');
} finally {
  if (allDrained) await rm(directory, { recursive: true });
  else console.error('Group reverse retained its own directory: completion unconfirmed.');
}
