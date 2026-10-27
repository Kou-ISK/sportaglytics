import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

// Explicit runtime dependency closure. Do not copy tests, private diagnostics,
// declaration files or arbitrary directories into the packaged Main process.
const files = [
  'control-pipe.cjs',
  'native-receipt.cjs',
  'cancellation-gate.cjs',
  'embedded-diagnostic/owned-backend.cjs',
  'embedded-diagnostic/packet-lines.cjs',
  'embedded-diagnostic/surface-notice.cjs',
  'embedded-diagnostic/surface-lifetime.cjs',
  'recurrence/recorder.cjs',
  'recurrence/auxiliary.cjs',
];
const relativeRoot = 'electron/src/nativePlayback/runtime/support';
for (const file of files) {
  const target = join('build', relativeRoot, file);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(join(relativeRoot, file), target);
}
