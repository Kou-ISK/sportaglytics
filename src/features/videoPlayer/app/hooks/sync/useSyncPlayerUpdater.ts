import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { PackageMediaAngle } from '../../../../../types/package/metadata';
import type { VideoSyncData } from '../../../../../types/video/sync';
import {
  getPrimaryPlayerTime,
  syncPlayersToGlobalTime,
} from './syncPlayerAdapter';

interface UseSyncPlayerUpdaterParams {
  videoList: string[];
  mediaAngles: PackageMediaAngle[];
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
}

interface UseSyncPlayerUpdaterResult {
  playerForceUpdateKey: number;
  forceUpdateVideoPlayers: (newSyncData: VideoSyncData) => Promise<void>;
}

export const useSyncPlayerUpdater = ({
  videoList,
  mediaAngles,
  setIsVideoPlaying,
}: UseSyncPlayerUpdaterParams): UseSyncPlayerUpdaterResult => {
  const [playerForceUpdateKey, setPlayerForceUpdateKey] = useState(0);

  const forceUpdateVideoPlayers = useCallback(
    (newSyncData: VideoSyncData): Promise<void> => {
      return new Promise((resolve) => {
        setIsVideoPlaying(false);

        requestAnimationFrame(() => {
          syncPlayersToGlobalTime(
            videoList,
            mediaAngles,
            newSyncData,
            getPrimaryPlayerTime(),
          );

          setPlayerForceUpdateKey((previous) => previous + 1);

          globalThis.setTimeout(() => {
            setIsVideoPlaying(true);
            resolve();
          }, 300);
        });
      });
    },
    [mediaAngles, setIsVideoPlaying, videoList],
  );

  return {
    playerForceUpdateKey,
    forceUpdateVideoPlayers,
  };
};
