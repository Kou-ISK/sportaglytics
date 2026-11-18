import { expect, it } from 'vitest';
import { GroupPresentationLedger } from './groupPresentationLedger';
import type { NativeGroupSurfaceMetadata } from '../../../../src/types/ipc/nativeGroupSurface';
import type { NativePlaybackIntent } from '../../../../src/types/ipc/nativePlayback';
const owner = { generation: 'owner', sourceKey: 'a'.repeat(64) };
const intent: NativePlaybackIntent = {
  ...owner,
  sequence: 2,
  seekId: 1,
  targetTime: 20,
  playing: false,
  rate: -2,
  audioTrack: 0,
  volume: 1,
  muted: false,
};
const frame = (angle: number, pair = 1): NativeGroupSurfaceMetadata => ({
  version: 2,
  document: 'doc',
  generation: 'owner',
  id: pair * 2 - 1 + angle,
  operation: 1,
  seekId: 1,
  pair,
  angle,
  sourceEpoch: 1,
  sourceIndex: angle,
  sourcePTS: 600000,
  sourceEndPTS: 602002,
  globalTicks: 600000,
  globalStart: 600000,
  globalEnd: 602002,
  content: 'image',
});
const proof = (pair = 1) => ({
  document: 'doc',
  generation: 'owner',
  operation: 1,
  seekId: 1,
  pair,
  globalTicks: 600000,
  ids: [pair * 2 - 1, pair * 2],
});

it('validates a held release using the published pair before delayed Drawn ACKs arrive, never its requested clock', () => {
  const ledger = new GroupPresentationLedger();
  ledger.publish(frame(0));
  ledger.publish(frame(1));
  expect(ledger.presented()).toBeNull();
  expect(ledger.stop(proof(), intent, owner).globalTicks).toBe(600000);
  expect(ledger.drawn(frame(0))).toBeNull();
  expect(ledger.drawn(frame(1))?.ids).toEqual([1, 2]);
});
it('rejects unissued/incomplete pairs, changed owner/seek, changed time and invented surface IDs', () => {
  const ledger = new GroupPresentationLedger();
  ledger.publish(frame(0));
  expect(() => ledger.stop(proof(), intent, owner)).toThrow('INCOMPLETE');
  ledger.publish(frame(1));
  for (const raw of [
    { ...proof(), globalTicks: 600001 },
    { ...proof(), ids: [1, 4] },
    { ...proof(), document: 'other' },
    { ...proof(), generation: 'other' },
    { ...proof(), seekId: 2 },
    { ...proof(), ids: [1, 1] },
    { ...proof(), handle: 9 },
  ])
    expect(() => ledger.stop(raw, intent, owner)).toThrow();
  expect(() =>
    ledger.stop(proof(), { ...intent, playing: true }, owner),
  ).toThrow('OWNER');
  expect(() => ledger.stop(proof(), { ...intent, sequence: 1 }, owner)).toThrow(
    'OWNER',
  );
  expect(() => ledger.stop(proof(), { ...intent, seekId: 2 }, owner)).toThrow(
    'OWNER',
  );
});
it('late old completion cannot replace a newer actual presented pair', () => {
  const ledger = new GroupPresentationLedger();
  for (const pair of [1, 2])
    for (const angle of [0, 1]) ledger.publish(frame(angle, pair));
  ledger.drawn(frame(0, 2));
  ledger.drawn(frame(1, 2));
  ledger.drawn(frame(0));
  ledger.drawn(frame(1));
  expect(ledger.presented()?.pair).toBe(2);
  expect(() => ledger.stop(proof(1), intent, owner)).toThrow('STALE');
});
it('bounds history, expires old proofs, and returns copies that do not mutate its stop authority', () => {
  const ledger = new GroupPresentationLedger();
  for (let pair = 1; pair <= 65; pair++)
    for (const angle of [0, 1]) ledger.publish(frame(angle, pair));
  expect(() => ledger.stop(proof(1), intent, owner)).toThrow('EXPIRED');
  const value = ledger.stop(proof(65), intent, owner);
  value.globalTicks = 9;
  expect(ledger.stop(proof(65), intent, owner).globalTicks).toBe(600000);
});
it('confirms only complete Drawn history, with exact owner/operation/seek/time', () => {
  const ledger = new GroupPresentationLedger();
  const matches = (): boolean => ledger.confirms('owner', 1, 1, 5);
  ledger.publish(frame(0)); ledger.publish(frame(1));
  expect(matches()).toBe(false);
  ledger.drawn(frame(0)); expect(matches()).toBe(false);
  ledger.drawn(frame(1)); expect(matches()).toBe(true);
  for (const args of [
    ['other', 1, 1, 5], ['owner', 2, 1, 5], ['owner', 1, 2, 5],
    ['owner', 1, 1, 5.000001], ['owner', 1, 1, NaN],
  ] as const) expect(ledger.confirms(...args)).toBe(false);
  // A newer submission does not invalidate a delayed observation of a fully
  // acknowledged pair, but bounded eviction eventually removes its authority.
  for (let pair = 2; pair <= 65; pair++) {
    const a = { ...frame(0, pair), operation: 2 }, b = { ...frame(1, pair), operation: 2 };
    ledger.publish(a); ledger.publish(b); ledger.drawn(a); ledger.drawn(b);
  }
  expect(matches()).toBe(false);
  expect(ledger.confirms('owner', 2, 1, 5)).toBe(true);
});
it('never grants a closed receipt for partial Drawn or substituted pair/document/IDs', () => {
  const ledger = new GroupPresentationLedger();
  ledger.publish(frame(0)); ledger.publish(frame(1));
  ledger.drawn(frame(0)); expect(ledger.confirmsStop(proof())).toBe(false);
  ledger.drawn(frame(1)); expect(ledger.confirmsStop(proof())).toBe(true);
  for (const changed of [{ ids: [1, 4] }, { pair: 2 }, { document: 'other' },
    { operation: 2 }, { seekId: 2 }, { globalTicks: 600001 }])
    expect(ledger.confirmsStop({ ...proof(), ...changed })).toBe(false);
  ledger.publish(frame(0, 2)); ledger.publish(frame(1, 2));
  ledger.drawn(frame(0, 2)); ledger.drawn(frame(1, 2));
  expect(ledger.confirms('owner', 1, 1, 5)).toBe(true); // delayed observation allowed
  expect(ledger.confirmsStop(proof())).toBe(false); // old recovery anchor forbidden
  expect(ledger.confirmsStop(proof(2))).toBe(true);
});
