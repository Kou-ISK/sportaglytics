import {
  objectValue,
  exactKeys,
  integerValue,
  numberValue,
} from '../../shared/validation/jsonValues';

/** Fixed numeric failure evidence only. Owner tokens are authenticated separately
 * and must never be persisted by the optional diagnostic sink. */
export interface NativePlaybackRecoveryContext {
  requestedTime: number;
  duration: number;
  /** 0 finite; 1 NaN; 2 +Infinity; 3 -Infinity; 4 outside the bounded domain. */
  durationKind: number;
  /** HTML readyState 0..4, or 5 when the adapter returned an invalid value. */
  readyState: number;
  seeking: number;
}
export interface NativePlaybackFailure {
  stage: number;
  code: number;
  sequence: number;
  seekId: number;
  targetTime: number;
  confirmedTime: number;
  recovery?: NativePlaybackRecoveryContext;
}

const parseRecoveryContext = (raw: unknown): NativePlaybackRecoveryContext => {
  const v = objectValue(raw);
  exactKeys(v, [
    'requestedTime',
    'duration',
    'durationKind',
    'readyState',
    'seeking',
  ]);
  const durationKind = integerValue(v.durationKind, 0, 4);
  const duration = numberValue(v.duration, -86400, 86400);
  if (durationKind !== 0 && duration !== 0)
    throw Error('INVALID_RECOVERY_DURATION_SENTINEL');
  return {
    requestedTime: numberValue(v.requestedTime, 0, 86400),
    duration,
    durationKind,
    readyState: integerValue(v.readyState, 0, 5),
    seeking: integerValue(v.seeking, 0, 1),
  };
};
export const parseNativePlaybackFailure = (
  raw: unknown,
): NativePlaybackFailure => {
  const v = objectValue(raw);
  exactKeys(v, [
    'stage',
    'code',
    'sequence',
    'seekId',
    'targetTime',
    'confirmedTime',
    'recovery',
  ]);
  return {
    stage: integerValue(v.stage, 1, 2),
    code: integerValue(v.code, 0, 36),
    sequence: integerValue(v.sequence, 1, Number.MAX_SAFE_INTEGER),
    seekId: integerValue(v.seekId, 1, Number.MAX_SAFE_INTEGER),
    targetTime: numberValue(v.targetTime, 0, 86400),
    confirmedTime: numberValue(v.confirmedTime, 0, 86400),
    ...(v.recovery === undefined
      ? {}
      : { recovery: parseRecoveryContext(v.recovery) }),
  };
};
