import { expect, it } from 'vitest';
import { GroupFrameAdmission } from './groupFrameAdmission';
import type { NativePackageSourcePlan } from '../nativePackageSourcePlan';
import type { NativePlaybackIntent } from '../../../../src/types/ipc/nativePlayback';
import type { NativeGroupFrameIdentity } from '../../../../src/types/ipc/nativeGroupSurface';

const owner = { generation: 'group-owner', sourceKey: 'a'.repeat(64) };
const plan: NativePackageSourcePlan = {
  key: owner.sourceKey,
  end: 10,
  angleIds: ['a', 'b'],
  sources: ['a', 'b'].map((id, index) => ({
    angleId: id,
    clipId: 'clip',
    sourceKey: String(index).repeat(64),
    path: `fixtures/${id}.mp4`,
    url: `fixtures/${id}.mp4`,
    durationSeconds: 10,
    globalStart: -index * 0.5,
    globalEnd: 10 - index * 0.5,
    sourceTimeOffset: index * 0.5,
  })),
  assertCurrent: async (): Promise<void> => {},
  resolve(time) {
    return ['a', 'b'].map((id, index) =>
      time < 10 - index * 0.5
        ? {
            angleId: id,
            kind: 'source',
            sourceKey: String(index).repeat(64),
            sourceTime: time + index * 0.5,
            sourceTimeOffset: index * 0.5,
            globalStart: 0,
            globalEnd: 10 - index * 0.5,
          }
        : { angleId: id, kind: 'blank', globalStart: 9.5, globalEnd: 10 },
    );
  },
};
const intent = (sequence = 1, seekId = 1): NativePlaybackIntent => ({
  ...owner,
  sequence,
  seekId,
  targetTime: 5,
  playing: false,
  rate: 1,
  audioTrack: 0,
  volume: 1,
  muted: false,
});
const frame = (angle = 0, pair = 1): NativeGroupFrameIdentity => ({
  id: pair * 2 + angle - 1,
  operation: 1,
  seekId: 1,
  pair,
  angle,
  sourceEpoch: 1,
  sourceIndex: angle,
  sourcePTS: 600000 + angle * 60000,
  sourceEndPTS: 602002 + angle * 60000,
  globalTicks: 600000,
  globalStart: 600000,
  globalEnd: 602002,
  content: 'image',
});

it('does not combine a new operation with an old operation reusing the same pair ID', () => {
  const admission = new GroupFrameAdmission(plan, owner);
  admission.expect(intent());
  admission.accept(frame(0));
  admission.expect(intent(2, 1));
  expect(() => admission.accept({ ...frame(1), operation: 2 })).toThrow(
    'NATIVE_GROUP_PAIR_OPERATION',
  );
  expect(admission.accept({ ...frame(1, 2), operation: 2 })).not.toBeNull();
});

