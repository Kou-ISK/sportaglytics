import type { TimelineWindowCommand } from '../../../../types/ipc/timelineWindow';
import type { VideoSeekMode } from '../../../../types/video/seek';

type SeekCommand = Extract<
  TimelineWindowCommand,
  { type: 'seek' | 'seek-relative' }
>;
interface SeekState {
  epoch: object;
  currentTime: number;
  maxSec: number;
  videoSources: readonly string[];
  nativeCommandTime?: number;
  onSeek: (time: number, mode?: VideoSeekMode) => void;
}

/** Resolve relative input at the playback owner, never against a delayed
 * secondary-window clock. The scalar pending target only covers commands
 * received before the owner's next clock update; it is not a playback clock. */
export const createTimelineWindowSeek = (
  read: () => SeekState,
): ((command: SeekCommand) => void) => {
  let previous: { state: SeekState; target: number } | null = null;
  return (command): void => {
    const state = read();
    const sameClock =
      previous &&
      previous.state.epoch === state.epoch &&
      previous.state.currentTime === state.currentTime &&
      previous.state.videoSources.length === state.videoSources.length &&
      previous.state.videoSources.every(
        (source, i) => source === state.videoSources[i],
      );
    const base =
      state.nativeCommandTime ??
      (sameClock && previous ? previous.target : state.currentTime);
    const target =
      command.type === 'seek'
        ? command.time
        : Math.max(0, Math.min(state.maxSec, base + command.seconds));
    if (!Number.isFinite(target)) return;
    previous = { state, target };
    if (command.type === 'seek' && command.seekMode)
      state.onSeek(target, command.seekMode);
    else state.onSeek(target);
  };
};
