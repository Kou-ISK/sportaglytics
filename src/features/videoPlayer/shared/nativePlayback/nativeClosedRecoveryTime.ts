import { clockMovedAgainstRate } from '../../../../shared/media/playbackRate';
import { parseNativePlaybackClosed } from '../../../../types/ipc/nativePlayback';
import type { NativePlaybackOwner } from '../../../../types/ipc/nativePlayback';

interface RecoveryContext {
  owner: NativePlaybackOwner;
  sequence: number;
  seekId: number;
  lastReadySeek: number;
  time: number;
  intentRate: number;
  clockRate: number;
  bufferedStop: { seekId: number; time: number } | null;
  clockAuthority: 'source-clock' | 'drawn-pair';
}
/** A recovery anchor has authority only after physical drain. A canvas receipt
 * remains distinct from a measured source clock; Main verifies its actual ledger. */
export const nativeClosedRecoveryTime = (
  raw: unknown,
  context: RecoveryContext,
): number | null => {
  const result = parseNativePlaybackClosed(raw);
  if (result.generation !== context.owner.generation || !result.nativeDrained ||
      !result.processExited || !result.pipesClosed)
    throw Error('NATIVE_CLEANUP_UNCONFIRMED');
  const proof = result.presentedStop;
  let anchor: { sequence: number; seekId: number; time: number } | null;
  const group = context.clockAuthority === 'drawn-pair';
  if (group) {
    if (result.stopped || (proof && !result.processStarted) ||
        (context.lastReadySeek > 0 && (!result.processStarted || !proof)))
      throw Error('NATIVE_STOP_PRESENTATION_MISSING');
    anchor = proof ? { sequence: proof.operation, seekId: proof.seekId,
      time: proof.globalTicks / 120000 } : null;
  } else {
    if (proof) throw Error('NATIVE_STOP_AUTHORITY');
    if (result.stopped?.sourceKey !== undefined &&
        result.stopped.sourceKey !== context.owner.sourceKey)
      throw Error('NATIVE_STOP_CLOCK_UNCONFIRMED');
    anchor = result.stopped;
    if (!anchor && context.lastReadySeek > 0) throw Error('NATIVE_STOP_CLOCK_MISSING');
  }
  if (!anchor) return null;
  const sameDirection = Math.sign(context.intentRate) === Math.sign(context.clockRate);
  if (anchor.sequence > context.sequence || anchor.seekId > context.seekId ||
      (anchor.seekId === context.lastReadySeek && sameDirection &&
        clockMovedAgainstRate(anchor.time, context.time, context.clockRate)) ||
      (anchor.seekId === context.bufferedStop?.seekId && sameDirection &&
        clockMovedAgainstRate(anchor.time, context.bufferedStop.time, context.clockRate)))
    throw Error(group ? 'NATIVE_STOP_PRESENTATION_UNCONFIRMED' : 'NATIVE_STOP_CLOCK_UNCONFIRMED');
  return anchor.time;
};
