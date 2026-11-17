import { beforeEach, expect, it, vi } from 'vitest';
import type { BrowserWindow } from 'electron';
import { createHash } from 'node:crypto';
import type { NativePackageSourcePlan } from '../nativePackageSourcePlan';
import { createNativeGroupBackend } from './nativeGroupBackend';
const m = vi.hoisted(() => ({ surface: { start: vi.fn(), setPeer: vi.fn(), ready: vi.fn(),
  intent: vi.fn(), validateStop: vi.fn(), confirmsPresentation: vi.fn(),
  confirmsPresentedStop: vi.fn(), presented: vi.fn(), stopRequests: vi.fn(),
  drain: vi.fn(), close: vi.fn(), service: 'local.synthetic.group' },
  createSurface: vi.fn(), createOwned: vi.fn(), factory: vi.fn(), write: vi.fn(),
  close: vi.fn(), done: vi.fn(), termination: vi.fn(), createSession: vi.fn(),
  read: vi.fn(), remove: vi.fn(), activityStart: vi.fn(), activityStop: vi.fn() }));
vi.mock('electron', () => ({ powerSaveBlocker: {} }));
vi.mock('./groupSurfaceTransport', () => ({ createGroupSurfaceTransport: m.createSurface }));
vi.mock('./support/embedded-diagnostic/owned-backend.cjs', () => ({ createOwnedBackend: m.createOwned }));
vi.mock('./sessionStorage', () => ({ createSessionDirectory: m.createSession,
  readNativeReceipt: m.read, removeOwnedSession: m.remove }));
vi.mock('./playbackActivity', () => ({ createPlaybackActivity: () => ({
  start: m.activityStart, stop: m.activityStop }) }));
const capability = { version: 1, transport: 2, mode: 'placed-pair-decoded-samples',
  angles: 2, clipsPerAngle: 1, timescale: 120000, imageBudgetBytes: 536870912,
  stopAuthority: 'submitted-pair-v1' } as const;
const owner = { generation: 'group', sourceKey: 'a'.repeat(64) };
const closed = { generation: owner.generation, processStarted: true,
  processExited: true, pipesClosed: true, nativeDrained: true, stopped: null };
const proof = { generation: 'group', document: 'doc', operation: 1, seekId: 1,
  pair: 1, globalTicks: 120000, ids: [1, 2] };
const intent = { ...owner, sequence: 1, seekId: 1, targetTime: 1, playing: false,
  rate: -2, audioTrack: 0, muted: true, volume: 0 };
const receipt = { engine: 'AVPlayerGroup', success: true, stoppedClock: null,
  heldBytes: 0, quarantinedBytes: 0, peakChargedImageBytes: 1000 };
let bytes: Buffer;
let note: (kind: string, value: Record<string, unknown>) => void;
const plan = (): NativePackageSourcePlan => ({ key: 'a'.repeat(64), end: 10,
  angleIds: ['left', 'right'], sources: ['left', 'right'].map((angleId) => ({
    angleId, clipId: angleId, sourceKey: 'b'.repeat(64),
    path: '/synthetic/' + angleId + '.mov', url: 'file:///synthetic/' + angleId + '.mov',
    revision: '1:2:3:4:5:1', durationSeconds: 10, globalStart: 0,
    globalEnd: 10, sourceTimeOffset: 0 })),
  assertCurrent: vi.fn(async () => {}), resolve: () => [],
});
const make = (sourcePlan = plan()): ReturnType<typeof createNativeGroupBackend> =>
  createNativeGroupBackend({ state: '/synthetic/state', host: '/verified/host',
    receiver: '/verified/receiver' }, capability,
  // Only mocked surface/owned-child adapters receive this window in this unit.
  {} as BrowserWindow, sourcePlan, 'left', owner, vi.fn());
