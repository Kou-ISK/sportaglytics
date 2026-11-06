import { expect, it, vi } from 'vitest';
import { NativePlaybackManager } from './nativePlaybackManager';
import type { QualifiedNativeSource } from './nativePlaybackManager';
import type { NativePlaybackOwner } from '../../../src/types/ipc/nativePlayback';
import { createCommandLeftBroker } from '../nativeInput/commandLeftBroker';
import { createCommandLeftHealth } from '../nativeInput/commandLeftHealth';
const make = () => {
  let context: string | null = 'document-a';
  let owner: NativePlaybackOwner | null = null;
  const close = vi.fn(async () => ({
    generation: owner?.generation ?? '',
    nativeDrained: true,
    processStarted: true,
    processExited: true,
    pipesClosed: true,
    stopped: null,
  }));
  const backend = {
    write: vi.fn(async () => {}),
    close,
    reportFailure: vi.fn(),
  };
  const source: QualifiedNativeSource = {
    sourceKey: 'a'.repeat(64),
    sourceUrl: 'file:///synthetic.mp4',
    sourceEnd: 20.00020033333333,
    scope: { start: 0, end: 20, audioTracks: 3, rates: [1] },
    assertCurrent: vi.fn(async () => {}),
    createBackend: vi.fn((value) => {
      owner = value;
      return backend;
    }),
  };
  const publish = vi.fn();
  const manager = new NativePlaybackManager({
    publish,
    context: () => context,
    qualify: async () => source,
  });
  return {
    manager,
    publish,
    source,
    backend,
    changeDocument: () => {
      context = 'document-b';
    },
  };
};
it('default qualification is disabled and does not start a helper', async () => {
  const manager = new NativePlaybackManager({
    context: () => 'a',
    qualify: null,
  });
  expect(await manager.inspect()).toEqual({
    available: false,
    presentation: null,
    owner: null,
    sourceUrl: null,
    sourceEnd: null,
    reason: 'disabled',
  });
});
it('rechecks source and document after async open validation', async () => {
  const { manager, source, changeDocument } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  vi.mocked(source.assertCurrent).mockImplementationOnce(async () => {
    changeDocument();
  });
  await expect(manager.open(available.owner)).rejects.toThrow(
    'NATIVE_OWNER_CHANGED',
  );
  expect(source.createBackend).not.toHaveBeenCalled();
});
it('rejects a gesture revoked during source validation before a host write', async () => {
  const { manager, source, backend } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  const check = Promise.withResolvers<void>();
  vi.mocked(source.assertCurrent).mockReturnValueOnce(check.promise);
  let allowed = true;
  const work = manager.applyGuarded({
    ...available.owner, sequence: 1, seekId: 1, targetTime: 3,
    playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true,
  }, () => allowed);
  const rejected = expect(work).rejects.toThrow('NATIVE_GESTURE_REVOKED');
  allowed = false;
  check.resolve();
  await rejected;
  expect(backend.write).not.toHaveBeenCalled();
  await manager.close(available.owner);
});
it('drains the actual manager on revoked input before admitting a new gesture', async () => {
  const { manager, source, backend } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  const broker = createCommandLeftBroker({ reset: () => 0 });
  const window = {
    isDestroyed: () => false,
    matchesWindow: (id: number) => id === 7,
    sendEvent: vi.fn(), sendOverflow: vi.fn(), captureStart: () => true,
    stopCaptured: async () => {
      const receipt = await manager.close(available.owner!);
      return receipt.nativeDrained && receipt.processExited && receipt.pipesClosed;
    },
  };
  const epoch = broker.arm(window, window);
  if (epoch === null) throw Error('missing epoch');
  broker.receive({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false }, window);
  expect(broker.claimStart(window, window, 1, epoch)).toBe('active');
  const check = Promise.withResolvers<void>();
  vi.mocked(source.assertCurrent).mockReturnValueOnce(check.promise);
  const work = manager.applyGuarded({
    ...available.owner, sequence: 1, seekId: 1, targetTime: 3,
    playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true,
  }, () => broker.isClaimCurrent(window, 1, epoch));
  const rejected = expect(work).rejects.toThrow();
  broker.disarm(window);
  expect(broker.arm(window, window)).toBeNull();
  check.resolve();
  await rejected;
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(backend.write).not.toHaveBeenCalled();
  expect(backend.close).toHaveBeenCalledOnce();
  expect(broker.revoke(window, epoch)).toBe('already-revoked');
});
it('closes the captured actual manager when monitor health becomes unavailable', async () => {
  const { manager, backend } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  let send: ((raw: unknown) => boolean) | null = null;
  let faulted = false;
  const monitor = {
    start: (callback: (raw: unknown) => boolean) => { send = callback; },
    stop: () => {}, reset: () => 0,
    health: () => ({ faulted, faultSerial: 0, faultGesture: 0, faultWindow: 0 }),
  };
  const broker = createCommandLeftBroker(monitor);
  const window = { isDestroyed: () => false, matchesWindow: () => true,
    sendEvent: () => {}, sendOverflow: () => {}, captureStart: () => true,
    stopCaptured: async () => {
      const receipt = await manager.close(available.owner!);
      return receipt.nativeDrained && receipt.processExited && receipt.pipesClosed;
    },
  };
  const health = createCommandLeftHealth(monitor, broker, () => window);
  expect(health.start()).toBe(true);
  const epoch = broker.arm(window, window);
  if (epoch === null || !send) throw Error('missing input');
  const deliver: (raw: unknown) => boolean = send;
  expect(deliver({ phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
    meta: true, shift: false, alt: false, control: false })).toBe(true);
  expect(broker.claimStart(window, window, 1, epoch)).toBe('active');
  faulted = true;
  health.poll();
  expect(broker.isClaimCurrent(window, 1, epoch)).toBe(false);
  for (let i = 0; i < 20; i++) await Promise.resolve();
  expect(backend.close).toHaveBeenCalledOnce();
  expect(broker.arm(window, window)).toBeNull();
  health.dispose();
});
it('does not drain a different owner when a stale gesture requests a close', async () => {
  const { manager, backend } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  expect(() => manager.close({ ...available.owner!, generation: 'stale' }))
    .toThrow('NATIVE_OWNER_CHANGED');
  expect(backend.close).not.toHaveBeenCalled();
  await manager.close(available.owner);
});
it('allows the captured owner to await an existing drain after invalidation', async () => {
  const { manager, backend, changeDocument } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  changeDocument();
  expect(() => manager.observe(available.owner!)).toThrow('NATIVE_OWNER_CHANGED');
  const first = manager.close(available.owner);
  const second = manager.close(available.owner);
  expect(first).toBe(second);
  expect((await first).nativeDrained).toBe(true);
  expect(backend.close).toHaveBeenCalledOnce();
});

