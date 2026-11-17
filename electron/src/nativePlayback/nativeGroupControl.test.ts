import { expect, it } from 'vitest';
import { nativeGroupHostIntent } from './nativeGroupControl';
import { GroupPresentationLedger } from './runtime/groupPresentationLedger';
import type { NativeGroupSurfaceMetadata } from '../../../src/types/ipc/nativeGroupSurface';
const owner = { generation: 'owner', sourceKey: 'a'.repeat(64) };
const fence = {
  generation: 'owner',
  document: 'doc',
  operation: 2,
  seekId: 1,
  pair: 1,
  globalTicks: 2300000,
  ids: [1, 2],
};
const stopped = {
  ...owner,
  sequence: 3,
  seekId: 1,
  targetTime: 20,
  playing: false,
  rate: -2,
  audioTrack: 0,
  volume: 1,
  muted: true,
  presentationFence: fence,
};
const frame = (angle: number): NativeGroupSurfaceMetadata => ({
  document: 'doc',
  generation: 'owner',
  operation: 2,
  seekId: 1,
  pair: 1,
  globalTicks: 2300000,
  id: angle + 1,
  version: 2,
  angle,
  sourceEpoch: 1,
  sourceIndex: angle,
  sourcePTS: 2299000,
  sourceEndPTS: 2301000,
  globalStart: 2299000,
  globalEnd: 2301000,
  content: 'image',
});
it('validates the actual published pair even before its delayed Drawn ACK, then translates only the fence', () => {
  const ledger = new GroupPresentationLedger();
  ledger.publish(frame(0));
  ledger.publish(frame(1));
  const wire = nativeGroupHostIntent(stopped, (proof, intent) =>
    ledger.stop(proof, intent, owner),
  );
  expect(wire).not.toHaveProperty('presentationFence');
  expect(wire.targetTime).toBe(20);
  expect(wire.stopProof).toEqual({
    operation: 2,
    seek: 1,
    pair: 1,
    globalTicks: 2300000,
    firstID: 1,
    secondID: 2,
  });
});
it('never translates missing, tampered, foreign or unissued proof into an authorized native stop', () => {
  const ledger = new GroupPresentationLedger();
  ledger.publish(frame(0));
  ledger.publish(frame(1));
  for (const changed of [
    { globalTicks: 2300001 },
    { ids: [1, 4] },
    { document: 'other' },
    { pair: 2 },
  ])
    expect(() =>
      nativeGroupHostIntent(
        { ...stopped, presentationFence: { ...fence, ...changed } },
        (proof, intent) => ledger.stop(proof, intent, owner),
      ),
    ).toThrow();
  expect(() =>
    nativeGroupHostIntent({ ...stopped, stopProof: {} }, (proof) => proof),
  ).toThrow();
  expect(() =>
    nativeGroupHostIntent({ ...stopped, playing: true }, (proof) => proof),
  ).toThrow();
});
it('does not let an adapter substitute a different valid clock or delivery ID', () => {
  expect(() =>
    nativeGroupHostIntent(stopped, (proof) => ({
      ...proof,
      globalTicks: 2299000,
    })),
  ).toThrow('FENCE_CHANGED');
});
