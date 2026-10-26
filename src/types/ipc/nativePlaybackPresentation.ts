import {
  booleanValue,
  exactKeys,
  integerValue,
  numberValue,
  objectValue,
  enumValue,
} from '../../shared/validation/jsonValues';
import { sourceClockFraction } from '../../shared/nativePlayback/sourceClockFraction';

/** Main-qualified display/operation scope; never a renderer-selected proof. */
export interface NativePlaybackPresentation {
  width: number;
  height: number;
  start: number;
  end: number;
  /** Last inclusive target with sufficient decode/preroll reserve. */
  seekEnd: number;
  /** Backend stops its own clock here before exhausting the qualified window. */
  playEnd: number;
  rates: readonly number[];
  audioTracks: number;
  seekGrid: {
    origin: number;
    duration: number;
    timescale: number;
    /** Omission keeps the exact-field contract of a qualified backend. */
    selection?: 'containing';
  } | null;
  mutedOnly: boolean;
  exactFloatVolume: boolean;
  audioSwitch: boolean;
}
export const parseNativePlaybackPresentation = (
  raw: unknown,
): NativePlaybackPresentation => {
  const v = objectValue(raw);
  exactKeys(v, [
    'width',
    'height',
    'start',
    'end',
    'seekEnd',
    'playEnd',
    'rates',
    'audioTracks',
    'seekGrid',
    'mutedOnly',
    'exactFloatVolume',
    'audioSwitch',
  ]);
  if (!Array.isArray(v.rates) || v.rates.length < 1 || v.rates.length > 16)
    throw Error('NATIVE_INVALID_PRESENTATION');
  const start = numberValue(v.start, 0, 86400),
    end = numberValue(v.end, 0, 86400);
  const seekEnd = numberValue(v.seekEnd, start, end);
  const playEnd = numberValue(v.playEnd, seekEnd, end);
  if (end <= start || seekEnd >= playEnd || playEnd >= end)
    throw Error('NATIVE_INVALID_PRESENTATION');
  let seekGrid: NativePlaybackPresentation['seekGrid'] = null;
  if (v.seekGrid !== null) {
    const g = objectValue(v.seekGrid);
    exactKeys(g, ['origin', 'duration', 'timescale', 'selection']);
    seekGrid = {
      origin: integerValue(g.origin, 0, Number.MAX_SAFE_INTEGER),
      duration: integerValue(g.duration, 1, Number.MAX_SAFE_INTEGER),
      timescale: integerValue(g.timescale, 1, 1_000_000_000),
      ...(g.selection === undefined
        ? {}
        : { selection: enumValue(g.selection, ['containing']) }),
    };
  }
  return {
    width: integerValue(v.width, 1, 16384),
    height: integerValue(v.height, 1, 16384),
    start,
    end,
    seekEnd,
    playEnd,
    rates: v.rates.map((rate) => numberValue(rate, 0.25, 6)),
    audioTracks: integerValue(v.audioTracks, 1, 8),
    seekGrid,
    mutedOnly: booleanValue(v.mutedOnly),
    exactFloatVolume: booleanValue(v.exactFloatVolume),
    audioSwitch: booleanValue(v.audioSwitch),
  };
};
export const nativePresentationSupports = (
  scope: NativePlaybackPresentation,
  value: {
    targetTime: number;
    rate: number;
    audioTrack: number;
    volume: number;
    muted: boolean;
  },
  previousAudioTrack: number,
): boolean => {
  if (
    !Number.isFinite(value.targetTime) ||
    value.targetTime < scope.start ||
    value.targetTime > scope.seekEnd ||
    !scope.rates.includes(value.rate) ||
    value.audioTrack < 0 ||
    value.audioTrack >= scope.audioTracks ||
    !Number.isInteger(value.audioTrack) ||
    !Number.isFinite(value.volume) ||
    value.volume < 0 ||
    value.volume > 1 ||
    (scope.mutedOnly && !value.muted) ||
    (scope.exactFloatVolume && Math.fround(value.volume) !== value.volume) ||
    (!scope.audioSwitch && value.audioTrack !== previousAudioTrack)
  )
    return false;
  if (!scope.seekGrid) return true;
  const { origin, duration, timescale } = scope.seekGrid;
  const ticks = Math.round(value.targetTime * timescale);
  const exactField =
    Number.isSafeInteger(ticks) &&
    ticks / timescale === value.targetTime &&
    (ticks - origin) % duration === 0;
  if (exactField) return true;
  // HTML's currentTime often uses microseconds even for a field-aligned seek.
  // Preserve that requested clock; select its covering image in the backend.
  // Do not silently snap a user's arbitrary clock to the field lattice.
  return (
    scope.seekGrid.selection === 'containing' &&
    sourceClockFraction(value.targetTime) !== null
  );
};
