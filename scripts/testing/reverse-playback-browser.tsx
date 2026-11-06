import { useGlobalHotkeys } from '../../src/hooks/useGlobalHotkeys';
import { DEFAULT_SETTINGS } from '../../src/types/settings/defaults';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import videojs from 'video.js';
import { useContinuousReversePlayback } from '../../src/hooks/useContinuousReversePlayback';
import { useVideoTimeController } from '../../src/features/videoPlayer/app/hooks/useVideoTimeController';
import { usePlaylistPlayback } from '../../src/features/playlist/hooks/playlist/usePlaylistPlayback';
import type { VideoSyncData } from '../../src/types/video/sync';
import type { PlaylistItem } from '../../src/types/playlist/core';

const source = `${location.origin}/video.mp4`;
const videos = [source, source];
const angles: [] = [];
const sync: VideoSyncData = { isAnalyzed: true, syncOffset: 0.7 };
const mode = new URL(location.href).searchParams.get('mode') ?? 'main';
const noop = (): void => {};
const hotkeys = DEFAULT_SETTINGS.hotkeys.filter((key) =>
  key.id.startsWith('reverse-playback-'),
);
const useReverseKeys = (
  reverse: ReturnType<typeof useContinuousReversePlayback>,
): void => {
  useGlobalHotkeys(
    hotkeys,
    {
      'reverse-playback-slow': () => reverse.startReversePlayback(0.5),
      'reverse-playback-2x': () => reverse.startReversePlayback(2),
      'reverse-playback-4x': () => reverse.startReversePlayback(4),
      'reverse-playback-6x': () => reverse.startReversePlayback(6),
    },
    Object.fromEntries(
      hotkeys.map((key) => [key.id, reverse.stopReversePlayback]),
    ),
  );
};
const sampleFrames: Array<{ angle: number; pts: number; at: number }> = [];
let seekCount = 0;
const errors: string[] = [];
let latest: Record<string, unknown> = {};
const record = (video: HTMLVideoElement, angle: number): void => {
  video.addEventListener('seeking', () => {
    seekCount++;
  });
  const next: VideoFrameRequestCallback = (_now, meta) => {
    sampleFrames.push({ angle, pts: meta.mediaTime, at: performance.now() });
    video.requestVideoFrameCallback(next);
  };
  video.requestVideoFrameCallback(next);
};
const item: PlaylistItem = {
  id: 'synthetic',
  timelineItemId: null,
  actionName: 'Synthetic',
  addedAt: 0,
  startTime: 2,
  endTime: 39,
};

function Main(): React.ReactElement {
  const clock = useVideoTimeController({
    videoList: videos,
    syncData: sync,
    syncMode: 'auto',
    mediaAngles: angles,
  });
  const reverse = useContinuousReversePlayback({
    currentTime: clock.currentTime,
    onPause: noop,
    onSeek: clock.seekReverse,
    onError: (e) => errors.push(String(e)),
  });
  useReverseKeys(reverse);
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const players = videos.map((src, index) => {
      const video = document.createElement('video');
      video.id = `video_${index}`;
      video.width = 320;
      video.height = 180;
      video.muted = true;
      mount.current!.append(video);
      const player = videojs(video, {
        sources: [{ src, type: 'video/mp4' }],
        preload: 'auto',
      });
      const actual = player.el().querySelector('video')!;
      record(actual, index);
      return player;
    });
    return () => players.forEach((player) => player.dispose());
  }, []);
  latest = {
    reverse,
    time: clock.currentTime,
    seek: (time: number) =>
      clock.handleCurrentTime(new Event('test-seek'), time),
    state: () =>
      Array.from(document.querySelectorAll('video')).map((v) => ({
        time: v.currentTime,
        seeking: v.seeking,
        ready: v.readyState,
        source: v.currentSrc,
      })),
  };
  return <div ref={mount} />;
}
function Playlist(): React.ReactElement {
  const primary = useRef<HTMLVideoElement>(null),
    secondary = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(2);
  const [playing, setPlaying] = useState(false);
  const [index, setIndex] = useState(0);
  const [frozen, setFrozen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const playback = usePlaylistPlayback({
    items: [item],
    currentItem: item,
    currentIndex: index,
    setCurrentIndex: setIndex,
    isPlaying: playing,
    setIsPlaying: setPlaying,
    isFrozen: frozen,
    setIsFrozen: setFrozen,
    autoAdvance: false,
    loopPlaylist: false,
    viewMode: 'dual',
    currentVideoSource: `${location.origin}/sample.stpkg/one`,
    currentVideoSource2: `${location.origin}/sample.stpkg/two`,
    videoRef: primary,
    videoRef2: secondary,
    setCurrentTime: setTime,
    setDuration: noop,
    volume: 0,
    isMuted: true,
    setVolume: noop,
    containerRef: container,
    isFullscreen: false,
    setIsFullscreen: noop,
    minFreezeDuration: 0.1,
    defaultFreezeDuration: 1,
    annotationTimeTolerance: 0.02,
    freezeRetriggerGuard: 0.5,
  });
  const pause = useCallback((): void => {
    setPlaying(false);
  }, []);
  const reverse = useContinuousReversePlayback({
    currentTime: time,
    minimumTime: 2,
    onPause: pause,
    onSeek: playback.seekReverse,
    onError: (e) => errors.push(String(e)),
  });
  useReverseKeys(reverse);
  useEffect(() => {
    record(primary.current!, 0);
    record(secondary.current!, 1);
  }, []);
  latest = {
    reverse,
    time,
    seek: (t: number) => playback.handleSeek(new Event('test-seek'), t),
    state: () =>
      [primary.current!, secondary.current!].map((v) => ({
        time: v.currentTime,
        seeking: v.seeking,
        ready: v.readyState,
        source: v.currentSrc,
        hidden: v.style.visibility === 'hidden',
      })),
  };
  return (
    <div ref={container}>
      <video ref={primary} width="320" height="180" muted />
      <video ref={secondary} width="320" height="180" muted />
    </div>
  );
}
// Only package metadata lookup is synthetic; playback/seek/presentation are real.
Object.assign(window, {
  electronAPI: {
    resolveMediaTimelines: async () => [
      {
        offsetSeconds: 0,
        clips: [
          { id: 'a', source, timelineStartSeconds: 0, durationSeconds: 10 },
          {
            id: 'b',
            source: `${source}?clip=2`,
            timelineStartSeconds: 12,
            durationSeconds: 28,
          },
        ],
      },
      {
        offsetSeconds: 0.7,
        clips: [
          { id: 'c', source, timelineStartSeconds: 0, durationSeconds: 10 },
          {
            id: 'd',
            source: `${source}?clip=2`,
            timelineStartSeconds: 12,
            durationSeconds: 28,
          },
        ],
      },
    ],
  },
});
Object.assign(window, {
  reverseTest: {
    get: () => latest,
    trace: () => ({ frames: sampleFrames, seekCount, errors }),
    reset: () => {
      sampleFrames.length = 0;
      seekCount = 0;
      errors.length = 0;
    },
  },
});
createRoot(document.getElementById('root')!).render(
  mode === 'playlist' ? <Playlist /> : <Main />,
);
