import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

export function validateReleaseIdentity({
  version,
  inputVersion,
  head,
  expectedHead,
  main,
  tag,
  event,
  ref,
}) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || version !== inputVersion)
    throw Error('Release version mismatch');
  if (
    !/^[a-f0-9]{40}$/.test(expectedHead) ||
    [head, main, tag].some((value) => value !== expectedHead)
  )
    throw Error(
      'Release must match the exact main HEAD and immutable version tag',
    );
  if (event !== 'workflow_dispatch' || ref !== 'refs/heads/main')
    throw Error('Run this workflow explicitly on main');
}
if (process.argv[1]?.endsWith('/release-guard.mjs')) {
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim();
  const { version } = JSON.parse(await readFile('package.json', 'utf8'));
  // Validate before constructing a Git revision from the version.
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('Invalid release version');
  validateReleaseIdentity({
    version,
    inputVersion: process.env.RELEASE_VERSION,
    expectedHead: process.env.EXPECTED_SHA,
    head: git('rev-parse', 'HEAD'),
    main: git('rev-parse', 'origin/main'),
    tag: git('rev-parse', `v${version}^{commit}`),
    event: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
  });
  if (process.env.GITHUB_SHA !== git('rev-parse', 'HEAD'))
    throw Error('Workflow and checkout revision differ');
  const releases = execFileSync(
    'gh',
    [
      'api',
      '--paginate',
      `repos/${process.env.GITHUB_REPOSITORY}/releases`,
      '--jq',
      '.[].tag_name',
    ],
    { encoding: 'utf8' },
  );
  if (releases.trim().split('\n').includes(`v${version}`))
    throw Error('This release already exists; use a new version');
  console.log(
    `Release identity verified: v${version} at ${process.env.EXPECTED_SHA}`,
  );
}
