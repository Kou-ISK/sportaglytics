import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const requireCheck = (condition, label) => {
  if (!condition) throw Error(`Release verification summary: ${label}`);
};
const isHash = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const hashFile = async (path) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
};

/** Public allowlist: no raw logs, signing identity, runner paths or environment. */
export const releaseVerificationSummary = ({
  version,
  head,
  tree,
  runId,
  repository,
  macReports,
  windows,
  assets,
}) => {
  requireCheck(/^\d+\.\d+\.\d+$/.test(version), 'version');
  requireCheck(
    /^[a-f0-9]{40}$/.test(head) && /^[a-f0-9]{40}$/.test(tree),
    'source identity',
  );
  requireCheck(
    /^\d+$/.test(runId) &&
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),
    'workflow identity',
  );
  const expectedAssets = [
    `SporTagLytics-${version}-arm64.dmg`,
    `SporTagLytics-${version}-x64.dmg`,
    `media-tools-sources-${version}-macos.tar.gz`,
    ...(windows
      ? [
          `SporTagLytics-Setup-${version}-x64.exe`,
          `media-tools-sources-${version}-windows.tar.gz`,
        ]
      : []),
  ];
  requireCheck(
    JSON.stringify(Object.keys(assets).sort()) ===
      JSON.stringify(expectedAssets.sort()) &&
      Object.values(assets).every(isHash),
    'asset inventory/hash',
  );
  const macos = ['arm64', 'x64'].map((arch) => {
    const report = macReports[arch];
    requireCheck(
      report?.schemaVersion === 1 &&
        report.head === head &&
        report.version === version &&
        report.arch === arch,
      `${arch} report identity`,
    );
    requireCheck(
      report.notarized === true &&
        report.stapled === true &&
        report.gatekeeperAccepted === true &&
        report.payload?.passed === true &&
        report.payload.arch === arch,
      `${arch} verification gates`,
    );
    requireCheck(
      Number.isSafeInteger(report.developerIdNativeFiles) &&
        report.developerIdNativeFiles >= 3 &&
        isHash(report.appTreeSha256),
      `${arch} app inventory`,
    );
    requireCheck(
      report.dmgSha256 === assets[`SporTagLytics-${version}-${arch}.dmg`],
      `${arch} final DMG bytes`,
    );
    return {
      arch,
      dmgSha256: report.dmgSha256,
      appTreeSha256: report.appTreeSha256,
      developerIdNativeFiles: report.developerIdNativeFiles,
      notarized: true,
      stapled: true,
      gatekeeperAccepted: true,
      payloadCompared: true,
    };
  });
  let windowsSummary;
  if (windows) {
    requireCheck(
      windows.version === version &&
        windows.sourceCommit === head &&
        windows.sourceTree === tree,
      'Windows source identity',
    );
    requireCheck(
      ['Valid', 'NotSigned'].includes(windows.installerSignatureStatus) &&
        isHash(windows.mediaManifestSha256) &&
        isHash(windows.pitchModelSha256),
      'Windows verified identity/signature',
    );
    requireCheck(
      windows.installerSha256 ===
        assets[`SporTagLytics-Setup-${version}-x64.exe`],
      'Windows installer bytes',
    );
    windowsSummary = {
      arch: 'x64',
      installerSha256: windows.installerSha256,
      installerSignatureStatus: windows.installerSignatureStatus,
      mediaManifestSha256: windows.mediaManifestSha256,
      pitchModelSha256: windows.pitchModelSha256,
    };
  }
  return {
    schemaVersion: 1,
    version,
    sourceCommit: head,
    sourceTree: tree,
    workflowRun: `https://github.com/${repository}/actions/runs/${runId}`,
    // The ordered release workflow gates quality/E2E; this file validates the
    // supplied distribution reports and bytes, not independent test execution.
    evidenceScope:
      'Distribution report summary; consult the linked workflow for quality and E2E results. Not an independent attestation.',
    assets,
    macos,
    ...(windowsSummary ? { windows: windowsSummary } : {}),
  };
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  requireCheck(
    ['true', 'false'].includes(process.env.INCLUDE_WINDOWS),
    'explicit platform selection',
  );
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const json = async (path) => JSON.parse(await readFile(path, 'utf8'));
  const { version } = await json('package.json');
  const head = git('rev-parse', 'HEAD');
  requireCheck(
    head === process.env.EXPECTED_SHA && head === process.env.GITHUB_SHA,
    'workflow/source head',
  );
  const macReports = Object.fromEntries(
    await Promise.all(
      ['arm64', 'x64'].map(async (arch) => [
        arch,
        await json(`dist/mac-verification/final-${arch}.json`),
      ]),
    ),
  );
  const windows =
    process.env.INCLUDE_WINDOWS === 'true'
      ? await json('dist/windows-release.json')
      : undefined;
  const names = [
    `SporTagLytics-${version}-arm64.dmg`,
    `SporTagLytics-${version}-x64.dmg`,
    `media-tools-sources-${version}-macos.tar.gz`,
    ...(windows
      ? [
          `SporTagLytics-Setup-${version}-x64.exe`,
          `media-tools-sources-${version}-windows.tar.gz`,
        ]
      : []),
  ];
  const assets = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [name, await hashFile(`dist/${name}`)]),
    ),
  );
  const summary = releaseVerificationSummary({
    version,
    head,
    tree: git('rev-parse', 'HEAD^{tree}'),
    runId: process.env.GITHUB_RUN_ID,
    repository: process.env.GITHUB_REPOSITORY,
    macReports,
    windows,
    assets,
  });
  await writeFile(
    'dist/release-verification.json',
    `${JSON.stringify(summary, null, 2)}\n`,
    { flag: 'wx' },
  );
}
