import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateBuildManifest } from '../media-tools/source-manifest.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const requireMatch = (condition, label) => {
  if (!condition) throw Error(`Windows release mismatch: ${label}`);
};

/** Bind the successful Windows job's installed report to the exact release bytes. */
export const validateWindowsRelease = ({
  report,
  manifestBytes,
  installerBytes,
  version,
  head,
  tree,
  modelHash,
}) => {
  requireMatch(report.schemaVersion === 1, 'report schema');
  requireMatch(
    /^[a-f0-9]{40}$/.test(head) &&
      /^[a-f0-9]{40}$/.test(tree) &&
      report.sourceCommit === head &&
      report.sourceTree === tree,
    'exact source commit/tree',
  );
  requireMatch(report.version === version, 'version');
  requireMatch(
    /^[a-f0-9]{64}$/.test(modelHash) &&
      report.models?.pitchModelSha256 === modelHash &&
      report.models?.ggufFiles === 0 &&
      report.models?.eventPackFiles === 0,
    'model inventory',
  );
  const manifest = validateBuildManifest(
    JSON.parse(manifestBytes),
    'win32-x64',
  );
  const records = report.files?.filter(
    (file) => file.path === 'resources/media-tools/build.json',
  );
  requireMatch(
    records?.length === 1 &&
      records[0].sha256 === hash(manifestBytes) &&
      records[0].bytes === manifestBytes.length,
    'installed media manifest',
  );
  const roles = ['installer', 'application', 'ffmpeg', 'ffprobe'];
  requireMatch(
    Array.isArray(report.binaries) && report.binaries.length === roles.length,
    'binary report coverage',
  );
  const binaries = {};
  for (const role of roles) {
    const matches = report.binaries.filter((binary) => binary.role === role);
    requireMatch(matches.length === 1, `binary role: ${role}`);
    const binary = matches[0];
    requireMatch(
      /^[a-f0-9]{64}$/.test(binary.sha256) &&
        Number.isSafeInteger(binary.bytes) &&
        binary.bytes > 0 &&
        ['NotSigned', 'Valid'].includes(binary.signatureStatus),
      `binary identity/signature: ${role}`,
    );
    if (manifest.binaries[role]) {
      requireMatch(
        binary.preSigningBuildSha256 === manifest.binaries[role] &&
          (binary.signatureStatus !== 'NotSigned' ||
            binary.sha256 === manifest.binaries[role]),
        `media build hash: ${role}`,
      );
    }
    binaries[role] = binary;
  }
  requireMatch(
    binaries.installer.sha256 === hash(installerBytes) &&
      binaries.installer.bytes === installerBytes.length,
    'installer bytes',
  );
  return {
    version,
    sourceCommit: head,
    sourceTree: tree,
    installerSha256: binaries.installer.sha256,
    installerBytes: installerBytes.length,
    installerSignatureStatus: binaries.installer.signatureStatus,
    mediaManifestSha256: hash(manifestBytes),
    pitchModelSha256: modelHash,
  };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== '--verify-only'))
    throw Error('Expected no arguments or --verify-only');
  const verifyOnly = args[0] === '--verify-only';
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  requireMatch(/^\d+\.\d+\.\d+$/.test(version), 'package version');
  const git = (...values) =>
    execFileSync('git', values, { encoding: 'utf8' }).trim();
  const head = git('rev-parse', 'HEAD');
  requireMatch(head === process.env.EXPECTED_SHA, 'expected main commit');
  const name = `SporTagLytics-Setup-${version}-x64.exe`;
  const entries = await readdir('dist/windows', { withFileTypes: true });
  requireMatch(
    entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .join() === name &&
      entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort()
        .join() === 'distribution,media-builds' &&
      entries.length === 3,
    'candidate artifact inventory',
  );
  const report = JSON.parse(
    await readFile('dist/windows/distribution/windows-installed.json', 'utf8'),
  );
  const manifestBytes = await readFile(
    'dist/windows/media-builds/win32-x64.json',
  );
  const modelHash = (
    await readFile('resources/pitch-vision/NOTICE.md', 'utf8')
  ).match(/^SHA-256: ([a-f0-9]{64})\r?$/m)?.[1];
  const evidence = validateWindowsRelease({
    report,
    manifestBytes,
    installerBytes: await readFile(
      `dist/${verifyOnly ? '' : 'windows/'}${name}`,
    ),
    version,
    head,
    tree: git('rev-parse', 'HEAD^{tree}'),
    modelHash,
  });
  if (verifyOnly) {
    requireMatch(
      (await readFile('dist/media-builds/win32-x64.json')).equals(
        manifestBytes,
      ),
      'staged source manifest',
    );
    requireMatch(
      JSON.stringify(
        JSON.parse(await readFile('dist/windows-release.json', 'utf8')),
      ) === JSON.stringify(evidence),
      'saved release evidence',
    );
  } else {
    await mkdir('dist/media-builds', { recursive: true });
    await copyFile(
      `dist/windows/${name}`,
      `dist/${name}`,
      constants.COPYFILE_EXCL,
    );
    await copyFile(
      'dist/windows/media-builds/win32-x64.json',
      'dist/media-builds/win32-x64.json',
      constants.COPYFILE_EXCL,
    );
    await writeFile(
      'dist/windows-release.json',
      `${JSON.stringify(evidence, null, 2)}\n`,
      { flag: 'wx' },
    );
  }
  console.log(`Verified Windows release: ${JSON.stringify(evidence)}`);
}
