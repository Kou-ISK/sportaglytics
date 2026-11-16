import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './media-tools/process.mjs';

const directory = await mkdtemp(join(tmpdir(), 'native-runtime-test-'));
try {
  // Test bounded IPC/surface adapters and image leases, not decoder/display fidelity.
  for (const [name, source, libraries] of [
    ['ControlOutput', 'apple-player/ControlOutput.test.cpp', []],
    [
      'ReverseFrameCache',
      'apple-player/ReverseFrameCache.test.cpp',
      ['-pthread'],
    ],
    ['PlayerObservation', 'apple-player/PlayerObservation.test.cpp', []],
    [
      'StoppedImageSettlement',
      'apple-player/StoppedImageSettlement.test.cpp',
      [],
    ],
    [
      'SourceClockTicks',
      'apple-player/SourceClockTicks.test.cpp',
      ['-framework', 'CoreMedia'],
    ],
    ['ReplyQueue', 'surface-transport/ReplyQueue.test.cpp', ['-lbsm']],
    [
      'SurfaceSender',
      'surface-transport/SurfaceSender.test.mm',
      [
        '-fobjc-arc',
        '-framework',
        'Foundation',
        '-framework',
        'CoreVideo',
        '-framework',
        'IOSurface',
        '-lbsm',
      ],
    ],
  ]) {
    const binary = join(directory, name);
    await run('xcrun', [
      'clang++',
      '-std=c++17',
      '-O2',
      join('native/macos/playback', source),
      ...libraries,
      '-o',
      binary,
    ]);
    await run(binary, []);
  }
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