beforeEach(() => {
  vi.resetAllMocks();
  bytes = Buffer.from(JSON.stringify(receipt));
  m.createSession.mockReturnValue('/synthetic/state/sessions/session-1');
  m.createSurface.mockReturnValue(m.surface);
  m.surface.drain.mockResolvedValue(undefined);
  m.surface.presented.mockReturnValue(proof);
  m.surface.confirmsPresentation.mockReturnValue(true);
  m.surface.confirmsPresentedStop.mockReturnValue(true);
  m.surface.validateStop.mockImplementation((value) => value);
  m.write.mockResolvedValue(undefined);
  m.close.mockImplementation(async () => {
    note('native-drained', { resultPersisted: true,
      resultSHA256: createHash('sha256').update(bytes).digest('hex') });
    return closed;
  });
  m.done.mockResolvedValue(closed);
  m.termination.mockResolvedValue(closed);
  m.factory.mockReturnValue({ write: m.write, close: m.close });
  m.createOwned.mockImplementation((options) => {
    note = options.note;
    return { factory: m.factory, done: m.done, termination: m.termination };
  });
  m.read.mockImplementation(async () => bytes);
  m.remove.mockResolvedValue(undefined);
  m.activityStart.mockReturnValue({ registered: true });
});
it('connects plan, pair surface, owned helper, stop proof and checked receipt', async () => {
  const p = plan(), backend = make(p);
  await backend.write(intent);
  expect(m.createOwned.mock.calls[0][0].manifest).toMatchObject({ version: 2,
    mode: 'placed-pair-decoded-samples', audioAngle: 0,
    surfaceService: 'local.synthetic.group', surfaceOwnerPID: process.pid });
  expect(m.factory).toHaveBeenCalledWith(owner, expect.any(Function));
  expect(p.assertCurrent).toHaveBeenCalledTimes(2);
  note('host-spawn', { pid: 123 }); expect(m.surface.setPeer).toHaveBeenCalledWith(123);
  m.createOwned.mock.calls[0][0].surfaceReady(1);
  expect(m.surface.ready).toHaveBeenCalledWith(1);
  await backend.write({ ...intent, sequence: 2, presentationFence: proof });
  expect(m.surface.validateStop).toHaveBeenCalled();
  expect(m.write).toHaveBeenLastCalledWith(expect.objectContaining({ stopProof: {
    operation: 1, seek: 1, pair: 1, globalTicks: 120000, firstID: 1, secondID: 2 } }));
  expect(backend.confirmsPresentation?.({ ...owner, revision: 1, sequence: 1,
    seekId: 1, time: 1, phase: 'paused', rate: 0, videoReady: true, audioReady: true,
    audioTrack: 0, volume: 0, muted: true, error: null })).toBe(true);
  expect(backend.confirmsPresentedStop?.({ ...proof, ids: [1, 2] })).toBe(true);
  const a = backend.close(); expect(backend.close()).toBe(a);
  await expect(a).resolves.toEqual({ ...closed, presentedStop: proof });
  expect(m.surface.drain).toHaveBeenCalledWith(true);
  expect(m.done.mock.invocationCallOrder[0]).toBeLessThan(m.surface.drain.mock.invocationCallOrder[0]);
  expect(m.activityStop).toHaveBeenCalledOnce(); expect(m.remove).toHaveBeenCalledOnce();
});
it('acquires no resource when closed before initialization', async () => {
  const backend = make();
  await expect(backend.close()).resolves.toMatchObject({ processStarted: false });
  expect(m.createSession).not.toHaveBeenCalled(); expect(m.factory).not.toHaveBeenCalled();
});
it('revalidates the source before launch and returns a closeable failed owner', async () => {
  const p = plan(); vi.mocked(p.assertCurrent).mockRejectedValue(Error('changed'));
  const backend = make(p); await expect(backend.write(intent)).rejects.toThrow('changed');
  await expect(backend.close()).resolves.toMatchObject({ processStarted: false });
  expect(m.createSession).not.toHaveBeenCalled();
});
it.each(['addon', 'surface', 'factory', 'activity'] as const)(
  'keeps ownership through %s initialization failure', async (failure) => {
    if (failure === 'addon') m.createSurface.mockImplementation(() => { throw Error(failure); });
    if (failure === 'surface') m.surface.start.mockImplementation(() => { throw Error(failure); });
    if (failure === 'factory') m.factory.mockImplementation(() => { throw Error(failure); });
    if (failure === 'activity') m.activityStart.mockImplementation(() => { throw Error(failure); });
    const backend = make(); await expect(backend.write(intent)).rejects.toThrow(failure);
    if (failure === 'factory') {
      await expect(backend.close()).rejects.toThrow('INITIALIZATION_UNKNOWN');
      expect(m.remove).not.toHaveBeenCalled(); expect(m.surface.close).not.toHaveBeenCalled();
    } else {
      await backend.close();
      expect(m.close).toHaveBeenCalledTimes(failure === 'activity' ? 1 : 0);
    }
  },
);
it.each(['hash', 'engine', 'held', 'quarantine', 'clock', 'success', 'peak'] as const)(
  'retains its own session on unconfirmed %s receipt', async (failure) => {
    const backend = make(); await backend.write(intent);
    const altered = { ...receipt, ...(failure === 'engine' ? { engine: 'AVPlayer' } : {}),
      ...(failure === 'held' ? { heldBytes: 1 } : {}),
      ...(failure === 'quarantine' ? { quarantinedBytes: 1 } : {}),
      ...(failure === 'clock' ? { stoppedClock: {} } : {}),
      ...(failure === 'peak' ? { peakChargedImageBytes: 536870913 } : {}),
      ...(failure === 'success' ? { success: false } : {}) };
    bytes = Buffer.from(JSON.stringify(altered));
    if (failure === 'hash') m.read.mockResolvedValue(Buffer.from('{}'));
    await expect(backend.close()).rejects.toThrow();
    expect(m.remove).not.toHaveBeenCalled(); expect(m.activityStop).toHaveBeenCalledOnce();
  },
);
it.each([true, false])('preserves an original child error; physical termination confirmed=%s', async (confirmed) => {
  const original = Error('original child failure');
  const backend = make(); await backend.write(intent);
  m.close.mockRejectedValue(original);
  m.termination.mockResolvedValue(confirmed ? closed : null);
  m.surface.drain.mockRejectedValue(Error('cleanup failure'));
  m.activityStop.mockImplementation(() => { throw Error('activity failure'); });
  await expect(backend.close()).rejects.toBe(original);
  expect(m.surface.drain).toHaveBeenCalledTimes(confirmed ? 1 : 0);
  expect(m.surface.close).not.toHaveBeenCalled(); expect(m.remove).not.toHaveBeenCalled();
  expect(m.activityStop).toHaveBeenCalledOnce();
});
it('does not delete the session or pretend closure when GPU drainage fails', async () => {
  const backend = make(); await backend.write(intent);
  m.surface.drain.mockRejectedValue(Error('GPU outstanding'));
  await expect(backend.close()).rejects.toThrow('GPU outstanding');
  expect(m.remove).not.toHaveBeenCalled(); expect(m.surface.close).not.toHaveBeenCalled();
});
