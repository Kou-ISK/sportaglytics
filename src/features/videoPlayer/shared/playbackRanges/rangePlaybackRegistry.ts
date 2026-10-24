export interface RangePlaybackClockPort {
  readonly failure: Error | null;
  demand: (time: number) => void;
  seek: (time: number) => void;
  isReady: (time: number, video: HTMLVideoElement) => boolean;
}
const bindings = new WeakMap<
  HTMLVideoElement,
  { url: string; port: RangePlaybackClockPort }
>();
/** A transport binding never changes package source metadata. Each native video
 * and exact blob URL has its own owner; cleanup cannot unregister a replacement. */
export const bindRangePlaybackClock = (
  video: HTMLVideoElement,
  url: string,
  port: RangePlaybackClockPort,
): (() => void) => {
  if (!url.startsWith('blob:') || bindings.has(video))
    throw Error('RANGE_CLOCK_ALREADY_BOUND');
  const binding = { url, port };
  bindings.set(video, binding);
  return () => {
    if (bindings.get(video) === binding) bindings.delete(video);
  };
};
export const getRangePlaybackClock = (
  video: HTMLVideoElement,
): RangePlaybackClockPort | undefined => {
  const binding = bindings.get(video);
  return binding && (video.currentSrc || video.src) === binding.url
    ? binding.port
    : undefined;
};
