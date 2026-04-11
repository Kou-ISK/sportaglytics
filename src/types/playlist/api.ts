import type {
  Playlist,
  PlaylistFileLoadResult,
  PlaylistItem,
  PlaylistSaveProgressPayload,
} from './core';
import type {
  PlaylistCommand,
  PlaylistSyncData,
} from './window';

export interface IPlaylistAPI {
  openWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowOpen: () => Promise<boolean>;
  syncToWindow: (data: PlaylistSyncData) => void;
  onCommand: (callback: (command: PlaylistCommand) => void) => void;
  offCommand: (callback: (command: PlaylistCommand) => void) => void;
  onWindowClosed: (callback: () => void) => void;
  offWindowClosed: (callback: () => void) => void;
  onSync: (callback: (data: PlaylistSyncData) => void) => void;
  offSync: (callback: (data: PlaylistSyncData) => void) => void;
  sendCommand: (command: PlaylistCommand) => void;
  savePlaylistFile: (
    playlist: Playlist,
    filePath?: string,
  ) => Promise<string | null>;
  savePlaylistFileAs: (playlist: Playlist) => Promise<string | null>;
  loadPlaylistFile: (
    filePath?: string,
  ) => Promise<PlaylistFileLoadResult | null>;
  onExternalOpen: (callback: (filePath: string) => void) => () => void;
  onSaveProgress: (
    callback: (data: PlaylistSaveProgressPayload) => void,
  ) => () => void;
  getOpenWindowCount: () => Promise<number>;
  addItemToAllWindows: (item: PlaylistItem) => Promise<void>;
  onAddItem: (callback: (item: PlaylistItem) => void) => void;
  offAddItem: (callback: (item: PlaylistItem) => void) => void;
  setWindowTitle: (title: string) => void;
  onRequestSave: (callback: () => void) => () => void;
  notifySavedAndClose: () => void;
}
