/** Renderer-local ownership, retained across video element/source replacement.
 * Native has one qualified document; range playback may have several angles. */
let native: symbol | null = null;
const ranges = new Set<symbol>();
const listeners = new Set<() => void>();
let revision = 0;
const changed = (): void => {
  revision++;
  for (const listener of listeners) listener();
};
export const subscribePlaybackAuthority = (
  listener: () => void,
): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const playbackAuthorityRevision = (): number => revision;
export const htmlPlaybackAllowed = (): boolean => native === null;
export const claimNativePlayback = (): (() => void) => {
  if (native || ranges.size) throw Error('PLAYBACK_AUTHORITY_BUSY');
  const token = Symbol();
  native = token;
  changed();
  return () => {
    if (native !== token) return;
    native = null;
    changed();
  };
};
export const claimRangePlayback = (): (() => void) => {
  if (native) throw Error('PLAYBACK_AUTHORITY_BUSY');
  const token = Symbol();
  ranges.add(token);
  return () => {
    ranges.delete(token);
  };
};

/** Source selection owns the HTML player through candidate IPC and rollback. */
export const claimHtmlSourceSwitch = claimRangePlayback;
