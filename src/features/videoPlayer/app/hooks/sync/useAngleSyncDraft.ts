import { withClipDuration } from '../../../../../shared/media/withClipDuration';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import type { VideoSyncData } from '../../../../../types/video/sync';
import { getAngleOffset } from '../../../../../shared/media/mediaTimeline';
import { alignAngleSyncPoints, syncPointTime } from './angleSync';
import type { AngleSyncDraft, AngleSyncPoint } from './angleSync';
import { useClipSyncAudio } from './useClipSyncAudio';

export interface AngleSyncParams {
  mediaAngles: PackageMediaAngle[];
  syncData?: VideoSyncData;
  initialTime: number;
  metaDataConfigFilePath: string;
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  setVideoList: Dispatch<SetStateAction<string[]>>;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  onApplySync: () => void | Promise<void>;
  onCancel: () => void;
}

export const useAngleSyncDraft = (
  props: AngleSyncParams,
  enabled = true,
): {
  draft: AngleSyncDraft;
  points: Record<string, AngleSyncPoint>;
  busy: boolean;
  saving: boolean;
  analyzing: boolean;
  changed: boolean;
  message: string;
  setMessage: (message: string) => void;
  mark: (index: number, point: AngleSyncPoint) => void;
  removePoint: (index: number) => void;
  recordDuration: (index: number, clipId: string, duration: number) => void;
  align: () => number | null;
  refineAudio: () => Promise<void>;
  reset: () => void;
  save: () => Promise<void>;
  cancel: () => void;
} => {
  const [initial, setInitial] = useState<AngleSyncDraft>(() => ({
    angles: props.mediaAngles,
    offsets: props.mediaAngles.map((_, index) =>
      getAngleOffset(props.syncData, index),
    ),
  }));
  const [draft, setDraft] = useState(initial);
  const [points, setPoints] = useState<Record<string, AngleSyncPoint>>({});
  const [message, setMessage] = useState('');
  const [changed, setChanged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const pending = useRef(false);
  const audio = useClipSyncAudio();
  const busy = saving || analyzing;
  const propsRef = useRef(props);
  propsRef.current = props;
  useEffect(() => {
    if (!enabled) return;
    const current = propsRef.current;
    const next = {
      angles: current.mediaAngles,
      offsets: current.mediaAngles.map((_, index) =>
        getAngleOffset(current.syncData, index),
      ),
    };
    setInitial(next);
    setDraft(next);
    setPoints({});
    setChanged(false);
    setMessage('');
  }, [enabled]);
  const recordDuration = useCallback(
    (index: number, clipId: string, duration: number): void => {
      if (!Number.isFinite(duration) || duration <= 0) return;
      setDraft((current) => {
        const angle = current.angles[index];
        if (
          angle?.clips.find((clip) => clip.id === clipId)?.durationSeconds ===
          duration
        )
          return current;
        return {
          ...current,
          angles: current.angles.map((item, i) =>
            i !== index
              ? item
              : {
                  ...item,
                  clips: withClipDuration(item.clips, clipId, duration),
                },
          ),
        };
      });
    },
    [],
  );
  const align = (): number | null => {
    if (pending.current) return null;
    try {
      const next = alignAngleSyncPoints(draft, points);
      const time = syncPointTime(
        next.angles[0],
        next.offsets[0],
        points[next.angles[0].id],
      );
      setDraft(next);
      setChanged(true);
      setPoints({});
      setMessage(
        'アングルを同期しました。続けて次の区間を合わせるか、保存してください。',
      );
      return time;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '同期点を確認してください。',
      );
      return null;
    }
  };
  const refineAudio = async (): Promise<void> => {
    if (pending.current || draft.angles.length !== 2) return;
    const clips = draft.angles.map((angle) =>
      angle.clips.find((clip) => clip.id === points[angle.id]?.clipId),
    );
    if (!clips[0] || !clips[1]) return;
    pending.current = true;
    setAnalyzing(true);
    setMessage('同期点付近の音声を解析しています…');
    try {
      const result = await audio.analyze(
        clips[0],
        clips[1],
        points[draft.angles[0].id].sourceTime,
        points[draft.angles[1].id].sourceTime,
        ['sync_angle_0', 'sync_angle_1'],
      );
      if (result.confidence < 0.35) {
        setMessage('音声の一致度が低いため同期点を変更しませんでした。');
        return;
      }
      const id = draft.angles[1].id;
      const nextPoints = {
        ...points,
        [id]: {
          ...points[id],
          sourceTime: points[id].sourceTime + result.offsetSeconds,
        },
      };
      alignAngleSyncPoints(draft, nextPoints);
      setPoints(nextPoints);
      setMessage(
        '音声で同期点を微調整しました。「アングルを同期」で反映できます。',
      );
    } catch {
      setMessage(
        '音声を解析できませんでした。同期点と手動調整は維持されています。',
      );
    } finally {
      pending.current = false;
      setAnalyzing(false);
    }
  };
  const save = async (): Promise<void> => {
    if (pending.current || !changed) return;
    pending.current = true;
    setSaving(true);
    try {
      const api = window.electronAPI;
      if (!api) throw new Error('ELECTRON_API_UNAVAILABLE');
      const result = await api.applyClipTimeline(
        props.metaDataConfigFilePath,
        draft.angles.flatMap((angle) =>
          angle.clips.map((clip) => ({
            clipId: clip.id,
            timelineStartSeconds: clip.timelineStartSeconds,
            durationSeconds: clip.durationSeconds,
          })),
        ),
        draft.offsets,
      );
      props.setMediaAngles(
        draft.angles.map((angle) => ({
          ...angle,
          clips: angle.clips.map((clip) => ({
            ...clip,
            durationSeconds:
              result.angles
                .find((item) => item.id === angle.id)
                ?.clips.find((item) => item.id === clip.id)?.durationSeconds ??
              clip.durationSeconds,
          })),
        })),
      );
      props.setVideoList(result.angles.map((angle) => angle.absolutePath));
      props.setSyncData({
        syncOffset: draft.offsets[1] ?? 0,
        angleOffsets: draft.offsets,
        isAnalyzed: true,
      });
      await props.onApplySync();
    } catch {
      setMessage(
        '同期を保存できませんでした。パッケージの接続を確認して再試行してください。',
      );
    } finally {
      pending.current = false;
      setSaving(false);
    }
  };
  const cancel = (): void => {
    if (analyzing) audio.cancel();
    else if (!pending.current) props.onCancel();
  };
  const cancelRef = useRef(cancel);
  cancelRef.current = cancel;
  useEffect(() => {
    if (!enabled) return;
    const listener = (): void => cancelRef.current();
    window.addEventListener('clip-sync-cancel', listener);
    return () => window.removeEventListener('clip-sync-cancel', listener);
  }, [enabled]);
  return {
    draft,
    points,
    busy,
    saving,
    analyzing,
    changed,
    message,
    setMessage,
    recordDuration,
    align,
    refineAudio,
    save,
    cancel,
    mark: (index, point): void => {
      if (pending.current) return;
      setPoints((current) => ({ ...current, [draft.angles[index].id]: point }));
      setMessage('');
    },
    removePoint: (index): void => {
      if (pending.current) return;
      setPoints((current) => {
        const next = { ...current };
        delete next[draft.angles[index].id];
        return next;
      });
    },
    reset: (): void => {
      if (pending.current) return;
      setDraft(initial);
      setPoints({});
      setChanged(false);
      setMessage('保存前の同期に戻しました。');
    },
  };
};
