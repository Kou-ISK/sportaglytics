import { useCallback, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../../types/video/sync';
import {
  getPrimaryPlayerTime,
  syncPlayersToGlobalTime,
} from './syncPlayerAdapter';

interface UseSyncPlayerUpdaterParams {
  videoList: string[];
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
}

interface UseSyncPlayerUpdaterResult {
  playerForceUpdateKey: number;
  forceUpdateVideoPlayers: (newSyncData: VideoSyncData, isCurrent?: () => boolean) => Promise<void>;
}

export const useSyncPlayerUpdater = ({
  videoList,
  setIsVideoPlaying,
}: UseSyncPlayerUpdaterParams): UseSyncPlayerUpdaterResult => {
  const [playerForceUpdateKey, setPlayerForceUpdateKey] = useState(0);

  const forceUpdateVideoPlayers = useCallback(
    (newSyncData: VideoSyncData, isCurrent: () => boolean = () => true): Promise<void> => {
      return new Promise((resolve) => {
        setIsVideoPlaying(false);

        requestAnimationFrame(() => {
          if (!isCurrent()) { resolve(); return; }
          syncPlayersToGlobalTime(
            videoList,
            newSyncData,
            getPrimaryPlayerTime(),
          );

          setPlayerForceUpdateKey((previous) => previous + 1);

          globalThis.setTimeout(() => {
            if (isCurrent()) setIsVideoPlaying(true);
            resolve();
          }, 300);
        });
      });
    },
    [setIsVideoPlaying, videoList],
  );

  return {
    playerForceUpdateKey,
    forceUpdateVideoPlayers,
  };
};
