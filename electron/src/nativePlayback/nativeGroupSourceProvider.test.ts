import { BrowserWindow } from 'electron';
import { beforeEach, expect, it, vi } from 'vitest';
import { createNativeGroupSourceProvider } from './nativeGroupSourceProvider';
import type { NativeQualifiedGroupRuntime } from './nativeGroupSourceProvider';
import type { NativePackageSourcePlan } from './nativePackageSourcePlan';
import type { NativePlaybackGroupSelection } from '../../../src/types/ipc/nativePlaybackGroup';
import { profileFixture } from '../testing/nativeSourceProfileFixture';
const m = vi.hoisted(() => ({
  session: vi.fn<() => unknown>(),
  plan: vi.fn(),
  backend: vi.fn(),
}));
vi.mock('electron', () => ({
  BrowserWindow: class {
    isDestroyed(): boolean {
      return false;
    }
  },
}));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: m.session,
}));
vi.mock('./nativePackageSourcePlan', () => ({
  resolveNativePackageSourcePlan: m.plan,
}));
vi.mock('./runtime/nativeGroupBackend', () => ({
  createNativeGroupBackend: m.backend,
}));
const selection: NativePlaybackGroupSelection = {
  angleIds: ['left', 'right'],
  audioAngleId: 'right',
};
const plan = (): NativePackageSourcePlan => ({
  key: 'a'.repeat(64),
  end: 12,
  angleIds: ['left', 'right'],
  sources: ['left', 'right'].map((angleId, index) => ({
    angleId,
    clipId: angleId + '-clip',
    sourceKey: (index ? 'c' : 'b').repeat(64),
    path: '/synthetic/' + angleId + '.mp4',
    url: 'file:///synthetic/' + angleId + '.mp4',
    revision: '1:2:3:4:5:1',
    durationSeconds: 10,
    globalStart: index ? 2 : 0,
    globalEnd: index ? 12 : 10,
    sourceTimeOffset: index ? -2 : 0,
  })),
  assertCurrent: vi.fn(async () => {}),
  resolve: () => [],
});
const setup = () => {
  const window = new BrowserWindow({ show: false }); // Electron constructor is mocked above; no UI/process.
  const session = {
    id: 'session',
    packageBound: true,
    packagePath: '/synthetic.stpkg',
    mainWindow: window,
  };
  m.session.mockReturnValue(session);
  const sourcePlan = plan();
  m.plan.mockResolvedValue(sourcePlan);
  const runtime: NativeQualifiedGroupRuntime = {
    paths: {
      host: '/verified/host',
      receiver: '/verified/receiver',
      state: '/synthetic/state',
    },
    capability: {
      version: 1,
      transport: 2,
      mode: 'placed-pair-decoded-samples',
      angles: 2,
      clipsPerAngle: 1,
      timescale: 120000,
      imageBudgetBytes: 536870912,
      stopAuthority: 'submitted-pair-v1',
    },
    probe: vi.fn(async () => profileFixture()),
  };
  const resources = vi.fn(async () => runtime);
  return {
    window,
    session,
    sourcePlan,
    runtime,
    resources,
    qualify: createNativeGroupSourceProvider(resources),
  };
};
beforeEach(() => {
  vi.clearAllMocks();
});
it('qualifies selected Main placements and explicit signed capability before exposing a factory', async () => {
  const s = setup(),
    qualified = await s.qualify(s.window, selection);
  expect(qualified?.scope).toEqual(
    expect.objectContaining({
      start: 2,
      end: 10,
      clockAuthority: 'drawn-pair',
    }),
  );
  expect(qualified?.group?.audioAngleId).toBe('right');
  expect(
    qualified?.group?.angles.map((angle) => [
      angle.angleId,
      angle.sourceTimeOffset,
    ]),
  ).toEqual([
    ['left', 0],
    ['right', -2],
  ]);
  expect(m.plan).toHaveBeenCalledWith('/synthetic.stpkg', ['left', 'right']);
  expect(s.runtime.probe).toHaveBeenCalledTimes(2);
  expect(m.backend).not.toHaveBeenCalled();
  const owner = { generation: 'owner', sourceKey: 'a'.repeat(64) },
    observe = vi.fn();
  qualified?.createBackend(owner, observe);
  expect(m.backend).toHaveBeenCalledWith(
    s.runtime.paths,
    s.runtime.capability,
    s.window,
    s.sourcePlan,
    'right',
    owner,
    observe,
  );
});
it('never probes or qualifies another window/unbound package', async () => {
  const s = setup();
  m.session.mockReturnValue({ ...s.session, packageBound: false });
  expect(await s.qualify(s.window, selection)).toBeNull();
  expect(s.resources).not.toHaveBeenCalled();
  expect(m.plan).not.toHaveBeenCalled();
});
it('keeps unsupported multi-clip/gap host plans on HTML without resolving group resources', async () => {
  const s = setup();
  m.plan.mockResolvedValue({
    ...s.sourcePlan,
    sources: [...s.sourcePlan.sources, s.sourcePlan.sources[0]],
  });
  expect(await s.qualify(s.window, selection)).toBeNull();
  expect(s.resources).not.toHaveBeenCalled();
});
it('does not infer group support from an old or unknown capability', async () => {
  const s = setup();
  Object.assign(s.runtime.capability, { unrecognized: true });
  expect(await s.qualify(s.window, selection)).toBeNull();
  expect(s.runtime.probe).not.toHaveBeenCalled();
});
it('rejects profile/range failures before any factory and never extends a short source', async () => {
  const s = setup(),
    short = profileFixture();
  short.streams[0].duration_ts = 6006;
  vi.mocked(s.runtime.probe).mockResolvedValue(short);
  expect(await s.qualify(s.window, selection)).toBeNull();
  expect(m.backend).not.toHaveBeenCalled();
});
it('revalidates package identity across resource/probe waits and before later open', async () => {
  const s = setup(),
    waiting = Promise.withResolvers<NativeQualifiedGroupRuntime>();
  s.resources.mockReturnValue(waiting.promise);
  const promise = s.qualify(s.window, selection);
  await vi.waitFor(() => expect(s.resources).toHaveBeenCalled());
  m.session.mockReturnValue({ ...s.session, id: 'new-session' });
  waiting.resolve(s.runtime);
  expect(await promise).toBeNull();
  expect(s.runtime.probe).not.toHaveBeenCalled();
  m.session.mockReturnValue(s.session);
  s.resources.mockResolvedValue(s.runtime);
  const qualified = await s.qualify(s.window, selection);
  expect(qualified).not.toBeNull();
  m.session.mockReturnValue({ ...s.session, packagePath: '/different.stpkg' });
  await expect(qualified?.assertCurrent()).rejects.toThrow('DOCUMENT_CHANGED');
});
it('copies selection before asynchronous plan resolution', async () => {
  const s = setup(),
    ids: [string, string] = ['left', 'right'];
  const result = s.qualify(s.window, { angleIds: ids, audioAngleId: 'right' });
  ids[0] = 'other';
  await result;
  expect(m.plan.mock.calls[0][1]).toEqual(['left', 'right']);
});

