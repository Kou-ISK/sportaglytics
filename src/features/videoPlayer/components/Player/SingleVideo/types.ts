import type { Dispatch, SetStateAction } from 'react';

export interface SingleVideoPlayerProps {
  videoSrc: string;
  id: string;
  isVideoPlaying: boolean;
  videoPlayBackRate: number;
  setMaxSec: Dispatch<SetStateAction<number>>;
  forceUpdate?: number;
  blockPlay?: boolean;
  allowSeek?: boolean;
  initialTimeSeconds?: number;
  onAspectRatioChange?: (ratio: number) => void;
  onPlaybackTimeChange?: (timeSeconds: number) => void;
  onPlaybackEnded?: () => void;
}
