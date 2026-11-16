import { parseNativeGroupPresentation } from '../../../../src/types/ipc/nativeGroupSurface';
import type {
  NativeGroupPresentation,
  NativeGroupSurfaceMetadata,
} from '../../../../src/types/ipc/nativeGroupSurface';
import { parseNativePlaybackIntent } from '../../../../src/types/ipc/nativePlayback';
import type {
  NativePlaybackIntent,
  NativePlaybackOwner,
} from '../../../../src/types/ipc/nativePlayback';

interface Pair {
  first?: NativeGroupSurfaceMetadata;
  second?: NativeGroupSurfaceMetadata;
  drawn: number;
}
const snapshot = (pair: Pair): NativeGroupPresentation => {
  const a = pair.first,
    b = pair.second;
  if (!a || !b) throw Error('NATIVE_GROUP_PRESENTATION_INCOMPLETE');
  if (
    a.operation !== b.operation ||
    a.seekId !== b.seekId ||
    a.globalTicks !== b.globalTicks ||
    a.document !== b.document ||
    a.generation !== b.generation
  )
    throw Error('NATIVE_GROUP_DRAW_PAIR');
  return {
    document: a.document,
    generation: a.generation,
    operation: a.operation,
    seekId: a.seekId,
    pair: a.pair,
    globalTicks: a.globalTicks,
    ids: [a.id, b.id],
  };
};

/** Bounded metadata history, never an image lease or a new source grant. Allows
 * a stop fence from preload's last actual canvas submission to be checked even
 * when the per-frame Drawn ACK is still queued. It does not prove scanout. */
export class GroupPresentationLedger {
  private readonly pairs = new Map<number, Pair>();
  private current: NativeGroupPresentation | null = null;
  publish(meta: NativeGroupSurfaceMetadata): void {
    const pair = this.pairs.get(meta.pair) ?? { drawn: 0 };
    if (meta.angle === 0) {
      if (pair.first) throw Error('NATIVE_GROUP_PRESENTATION_DUPLICATE');
      pair.first = { ...meta };
    } else {
      if (pair.second) throw Error('NATIVE_GROUP_PRESENTATION_DUPLICATE');
      pair.second = { ...meta };
    }
    this.pairs.set(meta.pair, pair);
    if (pair.first && pair.second) snapshot(pair);
    while (this.pairs.size > 64) {
      const oldest = this.pairs.keys().next().value;
      if (oldest === undefined) break;
      this.pairs.delete(oldest);
    }
  }
  drawn(meta: NativeGroupSurfaceMetadata): NativeGroupPresentation | null {
    const pair = this.pairs.get(meta.pair);
    const member = meta.angle === 0 ? pair?.first : pair?.second;
    if (!pair || member?.id !== meta.id)
      throw Error('NATIVE_GROUP_PRESENTATION_UNKNOWN');
    pair.drawn |= 1 << meta.angle;
    if (pair.drawn === 3 && (!this.current || this.current.pair < meta.pair)) {
      this.current = snapshot(pair);
      return this.presented();
    }
    return null;
  }
  /** Bounded history permits a delayed native observation, but only after both
   * actual Drawn acknowledgements. Publishing a pair alone is not evidence. */
  confirms(generation: string, operation: number, seekId: number, time: number): boolean {
    if (!Number.isFinite(time) || time < 0) return false;
    for (const pair of this.pairs.values()) {
      if (pair.drawn !== 3) continue;
      const shown = snapshot(pair);
      if (shown.generation === generation && shown.operation === operation &&
          shown.seekId === seekId && shown.globalTicks / 120000 === time) return true;
    }
    return false;
  }
  confirmsStop(raw: unknown): boolean {
    let proof: NativeGroupPresentation;
    try { proof = parseNativeGroupPresentation(raw); } catch { return false; }
    const pair = this.pairs.get(proof.pair);
    if (!pair || pair.drawn !== 3 || this.current?.pair !== proof.pair) return false;
    const actual = snapshot(pair);
    return actual.document === proof.document && actual.generation === proof.generation &&
      actual.operation === proof.operation && actual.seekId === proof.seekId &&
      actual.globalTicks === proof.globalTicks && actual.ids[0] === proof.ids[0] &&
      actual.ids[1] === proof.ids[1];
  }
  presented(): NativeGroupPresentation | null {
    return this.current && { ...this.current, ids: [...this.current.ids] };
  }
  stop(
    raw: unknown,
    rawIntent: NativePlaybackIntent,
    owner: NativePlaybackOwner,
  ): NativeGroupPresentation {
    const proof = parseNativeGroupPresentation(raw),
      intent = parseNativePlaybackIntent(rawIntent);
    if (
      intent.generation !== owner.generation ||
      intent.sourceKey !== owner.sourceKey ||
      intent.playing ||
      proof.generation !== owner.generation ||
      proof.seekId !== intent.seekId ||
      proof.operation >= intent.sequence
    )
      throw Error('NATIVE_GROUP_STOP_OWNER');
    const pair = this.pairs.get(proof.pair);
    if (!pair) throw Error('NATIVE_GROUP_STOP_EXPIRED');
    if (this.current && proof.pair < this.current.pair)
      throw Error('NATIVE_GROUP_STOP_STALE');
    const published = snapshot(pair);
    if (
      published.document !== proof.document ||
      published.generation !== proof.generation ||
      published.operation !== proof.operation ||
      published.seekId !== proof.seekId ||
      published.globalTicks !== proof.globalTicks ||
      published.ids[0] !== proof.ids[0] ||
      published.ids[1] !== proof.ids[1]
    )
      throw Error('NATIVE_GROUP_STOP_UNPUBLISHED');
    return published;
  }
}
