import { useEffect } from 'react';
import { VideoSyncData } from '../../../../../../types/VideoSync';

type VjsPlayer = {
  isDisposed?: () => boolean;
  currentTime?: (time?: number) => number;
  muted?: (val: boolean) => void;
};

type GetPlayerFn = (id: string) => VjsPlayer | undefined;

interface UseHotkeyPlaybackOptions {
  setVideoPlayBackRate: (value: number) => void;
  triggerFlash: (key: string) => void;
  setIsVideoPlaying: (value: boolean) => void;
  isVideoPlayingRef: React.MutableRefObject<boolean>;
  setCurrentTime: (updater: (prev: number) => number) => void;
  videoList: string[];
  syncData?: VideoSyncData;
  lastManualSeekTimestamp: React.MutableRefObject<number>;
  getExistingPlayer: GetPlayerFn;
}

/**
 * useHotkeyPlayback (Deprecated)
 * Note: Electron 31では、globalShortcutを使用せず、renderer側でkeydownイベントをリッスンする方式に変更しました。
 * このhookは後方互換性のために残していますが、実際の処理は無効化されています。
 * ホットキー処理は VideoPlayerApp.tsx の useGlobalHotkeys で行われます。
 */
export const useHotkeyPlayback = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options: UseHotkeyPlaybackOptions,
) => {
  useEffect(() => {
    console.log(
      '[HOTKEY] useHotkeyPlayback is deprecated. Hotkeys are handled by useGlobalHotkeys.',
    );
  }, []);
};
