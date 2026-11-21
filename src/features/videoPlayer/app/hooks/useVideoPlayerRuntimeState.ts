import { useNotification } from '../../../../contexts/NotificationContext';
import type { VideoSeekMode } from '../../../../types/video/seek';
import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import type { VideoPlayerError } from '../../../../types/video/error';
import type { VideoSyncData } from '../../../../types/video/sync';
import type { PackageMediaAngle } from '../../../../types/package/metadata';
import { useSyncActions } from './useSyncActions';
import { useVideoMetadataSync } from './useVideoMetadataSync';
import { useVideoPlayerErrors } from './useVideoPlayerErrors';
import { useVideoTimeController } from './useVideoTimeController';

interface UseVideoPlayerRuntimeStateResult {
  videoList: string[];
  setVideoList: Dispatch<SetStateAction<string[]>>;
  metaDataConfigFilePath: string;
  setMetaDataConfigFilePath: Dispatch<SetStateAction<string>>;
  teamNames: string[];
  setTeamNames: Dispatch<SetStateAction<string[]>>;
  isFileSelected: boolean;
  setIsFileSelected: Dispatch<SetStateAction<boolean>>;
  maxSec: number;
  setMaxSec: Dispatch<SetStateAction<number>>;
  isVideoPlaying: boolean;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  videoPlayBackRate: number;
  setVideoPlayBackRate: Dispatch<SetStateAction<number>>;
  syncData: VideoSyncData | undefined;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  mediaAngles: PackageMediaAngle[];
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
  syncMode: 'auto' | 'manual';
  setSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  currentTime: number;
  playbackTime: number;
  scrubbing: boolean;
  seekReverse: (time: number, signal: AbortSignal) => Promise<number | null>;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  handleCurrentTime: (
    event: SyntheticEvent | Event,
    newValue: number | number[],
    seekMode?: VideoSeekMode,
  ) => void;
  packagePath: string;
  setPackagePath: Dispatch<SetStateAction<string>>;
  error: VideoPlayerError | null;
  setError: (value: VideoPlayerError | null) => void;
  clearError: () => void;
  playerForceUpdateKey: number;
  resyncAudio: () => Promise<void>;
  resetSync: () => void;
  adjustSyncOffset: () => Promise<void>;
  manualSyncFromPlayers: () => Promise<void>;
  cancelManualSync: () => Promise<void>;
  isAnalyzing: boolean;
  syncProgress: number;
  syncStage: string;
}

export const useVideoPlayerRuntimeState =
  (): UseVideoPlayerRuntimeStateResult => {
    const [videoList, setVideoList] = useState<string[]>([]);
    const [metaDataConfigFilePath, setMetaDataConfigFilePath] =
      useState<string>('');
    const [teamNames, setTeamNames] = useState<string[]>([]);
    const [isFileSelected, setIsFileSelected] = useState(false);
    const [maxSec, setMaxSec] = useState(0);
    const [isVideoPlaying, setIsVideoPlayingState] = useState(false);
    const [videoPlayBackRate, setVideoPlayBackRate] = useState(1);
    const [syncData, setSyncData] = useState<VideoSyncData | undefined>(
      undefined,
    );
    const [mediaAngles, setMediaAngles] = useState<PackageMediaAngle[]>([]);
    const [syncMode, setSyncMode] = useState<'auto' | 'manual'>('auto');
    const [packagePath, setPackagePath] = useState('');
    const { error, setError, clearError } = useVideoPlayerErrors();

    const setIsVideoPlaying = useCallback<Dispatch<SetStateAction<boolean>>>(
      (value) => {
        setIsVideoPlayingState((prev) =>
          typeof value === 'function' ? value(prev) : value,
        );
      },
      [],
    );

    const onScrubFailure = useCallback((): void => {
      setIsVideoPlayingState(false);
      setError({ type: 'playback', message: 'シーク先の映像を確認できませんでした。' });
    }, [setError]);
    const {
      scrubbing,
      currentTime,
      playbackTime,
      seekReverse,
      setCurrentTime,
      handleCurrentTime,
    } = useVideoTimeController({
      onScrubFailure,
      isVideoPlaying,
      videoList,
      syncData,
      syncMode,
      mediaAngles,
    });

    const { info, warning } = useNotification();
    const syncActions = useSyncActions({
      videoList,
      syncData,
      setSyncData,
      setIsVideoPlaying,
      metaDataConfigFilePath,
      setSyncMode,
      onSyncError: setError,
      onSyncInfo: info,
      onSyncWarning: warning,
    });

    useVideoMetadataSync({
      metaDataConfigFilePath,
      syncData,
    });

    return {
      videoList,
      setVideoList,
      metaDataConfigFilePath,
      setMetaDataConfigFilePath,
      teamNames,
      setTeamNames,
      isFileSelected,
      setIsFileSelected,
      maxSec,
      setMaxSec,
      isVideoPlaying: isVideoPlaying && !scrubbing,
      setIsVideoPlaying,
      videoPlayBackRate,
      setVideoPlayBackRate,
      syncData,
      setSyncData,
      mediaAngles,
      setMediaAngles,
      syncMode,
      setSyncMode,
      currentTime,
      playbackTime,
      scrubbing,
      seekReverse,
      setCurrentTime,
      handleCurrentTime,
      packagePath,
      setPackagePath,
      error,
      setError,
      clearError,
      ...syncActions,
    };
  };
