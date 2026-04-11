import type {
  Playlist,
  PlaylistItem,
  PlaylistState,
} from './core';

export interface PlaylistSyncData {
  state: PlaylistState;
  videoPath: string | null;
  videoPath2: string | null;
  videoSources: string[];
  currentTime: number;
  packagePath?: string;
}

export type PlaylistCommand =
  | { type: 'seek'; time: number }
  | { type: 'play-item'; itemId: string }
  | { type: 'update-state'; state: PlaylistState }
  | { type: 'add-items'; items: PlaylistItem[] }
  | { type: 'request-sync' }
  | { type: 'save-playlist'; playlist: Playlist; filePath?: string }
  | { type: 'load-playlist'; filePath: string }
  | { type: 'set-dirty'; isDirty: boolean }
  | { type: 'get-dirty' };