it('does not start a new header probe after an existing source grant changes during capability work', async () => {
  const s = setup();
  vi.mocked(s.sourcePlan.assertCurrent)
    .mockResolvedValueOnce(undefined)
    .mockRejectedValue(Error('source replaced'));
  expect(await s.qualify(s.window, selection)).toBeNull();
  expect(s.resources).toHaveBeenCalledOnce();
  expect(s.runtime.probe).not.toHaveBeenCalled();
  expect(m.backend).not.toHaveBeenCalled();
});

it('captures validated capability/path values independently of later runtime object mutation', async () => {
  const s = setup(),
    qualified = await s.qualify(s.window, selection);
  if (!qualified) throw Error('qualification');
  Object.assign(s.runtime.paths, {
    host: '/foreign/host',
    state: '/foreign/state',
  });
  Object.assign(s.runtime.capability, { imageBudgetBytes: 1 });
  qualified.createBackend(
    { generation: 'owner', sourceKey: 'a'.repeat(64) },
    vi.fn(),
  );
  expect(m.backend.mock.calls[0][0]).toEqual({
    host: '/verified/host',
    receiver: '/verified/receiver',
    state: '/synthetic/state',
  });
  expect(m.backend.mock.calls[0][1].imageBudgetBytes).toBe(536870912);
});

it('preserves selected slot order and audio ownership when the package plan is reversed', async () => {
  const s = setup();
  const reversed = {
    ...s.sourcePlan,
    angleIds: ['right', 'left'],
    sources: [...s.sourcePlan.sources].reverse(),
  };
  m.plan.mockResolvedValue(reversed);
  const qualified = await s.qualify(s.window, {
    angleIds: ['right', 'left'],
    audioAngleId: 'right',
  });
  expect(
    qualified?.group?.angles.map((angle) => [
      angle.angleId,
      angle.sourceTimeOffset,
    ]),
  ).toEqual([
    ['right', -2],
    ['left', 0],
  ]);
  expect(qualified?.group?.audioAngleId).toBe('right');
  expect(qualified?.scope.start).toBe(2);
  expect(qualified?.scope.end).toBe(10);
});
