import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction, SyntheticEvent } from 'react';
import type { VideoPlayerError } from '../../../../types/VideoPlayerError';
import type { VideoSyncData } from '../../../../types/VideoSync';
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
  syncMode: 'auto' | 'manual';
  setSyncMode: Dispatch<SetStateAction<'auto' | 'manual'>>;
  currentTime: number;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  handleCurrentTime: (
    event: SyntheticEvent | Event,
    newValue: number | number[],
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

    const { currentTime, setCurrentTime, handleCurrentTime } =
      useVideoTimeController({
        videoList,
        syncData,
        syncMode,
      });

    const syncActions = useSyncActions({
      videoList,
      syncData,
      setSyncData,
      setIsVideoPlaying,
      metaDataConfigFilePath,
      setSyncMode,
      onSyncError: setError,
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
      isVideoPlaying,
      setIsVideoPlaying,
      videoPlayBackRate,
      setVideoPlayBackRate,
      syncData,
      setSyncData,
      syncMode,
      setSyncMode,
      currentTime,
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