it('drains instead of delivering a revoked gesture queued behind a host write', async () => {
  const { manager, backend } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  const first = Promise.withResolvers<void>();
  backend.write.mockReturnValueOnce(first.promise);
  const base = { ...available.owner, seekId: 1, targetTime: 3,
    rate: 1, audioTrack: 0, volume: 0.5, muted: true };
  await manager.apply({ ...base, sequence: 1, playing: false });
  let allowed = true;
  await manager.applyGuarded({ ...base, sequence: 2, playing: true }, () => allowed);
  // A volume change must not replace the queued start's revocation guard.
  await manager.apply({ ...base, sequence: 3, playing: true, volume: 0.7 });
  // A pause may be coalesced away before a same-transport resume reaches Host.
  await manager.apply({ ...base, sequence: 4, playing: false });
  await manager.apply({ ...base, sequence: 5, playing: true });
  allowed = false;
  first.resolve();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  expect(backend.write).toHaveBeenCalledTimes(1);
  expect(backend.close).toHaveBeenCalledOnce();
  await manager.close(available.owner);
});
it('rejects another owner and drains a vanished Session before shutdown can finish', async () => {
  const { manager, backend, changeDocument } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  expect(() =>
    manager.observe({ ...available.owner, generation: 'other' }),
  ).toThrow();
  changeDocument();
  expect(() => manager.observe(available.owner!)).toThrow();
  const release = await manager.hold();
  release();
  expect(backend.close).toHaveBeenCalledTimes(1);
  const next = await manager.inspect();
  expect(next.available).toBe(true);
  expect(next.owner?.generation).not.toBe(available.owner.generation);
  expect(() => manager.observe(available.owner!)).toThrow(
    'NATIVE_OWNER_CHANGED',
  );
});
it('cleanup failure blocks quit and a replacement owner', async () => {
  const { manager, backend } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  await manager.open(available.owner);
  backend.close.mockRejectedValue(Error('unknown pipe close'));
  await expect(manager.hold()).rejects.toThrow();
  expect((await manager.inspect()).reason).toBe('busy');
  expect(() => manager.observe(available.owner!)).toThrow();
});

