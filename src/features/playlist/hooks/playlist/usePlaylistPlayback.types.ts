import type React from 'react';
import type { ItemAnnotation, PlaylistItem } from '../../../../types/Playlist';

export interface UsePlaylistPlaybackParams {
  items: PlaylistItem[];
  currentIndex: number;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  isPlaying: boolean;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  isFrozen: boolean;
  setIsFrozen: React.Dispatch<React.SetStateAction<boolean>>;
  currentItem: PlaylistItem | null;
  currentAnnotation?: ItemAnnotation;
  autoAdvance: boolean;
  loopPlaylist: boolean;
  viewMode: 'dual' | 'angle1' | 'angle2';
  currentVideoSource: string | null;
  currentVideoSource2: string | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoRef2: React.RefObject<HTMLVideoElement | null>;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setDuration: React.Dispatch<React.SetStateAction<number>>;
  volume: number;
  isMuted: boolean;
  setVolume: React.Dispatch<React.SetStateAction<number>>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  setIsFullscreen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsDrawingMode: React.Dispatch<React.SetStateAction<boolean>>;
  minFreezeDuration: number;
  defaultFreezeDuration: number;
  annotationTimeTolerance: number;
  freezeRetriggerGuard: number;
}

export interface PlaylistPlaybackActions {
  handlePlayItem: (id?: string) => void;
  handleTogglePlay: () => void;
  handlePrevious: () => void;
  handleNext: () => void;
  handleSeek: (event: Event, value: number | number[]) => void;
  handleVolumeChange: (_: Event, value: number | number[]) => void;
  handleToggleFullscreen: () => void;
  triggerFreezeFrame: (freezeDuration: number) => void;
  handleItemEnd: () => void;
}
