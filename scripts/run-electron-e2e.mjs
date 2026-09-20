import { spawnSync } from 'node:child_process';

// Each scenario owns a temporary profile/package and closes its Electron process.
// Collect failures so one platform-specific regression cannot hide later scenarios.
const scenarios = [
  'clip-sync',
  'multi-clip-playback',
  'angle-sync-multi',
  'angle-sync-gaps',
  'code-window-menu',
  'export-menu',
  'export-fast',
  'export-progress',
  'timeline-rows',
  'paint',
  'tactical-board',
  'paint-export',
  'package-reopen',
  'event-detection',
];
const failed = [];
for (const scenario of scenarios) {
  console.log(`Running Electron E2E: ${scenario}`);
  const result = spawnSync(process.execPath, [`scripts/e2e-${scenario}.mjs`], {
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error || result.status !== 0) {
    failed.push(scenario);
    console.error(
      `Electron E2E failed: ${scenario} (${result.error?.code ?? result.signal ?? result.status})`,
    );
  }
}
if (failed.length) {
  console.error(`Failed Electron E2E scenarios: ${failed.join(', ')}`);
  process.exitCode = 1;
} else {
  console.log(`All ${scenarios.length} Electron E2E scenarios passed`);
}
