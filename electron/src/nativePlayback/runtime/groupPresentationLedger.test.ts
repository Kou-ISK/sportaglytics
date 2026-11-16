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
