/** Presentation contract only. No filesystem paths or cache validation claims cross this boundary. */
export interface PlaybackCacheStatus {
  phase:
    | 'original'
    | 'converting'
    | 'validating'
    | 'publishing'
    | 'cancelling'
    | 'ready'
    | 'failed';
  progress: number | null;
  selected: 'original' | 'cache';
  error:
    | 'capacity'
    | 'validation'
    | 'operation'
    | 'cleanup'
    | 'stop'
    | 'missing'
    | null;
}

export interface PlaybackCacheEstimate {
  seconds: number;
  bytes: number;
}