it('accepts both source clocks mapped to one canonical interval without comparing their raw PTS', () => {
  const admission = new GroupFrameAdmission(plan, owner);
  admission.expect(intent());
  expect(admission.accept(frame(0))).toEqual(frame(0));
  expect(admission.accept(frame(1))).toEqual(frame(1));
  expect(admission.accept(frame(0))).toBeNull();
  expect(admission.accept(frame(0, 2))).toEqual(frame(0, 2));
});
it('does not admit a source from the other angle or fake a source/global time mapping', () => {
  for (const bad of [
    { ...frame(0), sourceIndex: 1 },
    { ...frame(1), sourcePTS: 600000, sourceEndPTS: 602002 },
    { ...frame(1), globalStart: 600001, globalEnd: 602003 },
    { ...frame(0), sourcePTS: 600001 },
  ]) {
    const admission = new GroupFrameAdmission(plan, owner);
    admission.expect(intent());
    expect(() => admission.accept(bad)).toThrow();
  }
});
it('drops old operations/source epochs and does not let a new pair rebind one source epoch', () => {
  const admission = new GroupFrameAdmission(plan, owner);
  admission.expect(intent());
  admission.accept({ ...frame(), sourceEpoch: 2 });
  expect(admission.accept({ ...frame(0, 2), sourceEpoch: 1 })).toBeNull();
  expect(() =>
    admission.accept({ ...frame(0, 2), sourceIndex: 1, sourceEpoch: 2 }),
  ).toThrow('NATIVE_GROUP_SOURCE_EPOCH');
  admission.expect(intent(2, 2));
  expect(admission.accept({ ...frame(0, 3), sourceEpoch: 3 })).toBeNull();
  expect(() =>
    admission.accept({
      ...frame(0, 3),
      operation: 3,
      seekId: 2,
      sourceEpoch: 3,
    }),
  ).toThrow('NATIVE_GROUP_FRAME_OPERATION');
  expect(
    admission.accept({
      ...frame(0, 3),
      operation: 2,
      seekId: 2,
      sourceEpoch: 3,
    }),
  ).not.toBeNull();
  expect(() => admission.expect(intent(1))).toThrow(
    'NATIVE_GROUP_INTENT_OWNER',
  );
});
it('requires real blank coverage at the secondary endpoint and rejects coverage past the package end', () => {
  const admission = new GroupFrameAdmission(plan, owner);
  admission.expect(intent());
  const blank: NativeGroupFrameIdentity = {
    ...frame(1),
    sourceIndex: 32,
    sourcePTS: 0,
    sourceEndPTS: 0,
    globalTicks: 1170000,
    globalStart: 1140000,
    globalEnd: 1200000,
    content: 'blank',
  };
  expect(admission.accept(blank)).toEqual(blank);
  const fresh = new GroupFrameAdmission(plan, owner);
  fresh.expect(intent());
  expect(() =>
    fresh.accept({
      ...blank,
      content: 'image',
      sourceIndex: 1,
      sourcePTS: 1170000,
      sourceEndPTS: 1230000,
    }),
  ).toThrow('NATIVE_GROUP_BLANK_REQUIRED');
  expect(() => fresh.accept({ ...blank, globalStart: 1139999 })).toThrow(
    'NATIVE_GROUP_FRAME_PLACEMENT',
  );
  expect(() => fresh.accept({ ...blank, globalEnd: 1200001 })).toThrow(
    'NATIVE_GROUP_FRAME_PLACEMENT',
  );
});
it('rejects malformed identity/interval values and never accepts a legacy or future protocol shape', () => {
  for (const patch of [
    { id: NaN },
    { operation: 0 },
    { angle: 2 },
    { globalTicks: Infinity },
    { globalEnd: 600000 },
    { sourceEndPTS: 600000 },
    { sourceIndex: 32 },
    { content: 'other' },
    { handle: 'forbidden' },
  ]) {
    const admission = new GroupFrameAdmission(plan, owner);
    admission.expect(intent());
    expect(() => admission.accept({ ...frame(), ...patch })).toThrow();
  }
  expect(
    () =>
      new GroupFrameAdmission(plan, { ...owner, sourceKey: 'b'.repeat(64) }),
  ).toThrow('NATIVE_GROUP_PLAN_SCOPE');
});

it('does not combine two individually valid frames with different canonical anchors', () => {
  const admission = new GroupFrameAdmission(plan, owner);
  admission.expect(intent());
  admission.accept(frame(0));
  expect(() => admission.accept({ ...frame(1), globalTicks: 600001 })).toThrow(
    'NATIVE_GROUP_PAIR_ANCHOR',
  );
  expect(admission.accept(frame(1))).toEqual(frame(1));
});

it('bounds incomplete pair bookkeeping and rejects a second delivery for the same pair slot', () => {
  const admission = new GroupFrameAdmission(plan, owner);
  admission.expect(intent());
  admission.accept(frame());
  expect(() => admission.accept({ ...frame(), id: 100 })).toThrow(
    'NATIVE_GROUP_PAIR_DUPLICATE',
  );
  for (let pair = 2; pair <= 6; pair++) admission.accept(frame(0, pair));
  expect(() => admission.accept(frame(0, 7))).toThrow(
    'NATIVE_GROUP_PAIR_BOUND',
  );
  admission.expect(intent(2, 2));
  expect(
    admission.accept({ ...frame(0, 7), operation: 2, seekId: 2 }),
  ).not.toBeNull();
});
