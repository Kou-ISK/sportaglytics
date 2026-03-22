import { useTimelineSessionController } from './useTimelineSessionController';
import { useTimelineUndoRedoBridge } from './useTimelineUndoRedoBridge';
import { useVideoPlayerRuntimeState } from './useVideoPlayerRuntimeState';

type UseVideoPlayerScreenControllerResult = Omit<
  ReturnType<typeof useTimelineSessionController>,
  'performUndo' | 'performRedo'
> &
  ReturnType<typeof useVideoPlayerRuntimeState> & {
    setisVideoPlaying: ReturnType<
      typeof useVideoPlayerRuntimeState
    >['setIsVideoPlaying'];
    performUndo: () => void;
    performRedo: () => void;
  };

export const useVideoPlayerScreenController =
  (): UseVideoPlayerScreenControllerResult => {
    const timelineSession = useTimelineSessionController();
    const runtimeState = useVideoPlayerRuntimeState();
    const { handleUndo, handleRedo } = useTimelineUndoRedoBridge({
      performUndo: timelineSession.performUndo,
      performRedo: timelineSession.performRedo,
      setPersistedTimeline: timelineSession.setPersistedTimeline,
    });

    return {
      ...timelineSession,
      ...runtimeState,
      setisVideoPlaying: runtimeState.setIsVideoPlaying,
      performUndo: handleUndo,
      performRedo: handleRedo,
    };
  };
