interface NativeTrack {
  enabled: boolean;
}

const nativeTracks = (element: unknown): NativeTrack[] | null => {
  if (!element || typeof element !== 'object' || !('audioTracks' in element))
    return null;
  const list = element.audioTracks;
  if (
    !list ||
    typeof list !== 'object' ||
    !('length' in list) ||
    typeof list.length !== 'number' ||
    !Number.isSafeInteger(list.length) ||
    list.length < 0 ||
    list.length > 8
  )
    return null;
  const tracks: NativeTrack[] = [];
  for (let index = 0; index < list.length; index++) {
    const track: unknown = Reflect.get(list, index);
    if (
      !track ||
      typeof track !== 'object' ||
      !('enabled' in track) ||
      typeof track.enabled !== 'boolean'
    )
      return null;
    // The native writable field is checked above; never use Video.js emulation.
    tracks.push(track as NativeTrack);
  }
  return tracks;
};

export const readCacheNativeAudio = (element: unknown): boolean[] | null =>
  nativeTracks(element)?.map((track) => track.enabled) ?? null;

/** Full packet/config validation guarantees identical stream ordering. Restore
 * the enabled vector, then read it back: an ignored/normalized setter is failure. */
export const restoreCacheNativeAudio = (
  element: unknown,
  selection: readonly boolean[] | null,
  expectedCount: number,
): void => {
  const tracks = nativeTracks(element);
  if (
    (expectedCount > 1 && (!tracks || !selection)) ||
    (tracks && tracks.length !== expectedCount) ||
    (selection && selection.length !== expectedCount)
  )
    throw Error('CACHE_AUDIO_SELECTION_UNAVAILABLE');
  if (!tracks || !selection) return;
  // Disable first so selecting an exclusive track does not get undone by a
  // later setter. More than one enabled track is accepted only if preserved.
  tracks.forEach((track) => {
    track.enabled = false;
  });
  selection.forEach((enabled, index) => {
    if (enabled) tracks[index].enabled = true;
  });
  const restored = readCacheNativeAudio(element);
  if (
    !restored ||
    restored.length !== selection.length ||
    restored.some((enabled, index) => enabled !== selection[index])
  )
    throw Error('CACHE_AUDIO_SELECTION_CHANGED');
};
