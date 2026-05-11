export type VideoPlayerErrorType =
  | 'file'
  | 'network'
  | 'sync'
  | 'playback'
  | 'general';

export interface VideoPlayerError {
  type: VideoPlayerErrorType;
  message: string;
}
