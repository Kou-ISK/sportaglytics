import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './media-tools/process.mjs';

const directory = await mkdtemp(join(tmpdir(), 'native-runtime-test-'));
try {
  const pcmSupply = join(directory, 'PCMWindowSupplyTest');
  const nativeRoot = 'native/macos/playback/host-embedded';
  await run('xcrun', [
    'clang++',
    '-std=c++17',
    '-O2',
    '-fobjc-arc',
    '-Wno-deprecated-declarations',
    join(nativeRoot, 'PCMWindowSupply.test.mm'),
    join(nativeRoot, 'PCMWindowSupply.mm'),
    join(nativeRoot, 'NativeSupport.mm'),
    '-framework',
    'AppKit',
    '-framework',
    'AVFoundation',
    '-framework',
    'CoreVideo',
    '-o',
    pcmSupply,
  ]);
  await run(pcmSupply, []);
  for (const name of ['AACCookie', 'AACPacketRange']) {
    const test = join(directory, name);
    await run('xcrun', [
      'clang++',
      '-std=c++17',
      '-O2',
      join(nativeRoot, `${name}.test.cpp`),
      '-o',
      test,
    ]);
    await run(test, []);
  }
  const aacDecode = join(directory, 'AACWindowDecodeTest');
  await run('xcrun', [
    'clang++',
    '-std=c++17',
    '-O2',
    '-fobjc-arc',
    '-Wno-deprecated-declarations',
    join(nativeRoot, 'AACWindowDecode.test.mm'),
    join(nativeRoot, 'AACWindowFormat.mm'),
    join(nativeRoot, 'NativeSupport.mm'),
    '-framework',
    'AppKit',
    '-framework',
    'AVFoundation',
    '-framework',
    'CoreVideo',
    '-framework',
    'CoreMedia',
    '-framework',
    'AudioToolbox',
    '-o',
    aacDecode,
  ]);
  await run(aacDecode, []);
  const recovery = join(directory, 'ProductSupplyRecoveryTest');
  await run('xcrun', [
    'clang++',
    '-std=c++17',
    '-O2',
    'native/macos/playback/host-embedded/ProductSupplyRecovery.test.cpp',
    '-o',
    recovery,
  ]);
  await run(recovery, []);
  const replyQueue = join(directory, 'ReplyQueueTest');
  await run('xcrun', [
    'clang++',
    '-std=c++17',
    '-O2',
    'native/macos/playback/surface-transport/ReplyQueue.test.cpp',
    '-lbsm',
    '-o',
    replyQueue,
  ]);
  await run(replyQueue, []);
  const retention = join(directory, 'SurfaceCandidateRetentionTest');
  await run('xcrun', [
    'clang++',
    '-std=c++17',
    '-O2',
    join(nativeRoot, 'SurfaceCandidateRetention.test.cpp'),
    '-o',
    retention,
  ]);
  await run(retention, []);
  const probe = join(directory, 'ControlPipeProbe');
  await run('xcrun', [
    'clang',
    'scripts/testing/native-control-probe.c',
    '-o',
    probe,
  ]);
  const root = 'electron/src/nativePlayback/runtime/support';
  const files = [
    'control-pipe.node.cjs',
    'native-receipt.node.cjs',
    'cancellation-gate.node.cjs',
    'embedded-diagnostic/owned-backend79.node.cjs',
    'embedded-diagnostic/packet-lines.node.cjs',
    'embedded-diagnostic/surface-notice.node.cjs',
    'embedded-diagnostic/surface-lifetime.node.cjs',
    'recurrence/recorder.node.cjs',
  ].map((file) => join(root, file));
  await run(
    process.execPath,
    [
      '--test',
      '--test-concurrency=1',
      ...files,
      'scripts/tests/native-surface-transport.cjs',
      'scripts/tests/native-runtime-startup.cjs',
    ],
    { env: { ...process.env, NATIVE_CONTROL_PROBE: probe } },
  );
} finally {
  await rm(directory, { recursive: true, force: true });
}
