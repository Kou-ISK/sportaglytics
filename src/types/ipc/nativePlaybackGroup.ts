import {
  arrayValue,
  exactKeys,
  integerValue,
  numberValue,
  objectValue,
  stringValue,
} from '../../shared/validation/jsonValues';

/** Selection grants no path, executable, timestamp or signature authority. */
export interface NativePlaybackGroupSelection {
  angleIds: readonly [string, string];
  audioAngleId: string;
}
export const parseNativePlaybackGroupSelection = (
  raw: unknown,
): NativePlaybackGroupSelection => {
  const value = objectValue(raw);
  exactKeys(value, ['angleIds', 'audioAngleId']);
  const ids = arrayValue(value.angleIds, 2, 2).map((id) =>
    stringValue(id, 1, 128),
  );
  const audioAngleId = stringValue(value.audioAngleId, 1, 128);
  if (ids[0] === ids[1] || !ids.includes(audioAngleId))
    throw Error('NATIVE_GROUP_SELECTION');
  return { angleIds: [ids[0], ids[1]], audioAngleId };
};

/** Main's current one-clip-per-angle qualification, not Renderer source proof. */
export interface NativePlaybackGroupAngle {
  angleId: string;
  clipId: string;
  sourceUrl: string;
  sourceTimeOffset: number;
  globalStart: number;
  globalEnd: number;
  sourceEnd: number;
  audioTracks: number;
}
export interface NativePlaybackGroupBinding {
  audioAngleId: string;
  angles: readonly [NativePlaybackGroupAngle, NativePlaybackGroupAngle];
}
export const parseNativePlaybackGroupBinding = (
  raw: unknown,
): NativePlaybackGroupBinding => {
  const value = objectValue(raw);
  exactKeys(value, ['audioAngleId', 'angles']);
  const angles = arrayValue(value.angles, 2, 2).map(
    (raw): NativePlaybackGroupAngle => {
      const item = objectValue(raw);
      exactKeys(item, [
        'angleId',
        'clipId',
        'sourceUrl',
        'sourceTimeOffset',
        'globalStart',
        'globalEnd',
        'sourceEnd',
        'audioTracks',
      ]);
      const sourceUrl = stringValue(item.sourceUrl, 1, 8192);
      const globalStart = numberValue(item.globalStart, 0, 86400);
      const globalEnd = numberValue(item.globalEnd, 0, 86400);
      const sourceEnd = numberValue(item.sourceEnd, Number.MIN_VALUE, 86400);
      const sourceTimeOffset = numberValue(
        item.sourceTimeOffset,
        -86400,
        86400,
      );
      const times = [globalStart, globalEnd, sourceEnd, sourceTimeOffset];
      const ticks = times.map((time) => Math.round(time * 120000));
      if (
        times.some((time, index) => ticks[index] / 120000 !== time) ||
        new URL(sourceUrl).protocol !== 'file:' ||
        ticks[0] >= ticks[1] ||
        ticks[0] + ticks[3] < 0 ||
        ticks[1] + ticks[3] > ticks[2]
      )
        throw Error('NATIVE_GROUP_BINDING_RANGE');
      return {
        angleId: stringValue(item.angleId, 1, 128),
        clipId: stringValue(item.clipId, 1, 128),
        sourceUrl,
        sourceTimeOffset,
        globalStart,
        globalEnd,
        sourceEnd,
        audioTracks: integerValue(item.audioTracks, 1, 8),
      };
    },
  );
  const audioAngleId = stringValue(value.audioAngleId, 1, 128);
  if (
    angles[0].angleId === angles[1].angleId ||
    !angles.some((angle) => angle.angleId === audioAngleId) ||
    Math.max(...angles.map((angle) => angle.globalStart)) >=
      Math.min(...angles.map((angle) => angle.globalEnd))
  )
    throw Error('NATIVE_GROUP_BINDING');
  return { audioAngleId, angles: [angles[0], angles[1]] };
};
