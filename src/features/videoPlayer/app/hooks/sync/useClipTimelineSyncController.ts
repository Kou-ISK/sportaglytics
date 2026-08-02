import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type {
  PackageMediaAngle,
  PackageMediaClip,
} from '../../../../../types/package/metadata';
import {
  calculateTimelineStart,
  deriveTimelineGaps,
} from '../../../../../types/package/clipTimeline';
import {
  getVideoJsPlayer,
  getVideoJsPlayerCurrentTime,
} from '../../../shared/videojs/videoJsAdapter';
import { decodeBase64ToArrayBuffer } from '../../../../../utils/audioSync/audioDecode';
import { runAudioSyncAnalysis } from '../../../../../utils/AudioSyncAnalyzer';

export type RuntimeSyncClip = PackageMediaClip & {
  angleId: string;
  angleName: string;
};

interface UseClipTimelineSyncControllerParams {
  onApplySync: () => void | Promise<void>;
  onCancel: () => void;
  mediaAngles: PackageMediaAngle[];
  metaDataConfigFilePath: string;
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  setVideoList: Dispatch<SetStateAction<string[]>>;
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
  metaDataConfigFilePath,
  setMediaAngles,
  setVideoList,
}: UseClipTimelineSyncControllerParams) => {
  const clips = useMemo(() => flattenClips(mediaAngles), [mediaAngles]);
  const [referenceId, setReferenceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [placements, setPlacements] = useState<Record<string, number>>({});
  const [message, setMessage] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audioAnalysisCancelledRef = useRef(false);
  const cancelActiveCaptureRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setPlacements(
      Object.fromEntries(
        clips.map((clip) => [clip.id, clip.timelineStartSeconds]),
      ),
    );
    setReferenceId((current) => current || clips[0]?.id || '');
    setTargetId((current) => current || clips[1]?.id || '');
  }, [clips]);

  const reference = clips.find((clip) => clip.id === referenceId);
  const target = clips.find((clip) => clip.id === targetId);
  const recordClipDuration = useCallback(
    (clipId: string): Dispatch<SetStateAction<number>> =>
      (value) => {
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value <= 0
        ) {
          return;
        }
        setMediaAngles((current) =>
          current.map((angle) => ({
            ...angle,
            clips: angle.clips.map((clip) =>
              clip.id === clipId &&
              Math.abs((clip.durationSeconds ?? 0) - value) > 0.01
                ? { ...clip, durationSeconds: value }
                : clip,
            ),
          })),
        );
      },
    [setMediaAngles],
  );

  const placeAtCurrentPositions = (): void => {
    if (!reference || !target || reference.id === target.id) return;
    const referenceTime =
      getVideoJsPlayerCurrentTime('sync_reference_clip') ?? 0;
    const targetTime = getVideoJsPlayerCurrentTime('sync_target_clip') ?? 0;
    const nextStart = calculateTimelineStart({
      referenceStartSeconds:
        placements[reference.id] ?? reference.timelineStartSeconds,
      referenceCurrentSeconds: referenceTime,
      targetCurrentSeconds: targetTime,
    });
    if (nextStart < 0 || nextStart > 86_400) {
      setMessage('配置位置は0秒から24時間以内にしてください。');
      return;
    }
    setPlacements((current) => ({ ...current, [target.id]: nextStart }));
    setMessage(`対象クリップを ${nextStart.toFixed(3)} 秒へ配置しました。`);
  };

  const captureLoopback = async (playerId: string): Promise<ArrayBuffer> => {
    const api = window.electronAPI;
    if (!api) throw new Error('ELECTRON_API_UNAVAILABLE');
    if (!(await api.beginLoopbackAudioCapture())) {
      throw new Error('LOOPBACK_UNAVAILABLE');
    }
    let stream: MediaStream | undefined;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) throw new Error('NO_LOOPBACK_AUDIO');
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(new MediaStream(audioTracks));
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      [
        ...Array.from({ length: 8 }, (_, index) => `video_${index}`),
        'sync_reference_clip',
        'sync_target_clip',
      ].forEach((id) => {
        const player = getVideoJsPlayer(id);
        player?.pause?.();
        player?.muted?.(id !== playerId);
      });
      recorder.start();
      await getVideoJsPlayer(playerId)?.play?.();
      await new Promise<void>((resolve) => {
        const timer = globalThis.setTimeout(resolve, 15_000);
        cancelActiveCaptureRef.current = () => {
          globalThis.clearTimeout(timer);
          resolve();
        };
      });
      cancelActiveCaptureRef.current = null;
      getVideoJsPlayer(playerId)?.pause?.();
      const finished = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });
      recorder.stop();
      await finished;
      if (audioAnalysisCancelledRef.current) {
        throw new Error('AUDIO_ANALYSIS_CANCELLED');
      }
      return await new Blob(chunks, {
        type: recorder.mimeType,
      }).arrayBuffer();
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      await api.endLoopbackAudioCapture();
    }
  };

  const readLocalWindow = async (
    source: string,
    start: number,
  ): Promise<ArrayBuffer> => {
    const api = window.electronAPI;
    if (!api) throw new Error('ELECTRON_API_UNAVAILABLE');
    const base64 = await api.extractLocalAudioWindow(source, start, 15);
    if (!base64) throw new Error('AUDIO_WINDOW_UNAVAILABLE');
    return decodeBase64ToArrayBuffer(base64);
  };

  const refineWithAudio = async (): Promise<void> => {
    if (!reference || !target || reference.id === target.id) return;
    const referenceTime =
      getVideoJsPlayerCurrentTime('sync_reference_clip') ?? 0;
    const targetTime = getVideoJsPlayerCurrentTime('sync_target_clip') ?? 0;
    audioAnalysisCancelledRef.current = false;
    setIsAnalyzing(true);
    setMessage(
      '15秒間解析します。YouTube使用時は他プレイヤーを停止・ミュートします。外部アプリの音が混入する場合があります。',
    );
    try {
      const referenceAudio =
        reference.sourceKind === 'youtube'
          ? await captureLoopback('sync_reference_clip')
          : await readLocalWindow(reference.source, referenceTime);
      const targetAudio =
        target.sourceKind === 'youtube'
          ? await captureLoopback('sync_target_clip')
          : await readLocalWindow(target.source, targetTime);
      if (audioAnalysisCancelledRef.current) {
        throw new Error('AUDIO_ANALYSIS_CANCELLED');
      }
      const result = await runAudioSyncAnalysis({
        videoPath1: reference.source,
        videoPath2: target.source,
        readFileAsArrayBuffer: async (source) =>
          source === reference.source ? referenceAudio : targetAudio,
      });
      if (result.confidence < 0.35) {
        setMessage(
          `信頼度が低いため配置を変更しませんでした（${result.confidence.toFixed(2)}）。`,
        );
        return;
      }
      setPlacements((current) => ({
        ...current,
        [target.id]:
          (current[target.id] ?? target.timelineStartSeconds) +
          result.offsetSeconds,
      }));
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
      cancelActiveCaptureRef.current = null;
      setIsAnalyzing(false);
    }
  };

  const findOverlapMessage = (): string | null => {
    for (const angle of mediaAngles) {
      const withDuration = angle.clips.filter(
        (clip): clip is PackageMediaClip & { durationSeconds: number } =>
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
    if (!api?.applyClipTimeline) return;
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

  const cancel = (): void => {
    if (isAnalyzing) {
      audioAnalysisCancelledRef.current = true;
      cancelActiveCaptureRef.current?.();
      return;
    }
    onCancel();
  };

  return {
    clips,
    reference,
    target,
    referenceId,
    targetId,
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
