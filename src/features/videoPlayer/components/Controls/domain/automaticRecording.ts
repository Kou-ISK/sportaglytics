import type { ActiveRecordingSession } from '../hooks/useActiveRecordings';

/** null means the old interval has expired and the press may start a new one. */
export const repeatAutomaticRecording = (
  session: ActiveRecordingSession,
  position: number,
): ActiveRecordingSession | null => {
  const automatic = session.automatic;
  if (!automatic || position >= automatic.deadline) return null;
  if (!automatic.extendOnRepeat || position < session.startTime) return session;
  const deadline = Math.max(automatic.deadline, position + automatic.duration);
  if (deadline === automatic.deadline) return session;
  return { ...session, automatic: { ...automatic, deadline } };
};

export const getDueAutomaticRecordingEnd = (
  session: ActiveRecordingSession,
  position: number,
  duration?: number,
): number | null => {
  if (!session.automatic || !Number.isFinite(position)) return null;
  const hasDuration =
    typeof duration === 'number' && Number.isFinite(duration) && duration > 0;
  const end = hasDuration
    ? Math.min(session.automatic.deadline, duration)
    : session.automatic.deadline;
  return position >= end ? end : null;
};
