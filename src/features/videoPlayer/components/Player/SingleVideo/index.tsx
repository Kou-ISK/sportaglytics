import React from 'react';
import { SingleVideoPlayer } from './SingleVideoPlayer';

export const MemoizedSingleVideoPlayer = React.memo(
  SingleVideoPlayer,
  (prev, next) => {
    if (prev.videoSrc !== next.videoSrc) return false;
    if (prev.id !== next.id) return false;
    if (prev.isVideoPlaying !== next.isVideoPlaying) return false;
    if (prev.videoPlayBackRate !== next.videoPlayBackRate) return false;
    if (prev.blockPlay !== next.blockPlay) return false;
    if (prev.allowSeek !== next.allowSeek) return false;
    if (Math.abs((prev.offsetSeconds ?? 0) - (next.offsetSeconds ?? 0)) > 0.001)
      return false;
    if (prev.setMaxSec !== next.setMaxSec) return false;
    if (prev.forceUpdate !== next.forceUpdate) return false;
    return true;
  },
);
