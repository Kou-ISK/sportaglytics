import { readCacheNativeAudio } from '../../components/PlaybackCache/cacheNativeAudio';

export interface PlaybackAudioRegistration {
  id: string;
  source: string;
  read: () => number | null | undefined;
}
let registrations: readonly PlaybackAudioRegistration[] = [];
const listeners = new Set<() => void>();
export const getPlaybackAudioRegistrations =
  (): readonly PlaybackAudioRegistration[] => registrations;
export const subscribePlaybackAudio = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Observe native tracks only. No timer, Video.js emulation or media scanning. */
export const registerPlaybackAudio = (
  id: string,
  source: string,
  video: HTMLVideoElement,
): (() => void) => {
  let trackEvents: EventTarget | null = null;
  let released = false;
  const registration: PlaybackAudioRegistration = {
    id,
    source,
    read: () => {
      if (video.currentSrc !== source || video.readyState < 1) return undefined;
      const tracks = readCacheNativeAudio(video);
      if (!tracks?.length) return undefined;
      return tracks.filter(Boolean).length === 1
        ? tracks.findIndex(Boolean)
        : null;
    },
  };
  const notify = (): void => {
    registrations = [...registrations];
    for (const listener of listeners) listener();
  };
  const detachTracks = (): void => {
    for (const event of ['change', 'addtrack', 'removetrack'])
      trackEvents?.removeEventListener(event, notify);
    trackEvents = null;
  };
  const refresh = (): void => {
    detachTracks();
    const candidate: unknown = Reflect.get(video, 'audioTracks');
    if (candidate instanceof EventTarget) {
      trackEvents = candidate;
      for (const event of ['change', 'addtrack', 'removetrack'])
        trackEvents.addEventListener(event, notify);
    }
    notify();
  };
  registrations = [...registrations, registration];
  video.addEventListener('loadedmetadata', refresh);
  video.addEventListener('emptied', refresh);
  refresh();
  return () => {
    if (released) return;
    released = true;
    detachTracks();
    video.removeEventListener('loadedmetadata', refresh);
    video.removeEventListener('emptied', refresh);
    registrations = registrations.filter((entry) => entry !== registration);
    notify();
  };
};
