import {
  enumValue,
  exactKeys,
  integerValue,
  objectValue,
  stringValue,
} from '../../shared/validation/jsonValues';

export const nativeGroupTimescale = 120000;
export const nativeGroupMaximumTicks = 86400 * nativeGroupTimescale;
export const nativeGroupBlankSource = 32;
export const nativeGroupSurfaceChannels = {
  drawn: 'native-group-surface-drawn',
  request: 'native-group-surface-request',
  error: 'native-group-surface-error',
  blank: 'native-group-surface-blank',
} as const;
export interface NativeGroupFrameIdentity {
  id: number;
  operation: number;
  seekId: number;
  pair: number;
  angle: number;
  sourceEpoch: number;
  sourceIndex: number;
  sourcePTS: number;
  sourceEndPTS: number;
  globalTicks: number;
  globalStart: number;
  globalEnd: number;
  content: 'image' | 'blank';
}
export const nativeGroupFrameIdentityKeys = Object.freeze([
  'id',
  'operation',
  'seekId',
  'pair',
  'angle',
  'sourceEpoch',
  'sourceIndex',
  'sourcePTS',
  'sourceEndPTS',
  'globalTicks',
  'globalStart',
  'globalEnd',
  'content',
]);
const identity = (value: Record<string, unknown>): NativeGroupFrameIdentity => {
  const frame: NativeGroupFrameIdentity = {
    id: integerValue(value.id, 1),
    operation: integerValue(value.operation, 1),
    seekId: integerValue(value.seekId, 1),
    pair: integerValue(value.pair, 1),
    angle: integerValue(value.angle, 0, 1),
    sourceEpoch: integerValue(value.sourceEpoch, 1),
    sourceIndex: integerValue(value.sourceIndex, 0, nativeGroupBlankSource),
    sourcePTS: integerValue(value.sourcePTS, 0, nativeGroupMaximumTicks),
    sourceEndPTS: integerValue(value.sourceEndPTS, 0, nativeGroupMaximumTicks),
    globalTicks: integerValue(value.globalTicks, 0, nativeGroupMaximumTicks),
    globalStart: integerValue(value.globalStart, 0, nativeGroupMaximumTicks),
    globalEnd: integerValue(value.globalEnd, 0, nativeGroupMaximumTicks),
    content: enumValue(value.content, ['image', 'blank']),
  };
  if (
    frame.globalStart > frame.globalTicks ||
    frame.globalTicks >= frame.globalEnd ||
    (frame.content === 'blank'
      ? frame.sourceIndex !== nativeGroupBlankSource ||
        frame.sourcePTS !== 0 ||
        frame.sourceEndPTS !== 0
      : frame.sourceIndex === nativeGroupBlankSource ||
        frame.sourcePTS >= frame.sourceEndPTS ||
        frame.globalEnd - frame.globalStart >
          frame.sourceEndPTS - frame.sourcePTS + 1)
  )
    throw Error('NATIVE_GROUP_FRAME_INTERVAL');
  return frame;
};
export const parseNativeGroupFrameIdentity = (
  raw: unknown,
): NativeGroupFrameIdentity => {
  const value = objectValue(raw);
  exactKeys(value, nativeGroupFrameIdentityKeys);
  return identity(value);
};

/** No native pointer/handle is part of the Renderer contract. */
export interface NativeGroupSurfaceMetadata extends NativeGroupFrameIdentity {
  version: 2;
  document: string;
  generation: string;
}
/** Canvas submission receipt, not physical scanout or an independently advancing clock. */
export interface NativeGroupPresentation {
  document: string;
  generation: string;
  operation: number;
  seekId: number;
  pair: number;
  globalTicks: number;
  ids: readonly [number, number];
}
export const parseNativeGroupSurfaceMetadata = (
  raw: unknown,
): NativeGroupSurfaceMetadata => {
  const value = objectValue(raw);
  exactKeys(value, [
    ...nativeGroupFrameIdentityKeys,
    'version',
    'document',
    'generation',
  ]);
  if (value.version !== 2) throw Error('NATIVE_GROUP_SURFACE_VERSION');
  const document = stringValue(value.document, 1, 128),
    generation = stringValue(value.generation, 1, 128);
  if (!/^[\w-]+$/.test(document) || !/^[\w-]+$/.test(generation))
    throw Error('NATIVE_GROUP_SURFACE_OWNER');
  return { ...identity(value), version: 2, document, generation };
};
