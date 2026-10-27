import { useRef, useSyncExternalStore } from 'react';
import type { ClipExportAudioSelection } from '../../../../shared/clipExport/clipExportAudio';
import { formatSource } from '../../../../shared/media/videoSource';
import {
  getPlaybackAudioRegistrations,
  subscribePlaybackAudio,
} from '../../shared/audioSelection/playbackAudioRegistry';
import { useNativePlaybackState } from '../../shared/nativePlayback/useNativePlaybackState';

export const usePlaybackAudioSelections = (
  sources: readonly string[],
): readonly ClipExportAudioSelection[] => {
  const registrations = useSyncExternalStore(
    subscribePlaybackAudio,
    getPlaybackAudioRegistrations,
    getPlaybackAudioRegistrations,
  );
  const { controller, state } = useNativePlaybackState();
  const byUrl = new Map<string, Array<number | null | undefined>>();
  sources.forEach((source, index) => {
    const url = formatSource(source);
    let selection: number | null | undefined;
    if (controller?.sourceUrl === url && state.phase !== 'original') {
      const observed = state.observation;
      const confirmed =
        state.phase === 'active' &&
        observed?.audioReady &&
        observed.videoReady &&
        (observed.phase === 'paused' || observed.phase === 'playing');
      selection = confirmed ? observed.audioTrack : null;
    } else {
      const matches = registrations.filter(
        (entry) => entry.id === `video_${index}` && entry.source === url,
      );
      selection = matches.length === 1 ? matches[0].read() : undefined;
    }
    byUrl.set(url, [...(byUrl.get(url) ?? []), selection]);
  });
  const selections = [...new Set(sources)].flatMap(
    (source): ClipExportAudioSelection[] => {
      const choices = byUrl.get(formatSource(source)) ?? [];
      if (choices.every((value) => value === undefined)) return [];
      const first = choices[0];
      return [
        {
          source,
          audioTrackIndex:
            typeof first === 'number' &&
            choices.every((value) => value === first)
              ? first
              : null,
        },
      ];
    },
  );
  // Keep full timeline sync independent of high-frequency native clock updates.
  const stable = useRef(selections);
  if (JSON.stringify(stable.current) !== JSON.stringify(selections))
    stable.current = selections;
  return stable.current;
};