it('cancels a held source check before a backend exists and records never-started cleanup', async () => {
  const { manager, source } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  const check = Promise.withResolvers<void>();
  vi.mocked(source.assertCurrent).mockReturnValueOnce(check.promise);
  const open = manager.open(available.owner);
  const rejected = expect(open).rejects.toThrow('NATIVE_OWNER_CHANGED');
  const close = manager.close(available.owner);
  check.resolve();
  await rejected;
  expect(await close).toMatchObject({
    processStarted: false,
    nativeDrained: true,
    processExited: true,
    pipesClosed: true,
    stopped: null,
  });
  expect(source.createBackend).not.toHaveBeenCalled();
});
it('cannot replace an active owner from a stale inspect completion', async () => {
  const { manager, source } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('test owner');
  const check = Promise.withResolvers<void>();
  vi.mocked(source.assertCurrent).mockReturnValueOnce(check.promise);
  const inspect = manager.inspect();
  await Promise.resolve();
  await manager.open(available.owner);
  check.resolve();
  expect((await inspect).available).toBe(false);
  expect(() => manager.observe(available.owner!)).not.toThrow();
  await manager.close(available.owner);
});
it('retains an uncertain factory outcome and validates scope before creation', async () => {
  const bad = make();
  bad.source.scope.end = -1;
  const available = await bad.manager.inspect();
  if (!available.owner) throw Error('test owner');
  await expect(bad.manager.open(available.owner)).rejects.toThrow(
    'NATIVE_INVALID_SCOPE',
  );
  expect(bad.source.createBackend).not.toHaveBeenCalled();
  const unknown = make();
  const inspected = await unknown.manager.inspect();
  if (!inspected.owner) throw Error('test owner');
  vi.mocked(unknown.source.createBackend).mockImplementation(() => {
    throw Error('factory outcome unknown');
  });
  await expect(unknown.manager.open(inspected.owner)).rejects.toThrow();
  await expect(unknown.manager.hold()).rejects.toThrow(
    'NATIVE_INITIALIZATION_UNKNOWN',
  );
});

it('allows a new generation only after close and pending delivery are confirmed', async () => {
  const { manager, backend, source } = make();
  const first = await manager.inspect();
  if (!first.owner) throw Error('test owner');
  await manager.open(first.owner);
  const closing =
    Promise.withResolvers<Awaited<ReturnType<typeof backend.close>>>();
  backend.close.mockReturnValueOnce(closing.promise);
  const close = manager.close(first.owner);
  expect((await manager.inspect()).reason).toBe('busy');
  closing.resolve({
    generation: first.owner.generation,
    nativeDrained: true,
    processStarted: true,
    processExited: true,
    pipesClosed: true,
    stopped: null,
  });
  await close;
  const next = await manager.inspect();
  if (!next.owner) throw Error('new owner');
  expect(next.owner.generation).not.toBe(first.owner.generation);
  expect(() => manager.close(first.owner!)).toThrow('NATIVE_OWNER_CHANGED');
  await manager.open(next.owner);
  expect(source.createBackend).toHaveBeenCalledTimes(2);
  await manager.close(next.owner);
});

it('can qualify a changed document when navigation invalidated an unowned manager', async () => {
  const { manager, source, changeDocument } = make();
  changeDocument();
  manager.invalidate();
  expect((await manager.inspect()).available).toBe(true);
  expect(source.createBackend).not.toHaveBeenCalled();
});

