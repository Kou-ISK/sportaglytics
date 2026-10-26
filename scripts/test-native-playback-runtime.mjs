import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './media-tools/process.mjs';

const directory = await mkdtemp(join(tmpdir(), 'native-runtime-test-'));
try {
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
