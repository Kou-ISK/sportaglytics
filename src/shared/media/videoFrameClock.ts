/** Per-element adapter metadata, never a persisted or application-level clock. */
const clocks = new WeakMap<
  HTMLVideoElement,
  { source: string; offset: number }
>();

export const bindVideoFrameClock = (
  video: HTMLVideoElement,
  source: string,
  sourceTimeOffset: number,
): void => {
  clocks.set(video, { source, offset: sourceTimeOffset });
};
export const releaseVideoFrameClock = (video: HTMLVideoElement): void => {
  clocks.delete(video);
};
export const globalVideoFrameTime = (
  video: HTMLVideoElement,
  mediaTime: number,
): number => {
  const clock = clocks.get(video);
  return mediaTime - (clock?.source === video.currentSrc ? clock.offset : 0);
};
