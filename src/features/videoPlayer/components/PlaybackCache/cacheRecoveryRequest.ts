import type { PlaybackCacheSnapshot } from '../../../../types/ipc/playbackCache';
import type { CachePlayerRegistration } from './CachePlayerContext';
import type { CachePlayerSnapshot } from './cachePlayerSwitch';

/** Retain the last known position/settings across a partially failed reload. */
export interface CacheRecoveryRequest {
  generation: string;
  sourceKey: string;
  player: CachePlayerRegistration;
  saved: CachePlayerSnapshot;
  timeline: number;
  audioTracks: number;
}

export const isCacheRecoveryCurrent = (
  recovery: CacheRecoveryRequest,
  snapshot: PlaybackCacheSnapshot | null,
  players: ReadonlySet<CachePlayerRegistration>,
): boolean =>
  snapshot?.generation === recovery.generation &&
  snapshot.source?.key === recovery.sourceKey &&
  snapshot.source.url === recovery.player.source &&
  players.size === 1 &&
  players.has(recovery.player);
