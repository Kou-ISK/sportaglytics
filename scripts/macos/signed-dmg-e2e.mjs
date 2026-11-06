import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdtemp, readFile, realpath, rm, rmdir } from 'node:fs/promises';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getElectronLaunchOptions } from '../e2e-electron-launch.mjs';

export function validateSignedDmgReport(report, { head, version, sha256 }) {
  if (
    !/^[a-f0-9]{40}$/.test(head) ||
    !/^[a-f0-9]{64}$/.test(sha256) ||
    !report ||
    report.schemaVersion !== 1 ||
    report.head !== head ||
    report.version !== version ||
    report.arch !== 'arm64' ||
    report.dmgSha256 !== sha256 ||
    report.notarized !== true ||
    report.stapled !== true ||
    report.gatekeeperAccepted !== true ||
    report.payload?.passed !== true
  ) throw Error('Signed DMG verification report does not match the candidate');
}

const hashFile = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};

const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: 'inherit', ...options });

export async function cleanupSignedDmg({ mount, profile, attached, attachAttempted }, operations = {}) {
  const detach = operations.detach ?? ((path) => run('/usr/bin/hdiutil', ['detach', path]));
  const removeMount = operations.removeMount ?? rmdir;
  const removeProfile = operations.removeProfile ?? ((path) => rm(path, { recursive: true, force: true }));
  try {
    if (attached) {
      await detach(mount);
    } else if (attachAttempted) {
      // Attach may have mounted before returning an error. Only touch our own mount point.
      try { await detach(mount); } catch { /* rmdir must still prove it is unmounted. */ }
    }
    await removeMount(mount);
  } finally {
    if (profile) await removeProfile(profile);
  }
}

export async function runSignedDmgE2E({ project, version, head }) {
  if (process.platform !== 'darwin' || process.arch !== 'arm64')
    throw Error('Signed DMG E2E requires a native arm64 macOS runner');
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Invalid release version');
  const dmg = join(project, 'dist', `SporTagLytics-${version}-arm64.dmg`);
  const report = JSON.parse(
    await readFile(join(project, 'dist/mac-verification/final-arm64.json'), 'utf8'),
  );
  const originalHash = await hashFile(dmg);
  validateSignedDmgReport(report, { head, version, sha256: originalHash });

  const mount = await mkdtemp(join(tmpdir(), 'sportag-signed-dmg-'));
  let profile;
  let attachAttempted = false;
  let attached = false;
  let application;
  try {
    profile = await mkdtemp(join(tmpdir(), 'sportag-signed-profile-'));
    attachAttempted = true;
    run('/usr/bin/hdiutil', ['attach', '-readonly', '-nobrowse', '-mountpoint', mount, dmg]);
    attached = true;
    const executable = await realpath(join(mount, 'SporTagLytics.app/Contents/MacOS/SporTagLytics'));
    if (!executable.startsWith((await realpath(mount)) + sep))
      throw Error('Signed application executable is outside the mounted DMG');
    const profilePath = await realpath(profile);
    process.env.E2E_APP_PATH = executable;
    const { _electron: electron } = await import('playwright');
    application = await electron.launch(getElectronLaunchOptions(profilePath));
    const child = application.process();
    if (!child || !Number.isSafeInteger(child.pid) || child.pid < 1 ||
        !child.spawnargs.includes(`--user-data-dir=${profilePath}`))
      throw Error('Signed application process identity is unavailable');
    const observed = await application.evaluate(({ app }) => ({
      packaged: app.isPackaged,
      version: app.getVersion(),
      architecture: process.arch,
      executable: app.getPath('exe'),
      userData: app.getPath('userData'),
      sessionData: app.getPath('sessionData'),
    }));
    if (!observed.packaged || observed.version !== version || observed.architecture !== 'arm64' ||
        (await realpath(observed.executable)) !== executable ||
        (await realpath(observed.userData)) !== profilePath ||
        (await realpath(observed.sessionData)) !== profilePath)
      throw Error('Signed application identity or isolated profile does not match');
    await application.close();
    application = undefined;
    const result = spawnSync(process.execPath, [join(project, 'scripts/run-electron-e2e.mjs')], {
      cwd: project,
      env: process.env,
      stdio: 'inherit',
    });
    if (result.error || result.status !== 0)
      throw Error('Signed application E2E failed');
    if ((await hashFile(dmg)) !== originalHash) throw Error('DMG changed during E2E');
    console.log(`Signed arm64 application E2E passed for ${version} (${originalHash})`);
  } finally {
    try {
      if (application) await application.close();
    } finally {
      await cleanupSignedDmg({ mount, profile, attached, attachAttempted });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runSignedDmgE2E({ project: process.cwd(), version: process.env.RELEASE_VERSION ?? '', head: process.env.EXPECTED_SHA ?? '' });
}
