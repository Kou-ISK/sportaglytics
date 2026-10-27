import type { ClipExportPayload } from './clipExportTypes';

/** Source identity is the document's exact source, not an angle position.
 * null means playback is changing/ambiguous: do not silently export track 0. */
export interface ClipExportAudioSelection {
  source: string;
  audioTrackIndex: number | null;
}

export const applyClipExportAudioSelections = (
  payload: ClipExportPayload,
  selections: readonly ClipExportAudioSelection[] | undefined,
): ClipExportPayload => {
  if (!selections?.length) return payload;
  return {
    ...payload,
    clips: payload.clips.map((clip) => {
      if (clip.audioTrackIndex !== undefined) return clip;
      const main = clip.videoSource || payload.sourcePath;
      const source =
        clip.angleType === 'angle2'
          ? clip.videoSource2 || payload.sourcePath2 || main
          : main;
      const matching = selections.filter((entry) => entry.source === source);
      if (!matching.length) return clip;
      const index = matching[0].audioTrackIndex;
      if (
        matching.length !== 1 ||
        index === null ||
        !Number.isSafeInteger(index) ||
        index < 0 ||
        index > 63
      )
        throw Error('音声トラックの選択を確認してから書き出してください');
      return { ...clip, audioTrackIndex: index };
    }),
  };
};

export const isClipExportAudioSelections = (
  value: unknown,
  sources: readonly string[],
): value is ClipExportAudioSelection[] => {
  if (!Array.isArray(value) || value.length > sources.length) return false;
  const seen = new Set<string>();
  return value.every((entry: unknown) => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      Object.keys(entry).length !== 2 ||
      !('source' in entry) ||
      typeof entry.source !== 'string' ||
      !sources.includes(entry.source) ||
      seen.has(entry.source) ||
      !('audioTrackIndex' in entry)
    )
      return false;
    seen.add(entry.source);
    return (
      entry.audioTrackIndex === null ||
      (typeof entry.audioTrackIndex === 'number' &&
        Number.isSafeInteger(entry.audioTrackIndex) &&
        entry.audioTrackIndex >= 0 &&
        entry.audioTrackIndex <= 63)
    );
  });
};
