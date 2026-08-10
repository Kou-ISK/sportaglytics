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
  isVideoPlaying: boolean;
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
}

interface UseSyncPlayerUpdaterResult {
  playerForceUpdateKey: number;
  forceUpdateVideoPlayers: (newSyncData: VideoSyncData) => Promise<void>;
}

export const useSyncPlayerUpdater = ({
  videoList,
  mediaAngles,
  isVideoPlaying,
  setIsVideoPlaying,
}: UseSyncPlayerUpdaterParams): UseSyncPlayerUpdaterResult => {
  const [playerForceUpdateKey, setPlayerForceUpdateKey] = useState(0);

  const forceUpdateVideoPlayers = useCallback(
    (newSyncData: VideoSyncData): Promise<void> => {
      const shouldResume = isVideoPlaying;
      return new Promise((resolve) => {
        if (shouldResume) {
          setIsVideoPlaying(false);
        }

        requestAnimationFrame(() => {
          syncPlayersToGlobalTime(
            videoList,
            mediaAngles,
            newSyncData,
            getPrimaryPlayerTime(),
          );

          setPlayerForceUpdateKey((previous) => previous + 1);

          globalThis.setTimeout(() => {
            if (shouldResume) {
              setIsVideoPlaying(true);
            }
            resolve();
          }, 300);
        });
      });
    },
    [isVideoPlaying, mediaAngles, setIsVideoPlaying, videoList],
  );

  return {
    playerForceUpdateKey,
    forceUpdateVideoPlayers,
  };
};
