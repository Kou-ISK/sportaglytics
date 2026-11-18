import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { resolveNativePackageSourcePlan } from './nativePackageSourcePlan';
import { resolveNativeSource } from './nativeSourceAccess';
import { parseNativePackageTimeline } from './nativePackageTimeline';
import { reservePackageUpdates } from '../ipc/packageUpdateLeases';
import { setPackageCaptureActive } from '../liveCapture/captureRegistry';

const config = () => ({
  angles: ['a', 'b', 'c'].map((id) => ({
    id,
    sourceKind: 'local',
    clips: [
      {
        id: 'first',
        sourceKind: 'local',
        relativePath: `${id}.mp4`,
        timelineStartSeconds: id === 'a' ? 0 : 1,
        durationSeconds: 2,
      },
      {
        id: 'last',
        sourceKind: 'local',
        relativePath: `${id}.mp4`,
        timelineStartSeconds: id === 'a' ? 4 : 5,
        durationSeconds: 2,
      },
    ],
  })),
  syncData: { isAnalyzed: true, syncOffset: 2, angleOffsets: [0, 2, -2] },
});
const roots: string[] = [];
const fixture = async (): Promise<{ root: string; metadata: string }> => {
  const root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'native-plan-')),
  );
  roots.push(root);
  await fs.mkdir(path.join(root, '.metadata'));
  const metadata = path.join(root, '.metadata', 'config.json');
  await fs.writeFile(metadata, JSON.stringify(config()));
  for (const id of ['a', 'b', 'c'])
    await fs.writeFile(
      path.join(root, `${id}.mp4`),
      `synthetic file identity ${id}`,
    );
  return { root, metadata };
};
afterEach(async () => {
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

it('maps independent angles through shared half-open placements, gaps and offsets', async () => {
  const f = await fixture();
  const plan = await resolveNativePackageSourcePlan(f.root, ['a', 'b']);
  expect(plan.sources).toHaveLength(4);
  expect(plan.end).toBe(6);
  expect(plan.resolve(0)).toMatchObject([
    { angleId: 'a', kind: 'source', sourceTime: 0, globalEnd: 2 },
    {
      angleId: 'b',
      kind: 'source',
      sourceTime: 1,
      sourceTimeOffset: 1,
      globalEnd: 1,
    },
  ]);
  expect(plan.resolve(2)).toEqual([
    { angleId: 'a', kind: 'blank', globalStart: 2, globalEnd: 4 },
    { angleId: 'b', kind: 'blank', globalStart: 1, globalEnd: 3 },
  ]);
  expect(plan.resolve(3)).toMatchObject([
    { angleId: 'a', kind: 'blank' },
    {
      angleId: 'b',
      kind: 'source',
      sourceTime: 0,
      sourceTimeOffset: -3,
      globalEnd: 5,
    },
  ]);
  expect(plan.resolve(4)).toMatchObject([
    { angleId: 'a', kind: 'source', sourceTime: 0, globalEnd: 6 },
    { angleId: 'b', kind: 'source', sourceTime: 1, globalEnd: 5 },
  ]);
  expect(plan.resolve(6).every((angle) => angle.kind === 'blank')).toBe(true);
  for (const time of [-1, 6.0001, Infinity, NaN])
    expect(() => plan.resolve(time)).toThrow('NATIVE_PACKAGE_TIME_RANGE');
});

it('keeps original package offset indices when selected surfaces are reordered', async () => {
  const f = await fixture();
  const b = await resolveNativePackageSourcePlan(f.root, ['b']);
  expect(b.resolve(0)).toMatchObject([
    { angleId: 'b', kind: 'source', sourceTime: 1 },
  ]);
  const pair = await resolveNativePackageSourcePlan(f.root, ['c', 'b']);
  expect(pair.resolve(0)).toMatchObject([
    { angleId: 'c', kind: 'blank' },
    { angleId: 'b', kind: 'source', sourceTime: 1 },
  ]);
  expect(pair.resolve(3)).toMatchObject([
    { angleId: 'c', kind: 'source', sourceTime: 0 },
    { angleId: 'b', kind: 'source', sourceTime: 0 },
  ]);
  expect(pair.key).not.toBe(
    (await resolveNativePackageSourcePlan(f.root, ['b', 'c'])).key,
  );
});

it('uses the existing unanalyzed-offset rule and rejects unsupported selection', () => {
  const raw = config();
  raw.syncData.isAnalyzed = false;
  expect(parseNativePackageTimeline(raw, ['b'])[0].offsetSeconds).toBe(0);
  for (const selection of [[], ['a', 'a'], ['a', 'b', 'c'], ['missing']])
    expect(() => parseNativePackageTimeline(raw, selection)).toThrow(
      'NATIVE_UNSUPPORTED_ANGLE_SELECTION',
    );
});

it('snapshots caller selection before asynchronous filesystem work', async () => {
  const f = await fixture();
  const selection = ['a', 'b'];
  const work = resolveNativePackageSourcePlan(f.root, selection);
  selection.splice(0, 2, 'c');
  const plan = await work;
  expect(plan.resolve(0).map((angle) => angle.angleId)).toEqual(['a', 'b']);
  expect(plan.key).toBe(
    (await resolveNativePackageSourcePlan(f.root, ['a', 'b'])).key,
  );
});

it('rejects unknown lengths, overlap and malformed offsets without guessing a timeline', () => {
  const raw = config();
  const first = raw.angles[0].clips[0];
  const angle = (clip: Record<string, unknown>): Record<string, unknown> => ({
    ...raw,
    angles: [{ ...raw.angles[0], clips: [clip] }],
    syncData: undefined,
  });
  for (const invalid of [undefined, 0, -1, NaN, 86401, '2'])
    expect(() =>
      parseNativePackageTimeline(
        angle({ ...first, durationSeconds: invalid }),
        ['a'],
      ),
    ).toThrow();
  expect(() =>
    parseNativePackageTimeline(
      angle({ ...first, timelineStartSeconds: undefined }),
      ['a'],
    ),
  ).toThrow();
  raw.angles[0].clips[1].timelineStartSeconds = 1;
  expect(() => parseNativePackageTimeline(raw, ['a'])).toThrow(
    'NATIVE_UNSUPPORTED_PACKAGE',
  );
  raw.angles[0].clips[1].timelineStartSeconds = 4;
  raw.syncData.angleOffsets[1] = Infinity;
  expect(() => parseNativePackageTimeline(raw, ['b'])).toThrow();
});

it('rejects duplicate identities and nonlocal selected clips while leaving inactive angles unopened', async () => {
  const raw = config();
  raw.angles[0].clips[1].id = 'first';
  expect(() => parseNativePackageTimeline(raw, ['a'])).toThrow(
    'NATIVE_UNSUPPORTED_PACKAGE',
  );
  const f = await fixture();
  const changed = config();
  changed.angles[2].sourceKind = 'youtube';
  await fs.writeFile(f.metadata, JSON.stringify(changed));
  await fs.rm(path.join(f.root, 'c.mp4'));
  await expect(
    resolveNativePackageSourcePlan(f.root, ['a', 'b']),
  ).resolves.toBeDefined();
  await expect(resolveNativePackageSourcePlan(f.root, ['c'])).rejects.toThrow(
    'NATIVE_UNSUPPORTED_PACKAGE',
  );
  changed.angles[1].id = 'a';
  expect(() => parseNativePackageTimeline(changed, ['a'])).toThrow(
    'NATIVE_UNSUPPORTED_PACKAGE',
  );
});

it('keeps ordinary source and whole-document replacement guards for every selected angle', async () => {
  const f = await fixture();
  const plan = await resolveNativePackageSourcePlan(f.root, ['a', 'b']);
  await plan.assertCurrent();
  await fs.writeFile(
    path.join(f.root, 'b.mp4'),
    'changed content and revision',
  );
  await expect(plan.assertCurrent()).rejects.toThrow('NATIVE_SOURCE_CHANGED');
  const fresh = await resolveNativePackageSourcePlan(f.root, ['a', 'b']);
  expect(fresh.key).not.toBe(plan.key);
  await fs.appendFile(f.metadata, ' ');
  await expect(fresh.assertCurrent()).rejects.toThrow('NATIVE_SOURCE_CHANGED');
});

it('preserves absolute metadata references but rejects traversal and symlinks', async () => {
  const f = await fixture();
  const external = await fixture();
  const raw = config();
  raw.angles[0].clips[0].relativePath = path.join(external.root, 'a.mp4');
  await fs.writeFile(f.metadata, JSON.stringify(raw));
  expect(
    (await resolveNativePackageSourcePlan(f.root, ['a'])).sources[0].path,
  ).toBe(raw.angles[0].clips[0].relativePath);
  raw.angles[0].clips[0].relativePath = '../escape.mp4';
  await fs.writeFile(f.metadata, JSON.stringify(raw));
  await expect(resolveNativePackageSourcePlan(f.root, ['a'])).rejects.toThrow(
    'NATIVE_UNSUPPORTED_SOURCE',
  );
  raw.angles[0].clips[0].relativePath = 'linked.mp4';
  await fs.symlink(path.join(f.root, 'a.mp4'), path.join(f.root, 'linked.mp4'));
  await fs.writeFile(f.metadata, JSON.stringify(raw));
  await expect(resolveNativePackageSourcePlan(f.root, ['a'])).rejects.toThrow(
    'NATIVE_SOURCE_SYMLINK',
  );
});

it('does not widen legacy single-source qualification by adding a group planner', async () => {
  const f = await fixture();
  await expect(resolveNativeSource(f.root)).rejects.toThrow();
});

it('keeps update/capture holds scoped to the bound package', async () => {
  const f = await fixture();
  const other = await fixture();
  const plan = await resolveNativePackageSourcePlan(f.root, ['a', 'b']);
  const independent = await resolveNativePackageSourcePlan(other.root, ['a']);
  const release = reservePackageUpdates([f.root]);
  try {
    await expect(plan.assertCurrent()).rejects.toThrow('NATIVE_PACKAGE_BUSY');
    await expect(resolveNativePackageSourcePlan(f.root, ['a'])).rejects.toThrow(
      'NATIVE_PACKAGE_BUSY',
    );
    await independent.assertCurrent();
  } finally {
    release();
  }
  setPackageCaptureActive(f.root, true);
  try {
    await expect(plan.assertCurrent()).rejects.toThrow('NATIVE_PACKAGE_BUSY');
  } finally {
    setPackageCaptureActive(f.root, false);
  }
  await plan.assertCurrent();
});

it('rejects a replaced metadata directory instead of reading through its symlink', async () => {
  const f = await fixture();
  const external = await fixture();
  await fs.rename(
    path.join(f.root, '.metadata'),
    path.join(f.root, '.metadata-original'),
  );
  await fs.symlink(
    path.join(external.root, '.metadata'),
    path.join(f.root, '.metadata'),
    'dir',
  );
  await expect(resolveNativePackageSourcePlan(f.root, ['a'])).rejects.toThrow(
    'NATIVE_PACKAGE_CHANGED',
  );
});

it('cancels at async boundaries, preserves the reason and does not cancel another plan', async () => {
  const f = await fixture();
  const controller = new AbortController();
  const reason = Error('synthetic owner closed');
  const work = resolveNativePackageSourcePlan(
    f.root,
    ['a', 'b'],
    controller.signal,
  );
  controller.abort(reason);
  await expect(work).rejects.toMatchObject({
    message: 'NATIVE_PACKAGE_PLAN_CANCELLED',
    cause: reason,
  });
  await expect(
    resolveNativePackageSourcePlan('not-read.stpkg', ['a'], controller.signal),
  ).rejects.toThrow('NATIVE_PACKAGE_PLAN_CANCELLED');
  const lifetime = new AbortController();
  const plan = await resolveNativePackageSourcePlan(
    f.root,
    ['a'],
    lifetime.signal,
  );
  const independent = await resolveNativePackageSourcePlan(f.root, ['a']);
  lifetime.abort(reason);
  await expect(plan.assertCurrent()).rejects.toMatchObject({ cause: reason });
  expect(() => plan.resolve(0)).toThrow('NATIVE_PACKAGE_PLAN_CANCELLED');
  await independent.assertCurrent();
});
