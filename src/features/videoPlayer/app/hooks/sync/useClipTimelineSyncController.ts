import { getAngleOffset } from '../../../../../shared/media/mediaTimeline';
import type { VideoSyncData } from '../../../../../types/video/sync';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  PackageMediaAngle,
  PackageMediaClip,
} from '../../../../../types/package/metadata';
import {
  calculateTimelineStart,
  deriveTimelineGaps,
} from '../../../../../types/package/clipTimeline';
import { getVideoJsPlayerCurrentTime } from '../../../shared/videojs/videoJsAdapter';
import { useClipSyncAudio } from './useClipSyncAudio';

export type RuntimeSyncClip = PackageMediaClip & {
  angleId: string;
  angleName: string;
};

interface UseClipTimelineSyncControllerParams {
  onApplySync: () => void | Promise<void>;
  onCancel: () => void;
  mediaAngles: PackageMediaAngle[];
  syncData?: VideoSyncData;
  metaDataConfigFilePath: string;
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  setVideoList: Dispatch<SetStateAction<string[]>>;
}

interface ClipTimelineSyncController {
  clips: RuntimeSyncClip[];
  reference?: RuntimeSyncClip;
  target?: RuntimeSyncClip;
  referenceId: string;
  targetId: string;
  placements: Record<string, number>;
  offsetFor: (clip: RuntimeSyncClip) => number;
  setReferenceId: (id: string) => void;
  setTargetId: (id: string) => void;
  message: string;
  isApplying: boolean;
  isAnalyzing: boolean;
  hasChanges: boolean;
  recordClipDuration: (id: string) => (duration: number) => void;
  moveTarget: (delta: number) => void;
  resetPlacements: () => void;
  placeAtCurrentPositions: () => void;
  refineWithAudio: () => Promise<void>;
  applyTimeline: () => Promise<void>;
  cancel: () => void;
}

const flattenClips = (angles: PackageMediaAngle[]): RuntimeSyncClip[] =>
  angles.flatMap((angle) =>
    angle.clips.map((clip) => ({
      ...clip,
      angleId: angle.id,
      angleName: angle.name,
    })),
  );

