import { useCallback, useMemo, useRef, useState } from 'react';

export type ActiveRecordingSession = {
  teamName: string;
  startTime: number;
  leadTimeSeconds: number;
  lagTimeSeconds: number;
  color?: string;
  automatic?: { deadline: number; duration: number; extendOnRepeat: boolean };
  activateTargets: string[];
  activateTargetColors: Record<string, string | undefined>;
};

export const useActiveRecordings = (teamNames: string[]) => {
  const [activeRecordings, renderRecordings] = useState<
    Record<string, ActiveRecordingSession>
  >({});
  const [primaryAction, setPrimaryAction] = useState<string | null>(null);
  const activeRecordingsRef = useRef<typeof activeRecordings>({});

  const setActiveRecordings = useCallback<
    React.Dispatch<React.SetStateAction<typeof activeRecordings>>
  >((update) => {
    const next =
      typeof update === 'function'
        ? update(activeRecordingsRef.current)
        : update;
    activeRecordingsRef.current = next;
    renderRecordings(next);
  }, []);

  const isSameActionName = useCallback(
    (a: string, b: string): boolean => {
      if (a === b) return true;
      for (const team of teamNames) {
        const prefix = `${team} `;
        const aStripped = a.startsWith(prefix) ? a.slice(prefix.length) : a;
        const bStripped = b.startsWith(prefix) ? b.slice(prefix.length) : b;
        if (
          aStripped === b ||
          bStripped === a ||
          aStripped === bStripped ||
          `${prefix}${b}` === a ||
          `${prefix}${a}` === b
        ) {
          return true;
        }
      }
      return false;
    },
    [teamNames],
  );

  const resolveRecordingKey = useCallback(
    (name: string): string | undefined => {
      if (activeRecordingsRef.current[name]) return name;
      for (const team of teamNames) {
        const teamPrefix = `${team} `;
        if (name.startsWith(teamPrefix)) {
          const stripped = name.slice(teamPrefix.length);
          if (activeRecordingsRef.current[stripped]) return stripped;
        }
        const prefixed = `${teamPrefix}${name}`;
        if (activeRecordingsRef.current[prefixed]) return prefixed;
      }
      return undefined;
    },
    [teamNames],
  );

  const isRecording = useMemo(
    () => Object.keys(activeRecordings).length > 0,
    [activeRecordings],
  );

  return {
    activeRecordings,
    setActiveRecordings,
    activeRecordingsRef,
    primaryAction,
    setPrimaryAction,
    isSameActionName,
    resolveRecordingKey,
    isRecording,
  };
};
