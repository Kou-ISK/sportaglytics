import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { verifyMacPayload } from './payload.mjs';

const [inputDmg, arch, inputReport] = process.argv.slice(2);
if (
  process.platform !== 'darwin' ||
  !inputDmg ||
  !inputReport ||
  !['arm64', 'x64'].includes(arch)
)
  throw Error(
    'Usage (macOS): node scripts/macos/verify-dmg.mjs <dmg> <arm64|x64> <report.json>',
  );
const run = (command, args) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const project = process.cwd();
const dmg = resolve(inputDmg);
const mount = await mkdtemp(join(tmpdir(), 'sportaglytics-dmg-'));
let attached = false;
try {
  run('/usr/bin/hdiutil', ['verify', dmg]);
  run('/usr/bin/hdiutil', [
    'attach',
    '-readonly',
    '-nobrowse',
    '-mountpoint',
    mount,
    dmg,
  ]);
  attached = true;
  const app = join(mount, 'SporTagLytics.app');
  // The container is not signed by our configuration; assess the shipped app.
  run('/usr/bin/codesign', [
    '--verify',
    '--deep',
    '--strict',
    '--verbose=2',
    app,
  ]);
  const appRoot = await realpath(app);
  const native = [];
  const tree = [];
  let team;
  const inspect = async (directory, prefix = '') => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        if (!(await realpath(path)).startsWith(appRoot + sep))
          throw Error(`External app symlink: ${name}`);
        tree.push({ path: name, link: await readlink(path) });
      } else if (entry.isDirectory()) await inspect(path, name);
      else if (entry.isFile()) {
        const bytes = await readFile(path);
        tree.push({ path: name, bytes: bytes.length, sha256: hash(bytes) });
        if (
          [
            'cffaedfe',
            'cefaedfe',
            'feedfacf',
            'feedface',
            'cafebabe',
            'bebafeca',
            'cafebabf',
            'bfbafeca',
          ].includes(bytes.subarray(0, 4).toString('hex'))
        ) {
          run('/usr/bin/lipo', [
            path,
            '-verify_arch',
            arch === 'x64' ? 'x86_64' : arch,
          ]);
          run('/usr/bin/codesign', ['--verify', '--strict', path]);
          // codesign writes display information to stderr, including on success.
          const details = spawnSync(
            '/usr/bin/codesign',
            ['-d', '--verbose=4', path],
            { encoding: 'utf8' },
          );
          if (details.status !== 0)
            throw Error(`Cannot inspect signature: ${name}`);
          const text = details.stderr;
          const identifier = text.match(/^TeamIdentifier=(.+)$/m)?.[1];
          if (
            !identifier ||
            !/^Authority=Developer ID Application: /m.test(text) ||
            !/^Timestamp=/m.test(text) ||
            !/flags=.*\bruntime\b/.test(text)
          )
            throw Error(`Missing Developer ID/runtime/timestamp: ${name}`);
          if (team && team !== identifier)
            throw Error(`Mixed signing teams: ${name}`);
          team = identifier;
          native.push({ path: name, sha256: hash(bytes) });
        }
      } else throw Error(`Unexpected app file type: ${name}`);
    }
  };
  await inspect(app);
  if (native.length < 3) throw Error('Native signature coverage is incomplete');
  run('/usr/bin/xcrun', ['stapler', 'validate', app]);
  const assessment = spawnSync(
    '/usr/sbin/spctl',
    ['--assess', '--type', 'execute', '--verbose=4', app],
    { encoding: 'utf8' },
  );
  if (
    assessment.status !== 0 ||
    !/source=Notarized Developer ID/.test(assessment.stderr)
  )
    throw Error('Gatekeeper did not accept a notarized Developer ID app');
  const payload = await verifyMacPayload({ project, app, arch, signed: true });
  const before = JSON.parse(
    await readFile(
      join(project, 'dist/mac-verification', `before-signing-${arch}.json`),
      'utf8',
    ),
  );
  if (
    !before.passed ||
    before.asarSha256 !== payload.asarSha256 ||
    JSON.stringify(
      before.checks.filter(
        (x) =>
          x.kind !== 'unsigned-native' &&
          !before.native.some((n) => n.path === x.path),
      ),
    ) !==
      JSON.stringify(
        payload.checks.filter(
          (x) => !payload.native.some((n) => n.path === x.path),
        ),
      )
  )
    throw Error('Unsigned-to-final payload comparison failed');
  for (const file of payload.native) {
    if (
      !native.some(
        (item) =>
          item.path === `Contents/Resources/${file.path}` &&
          item.sha256 === file.sha256,
      )
    )
      throw Error(`Missing native signature: ${file.path}`);
  }
  const version = JSON.parse(await readFile('package.json', 'utf8')).version;
  if (
    run('/usr/libexec/PlistBuddy', [
      '-c',
      'Print :CFBundleShortVersionString',
      join(app, 'Contents/Info.plist'),
    ]).trim() !== version
  )
    throw Error('DMG app version mismatch');
  tree.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const report = {
    schemaVersion: 1,
    head: run('git', ['rev-parse', 'HEAD']).trim(),
    version,
    arch,
    dmgSha256: hash(await readFile(dmg)),
    appTreeSha256: hash(JSON.stringify(tree)),
    developerIdNativeFiles: native.length,
    notarized: true,
    stapled: true,
    gatekeeperAccepted: true,
    containerSignature:
      'not required; notarization applies to the enclosed app',
    payload,
    native,
  };
  await writeFile(
    resolve(inputReport),
    JSON.stringify(report, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(`Verified notarized ${arch} DMG: ${report.dmgSha256}`);
} finally {
  if (attached) run('/usr/bin/hdiutil', ['detach', mount]);
  await rm(mount, { recursive: true, force: true });
}
