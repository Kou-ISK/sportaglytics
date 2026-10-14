import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { verifyInstalledDistribution } from './installed-distribution.mjs';

const [installation, installer, signatureFile, output] = process.argv.slice(2);
if (!installation || !installer || !signatureFile || !output)
  throw new Error(
    'Expected installation, installer, signatures and report paths',
  );
try {
  const project = process.cwd();
  const git = (args) =>
    execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
  const report = {
    sourceCommit: git(['rev-parse', 'HEAD']),
    sourceTree: git(['rev-parse', 'HEAD^{tree}']),
    ...(await verifyInstalledDistribution({
      project,
      installation: resolve(installation),
      installer: resolve(installer),
      signatures: JSON.parse(await readFile(signatureFile, 'utf8')),
    })),
  };
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Installed distribution evidence: ${JSON.stringify(report)}`);
} catch (error) {
  // Unexpected filesystem/ASAR errors may contain private absolute paths; never publish them.
  console.error(
    error instanceof Error && error.message.startsWith('Distribution mismatch:')
      ? error.message
      : 'Installed distribution verification failed: required file or inventory unavailable',
  );
  process.exitCode = 1;
}
