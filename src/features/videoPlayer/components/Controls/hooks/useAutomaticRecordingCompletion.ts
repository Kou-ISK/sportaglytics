import { useEffect } from 'react';
import type { RefObject } from 'react';
import { getDueAutomaticRecordingEnd } from '../domain/automaticRecording';
import type { ActiveRecordingSession } from './useActiveRecordings';
import type { CompleteRecording } from './useRecordingCompletion';

export const useAutomaticRecordingCompletion = (
  position: number | null,
  duration: number | undefined,
  sessions: RefObject<Record<string, ActiveRecordingSession>>,
  complete: CompleteRecording,
  activeRecordings?: Record<string, ActiveRecordingSession>,
): void => {
  useEffect(() => {
    if (position === null) return;
    for (const [key, session] of Object.entries(sessions.current)) {
      const end = getDueAutomaticRecordingEnd(session, position, duration);
      if (end !== null) complete(key, undefined, end);
    }
  }, [position, duration, sessions, complete, activeRecordings]);
};