export const useClipTimelineSyncController = ({
  onApplySync,
  onCancel,
  mediaAngles,
  syncData,
  metaDataConfigFilePath,
  setMediaAngles,
  setVideoList,
}: UseClipTimelineSyncControllerParams): ClipTimelineSyncController => {
  const baseClips = useMemo(() => flattenClips(mediaAngles), [mediaAngles]);
  const [durations, setDurations] = useState<Record<string, number>>({});
  const clips = useMemo(
    () =>
      baseClips.map((clip) => ({
        ...clip,
        durationSeconds: durations[clip.id] ?? clip.durationSeconds,
      })),
    [baseClips, durations],
  );
  const [referenceId, setReferenceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audio = useClipSyncAudio();
  const offsetFor = (clip: RuntimeSyncClip): number =>
    getAngleOffset(
      syncData,
      mediaAngles.findIndex((angle) => angle.id === clip.angleId),
    );

  const reference = clips.find((clip) => clip.id === referenceId) ?? clips[0];
  const target =
    clips.find((clip) => clip.id === targetId) ??
    clips.find((clip) => clip.angleId !== reference?.angleId) ??
    clips[1];
  const recordClipDuration = useCallback(
    (clipId: string) =>
      (value: number): void => {
        if (!Number.isFinite(value) || value <= 0) return;
        setDurations((current) =>
          current[clipId] === value ? current : { ...current, [clipId]: value },
        );
      },
    [],
  );

  const placeAtCurrentPositions = useCallback((): void => {
    if (
      isApplying ||
      isAnalyzing ||
      !reference ||
      !target ||
      reference.id === target.id
    )
      return;
    const referenceTime =
      getVideoJsPlayerCurrentTime('sync_reference_clip') ?? 0;
    const targetTime = getVideoJsPlayerCurrentTime('sync_target_clip') ?? 0;
    const nextStart = calculateTimelineStart({
      referenceStartSeconds:
        placements[reference.id] ?? reference.timelineStartSeconds,
      referenceCurrentSeconds: referenceTime,
      targetCurrentSeconds: targetTime,
      referenceOffsetSeconds: getAngleOffset(
        syncData,
        mediaAngles.findIndex((angle) => angle.id === reference.angleId),
      ),
      targetOffsetSeconds: getAngleOffset(
        syncData,
        mediaAngles.findIndex((angle) => angle.id === target.angleId),
      ),
    });
    if (!Number.isFinite(nextStart) || nextStart < 0 || nextStart > 86_400) {
      setMessage('配置位置は0秒から24時間以内にしてください。');
      return;
    }
    setPlacements((current) => ({ ...current, [target.id]: nextStart }));
    setMessage(`対象クリップを ${nextStart.toFixed(3)} 秒へ配置しました。`);
  }, [
    reference,
    target,
    placements,
    mediaAngles,
    syncData,
    isApplying,
    isAnalyzing,
  ]);

  useEffect(() => {
    window.addEventListener('clip-sync-place', placeAtCurrentPositions);
    return () =>
      window.removeEventListener('clip-sync-place', placeAtCurrentPositions);
  }, [placeAtCurrentPositions]);

  const refineWithAudio = async (): Promise<void> => {
    if (
      isApplying ||
      isAnalyzing ||
      !reference ||
      !target ||
      reference.id === target.id
    )
      return;
    const referenceTime =
      getVideoJsPlayerCurrentTime('sync_reference_clip') ?? 0;
    const targetTime = getVideoJsPlayerCurrentTime('sync_target_clip') ?? 0;
    setIsAnalyzing(true);
    setMessage(
      '15秒間解析します。YouTube使用時は他プレイヤーを停止・ミュートします。外部アプリの音が混入する場合があります。',
    );
    try {
      const result = await audio.analyze(
        reference,
        target,
        referenceTime,
        targetTime,
      );
      if (result.confidence < 0.35) {
        setMessage(
          `信頼度が低いため配置を変更しませんでした（${result.confidence.toFixed(2)}）。`,
        );
        return;
      }
      const nextStart = calculateTimelineStart({
        referenceStartSeconds:
          placements[reference.id] ?? reference.timelineStartSeconds,
        referenceCurrentSeconds: referenceTime,
        targetCurrentSeconds: targetTime + result.offsetSeconds,
        referenceOffsetSeconds: offsetFor(reference),
        targetOffsetSeconds: offsetFor(target),
      });
      if (!Number.isFinite(nextStart) || nextStart < 0 || nextStart > 86_400) {
        setMessage('補正結果が配置範囲外のため、配置を変更しませんでした。');
        return;
      }
      setPlacements((current) => ({ ...current, [target.id]: nextStart }));
      setMessage(
        `音声で ${result.offsetSeconds.toFixed(3)} 秒補正しました（信頼度 ${result.confidence.toFixed(2)}）。`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === 'AUDIO_ANALYSIS_CANCELLED'
          ? '音声解析をキャンセルしました。手動配置は維持されています。'
          : '音声を解析できませんでした。手動配置は維持されています。',
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const findOverlapMessage = (): string | null => {
    for (const angle of mediaAngles) {
      const withDuration = clips
        .filter((clip) => clip.angleId === angle.id)
        .filter(
          (clip): clip is RuntimeSyncClip & { durationSeconds: number } =>
            typeof clip.durationSeconds === 'number',
        );
      if (withDuration.length !== angle.clips.length) continue;
      const overlap = deriveTimelineGaps(
        withDuration.map((clip) => ({
          id: clip.id,
          timelineStartSeconds:
            placements[clip.id] ?? clip.timelineStartSeconds,
          durationSeconds: clip.durationSeconds,
        })),
      ).overlap;
      if (overlap) {
        return `「${overlap.previousClipId}」と「${overlap.clipId}」が ${overlap.overlapSeconds.toFixed(2)} 秒重なっています。`;
      }
    }
    return null;
  };

  const applyTimeline = async (): Promise<void> => {
    const api = window.electronAPI;
    if (isApplying || isAnalyzing) return;
    if (!api?.applyClipTimeline) {
      setMessage('同期配置を保存できません。パッケージを開き直してください。');
      return;
    }
    const overlapMessage = findOverlapMessage();
    if (overlapMessage) {
      setMessage(overlapMessage);
      return;
    }
    setIsApplying(true);
    setMessage('クリップのタイムライン配置を保存しています。');
    try {
      const result = await api.applyClipTimeline(
        metaDataConfigFilePath,
        clips.map((clip) => ({
          clipId: clip.id,
          timelineStartSeconds:
            placements[clip.id] ?? clip.timelineStartSeconds,
          durationSeconds: clip.durationSeconds,
        })),
      );
      const packageRoot = metaDataConfigFilePath.replace(
        /[/\\]\.metadata[/\\]config\.json$/,
        '',
      );
      setVideoList(result.angles.map((angle) => angle.absolutePath));
      setMediaAngles(
        result.angles.map((angle) => ({
          id: angle.id,
          name: angle.name,
          sourceKind: angle.sourceKind,
          clips: angle.clips.map((clip) => ({
            id: clip.id,
            sourceKind: clip.sourceKind,
            source:
              clip.sourceKind === 'youtube'
                ? (clip.sourceUrl ?? '')
                : clip.relativePath
                  ? `${packageRoot}/${clip.relativePath}`
                  : '',
            gapBeforeSeconds: clip.gapBeforeSeconds,
            timelineStartSeconds: clip.timelineStartSeconds ?? 0,
            durationSeconds: clip.durationSeconds,
          })),
        })),
      );
      setMessage('同期を適用し、仮想タイムラインを更新しました。');
      await onApplySync();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message.includes('OVERLAP')
          ? '同一アングル内でクリップが重なっています。'
          : '同期配置を保存できませんでした。',
      );
    } finally {
      setIsApplying(false);
    }
  };

  const cancel = useCallback((): void => {
    if (isAnalyzing) {
      audio.cancel();
      return;
    }
    if (!isApplying) onCancel();
  }, [isAnalyzing, isApplying, audio, onCancel]);

  useEffect(() => {
    window.addEventListener('clip-sync-cancel', cancel);
    return () => window.removeEventListener('clip-sync-cancel', cancel);
  }, [cancel]);

  return {
    clips,
    reference,
    target,
    referenceId: reference?.id ?? '',
    targetId: target?.id ?? '',
    placements,
    offsetFor,
    hasChanges: Object.keys(placements).length > 0,
    moveTarget: (seconds: number): void => {
      if (!target || isApplying || isAnalyzing || !Number.isFinite(seconds))
        return;
      setPlacements((current) => ({
        ...current,
        [target.id]: Math.min(
          86_400,
          Math.max(
            0,
            (current[target.id] ?? target.timelineStartSeconds) + seconds,
          ),
        ),
      }));
    },
    resetPlacements: () => {
      setPlacements({});
      setMessage('保存前の配置に戻しました。');
    },
    setReferenceId,
    setTargetId,
    message,
    isApplying,
    isAnalyzing,
    recordClipDuration,
    placeAtCurrentPositions,
    refineWithAudio,
    applyTimeline,
    cancel,
  };
};
