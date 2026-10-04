import type { Playlist, PlaylistItem, PlaylistState } from './core';

export type PlaylistWorkspaceMode = 'organizer' | 'sorter' | 'studio';

export interface PlaylistSorterColumnState {
  id: string;
  width: number;
  visible: boolean;
  order: number;
}

/** Ephemeral window state. It must never be serialized into a Playlist. */
export interface PlaylistWindowViewState {
  mode: PlaylistWorkspaceMode;
  inspectorVisible: boolean;
  inspectorWidth: number;
  workspaceRatio: number;
  sorterColumns: PlaylistSorterColumnState[];
  sorterSort?: { columnId: string; direction: 'asc' | 'desc' };
}

export const DEFAULT_PLAYLIST_WINDOW_VIEW_STATE: PlaylistWindowViewState = {
  mode: 'organizer',
  inspectorVisible: true,
  inspectorWidth: 280,
  workspaceRatio: 0.5,
  sorterColumns: [],
};

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
  | { type: 'accept-loaded-document'; loadId: string }
  | { type: 'set-dirty'; isDirty: boolean }
  | { type: 'get-dirty' };