it('publishes validated failure state without polling and suppresses stale document updates', async () => {
  const { manager, source, publish, changeDocument } = make();
  let observe: (value: unknown) => void = () => {};
  const factory = source.createBackend;
  source.createBackend = (owner, callback) => {
    observe = callback;
    return factory(owner, callback);
  };
  const available = await manager.inspect();
  if (!available.owner) throw Error('owner');
  await manager.open(available.owner);
  observe(null);
  expect(publish).toHaveBeenLastCalledWith(
    available.owner,
    expect.objectContaining({ error: 'protocol' }),
  );
  publish.mockClear();
  changeDocument();
  observe(null);
  expect(publish).not.toHaveBeenCalled();
  await manager.close(available.owner);
});

it('pushes an asynchronous write failure without waiting for another native observation', async () => {
  const { manager, backend, publish } = make();
  const available = await manager.inspect();
  if (!available.owner) throw Error('owner');
  await manager.open(available.owner);
  backend.write.mockRejectedValueOnce(Error('write failed'));
  await manager.apply({
    ...available.owner,
    sequence: 1,
    seekId: 1,
    targetTime: 3,
    playing: false,
    rate: 1,
    audioTrack: 0,
    volume: 0.5,
    muted: true,
  });
  for (let i = 0; i < 10; i++) await Promise.resolve();
  expect(publish).toHaveBeenCalledWith(
    available.owner,
    expect.objectContaining({ error: 'protocol', closing: true }),
  );
  expect(backend.close).toHaveBeenCalledOnce();
  await manager.close(available.owner);
});
it('ignores a previous backend callback after a drained same-document reopen', async () => {
  const { manager, source, publish } = make();
  const callbacks: ((value: unknown) => void)[] = [];
  const factory = source.createBackend;
  source.createBackend = (owner, callback) => {
    callbacks.push(callback);
    return factory(owner, callback);
  };
  const first = await manager.inspect();
  if (!first.owner) throw Error('owner');
  await manager.open(first.owner);
  await manager.close(first.owner);
  const second = await manager.inspect();
  if (!second.owner) throw Error('owner');
  await manager.open(second.owner);
  publish.mockClear();
  callbacks[0](null);
  expect(publish).not.toHaveBeenCalled();
  expect(manager.observe(second.owner).error).toBeNull();
  await manager.close(second.owner);
});

const failureEvidence = {
  stage: 2,
  code: 26,
  sequence: 1,
  seekId: 1,
  targetTime: 3,
  confirmedTime: 3,
};
it('keeps one diagnostic sink after clean close, and drops it on new qualification', async () => {
  const { manager, backend } = make();
  const first = await manager.inspect();
  if (!first.owner) throw Error('owner');
  await manager.open(first.owner);
  await manager.close(first.owner);
  expect(() =>
    manager.reportFailure(
      { ...first.owner, generation: 'foreign' },
      failureEvidence,
    ),
  ).toThrow();
  expect(() =>
    manager.reportFailure(first.owner!, {
      ...failureEvidence,
      targetTime: NaN,
    }),
  ).toThrow();
  manager.reportFailure(first.owner, failureEvidence);
  manager.reportFailure(first.owner, failureEvidence);
  expect(backend.reportFailure).toHaveBeenCalledExactlyOnceWith(
    failureEvidence,
  );
  await manager.inspect();
  expect(() => manager.reportFailure(first.owner!, failureEvidence)).toThrow(
    'NATIVE_OWNER_CHANGED',
  );
});
it('rejects evidence from changed documents and isolates a throwing optional sink', async () => {
  const { manager, backend, changeDocument } = make();
  const first = await manager.inspect();
  if (!first.owner) throw Error('owner');
  await manager.open(first.owner);
  backend.reportFailure.mockImplementation(() => {
    throw Error('disk');
  });
  expect(() =>
    manager.reportFailure(first.owner!, failureEvidence),
  ).not.toThrow();
  await manager.close(first.owner);
  changeDocument();
  expect(() => manager.reportFailure(first.owner!, failureEvidence)).toThrow(
    'NATIVE_OWNER_CHANGED',
  );
  expect(backend.close).toHaveBeenCalledTimes(1);
});
