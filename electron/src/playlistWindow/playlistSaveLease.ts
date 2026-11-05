import type { PlaylistWindowInfo } from './state';

/** One save owns a playlist window until its dialog and write have settled. */
const active = new WeakSet<PlaylistWindowInfo>();
export const acquirePlaylistSave = (owner: PlaylistWindowInfo): (() => void) | null => {
  if (active.has(owner)) return null;
  active.add(owner);
  let released = false;
  return () => { if (!released) { released = true; active.delete(owner); } };
};
