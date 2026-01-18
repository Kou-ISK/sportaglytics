import { useEffect } from 'react';
import videojs from 'video.js';
import type { VideoSyncData } from '../../../types/VideoSync';

type ManualSyncSeekParams = {
  syncMode: 'auto' | 'manual';
  syncData?: VideoSyncData;
  videoList: string[];
};

export const useManualSyncSeek = ({
  syncMode,
  syncData,
  videoList,
}: ManualSyncSeekParams): void => {
  useEffect(() => {
    if (syncMode === 'manual' && syncData?.isAnalyzed && videoList.length >= 2) {
      const offset = syncData.syncOffset || 0;

      try {
        const vjs = videojs as unknown as {
          getPlayer?: (
            id: string,
          ) => { currentTime?: (time?: number) => number } | undefined;
        };

        const p0 = vjs.getPlayer?.('video_0');
        const p1 = vjs.getPlayer?.('video_1');

        if (p0 && p1) {
          const t0 = p0.currentTime?.() ?? 0;
          // video_1はoffsetを考慮した位置にシーク
          // t1 = t0 + offset (offset = video_0の時刻に加算してvideo_1の時刻を得る値)
          const t1 = Math.max(0, t0 + offset);
          p1.currentTime?.(t1);

          console.log(
            `[手動モード] offsetを考慮したシーク: video_0=${t0.toFixed(3)}s, video_1=${t1.toFixed(3)}s (offset=${offset.toFixed(3)}s)`,
          );
        }
      } catch (error) {
        console.error('手動モード開始時のシークエラー:', error);
      }
    }
  }, [syncMode, syncData, videoList]);
};
