import type { BrowserWindow } from 'electron';
import type { PackageSession } from '../packageSessionRegistry';
import type { PlaylistItem } from '../../../src/types/playlist/core';
import type { PlaylistSyncData } from '../../../src/types/playlist/window';

export type PlaylistDelivery =
  | { type: 'add-item'; item: PlaylistItem }
  | { type: 'sync'; data: PlaylistSyncData };

export interface PlaylistWindowInfo {
  window: BrowserWindow;
  filePath: string | null;
  /** Open intent until the first renderer snapshot is accepted. Never a save target. */
  initialFilePath?: string;
  isDirty: boolean;
  sessionId: string | null;
  session: PackageSession | null;
  rendererReady: boolean;
  pendingDeliveries: PlaylistDelivery[];
}

const playlistWindows = new Map<string, PlaylistWindowInfo>();
let mainWindow: BrowserWindow | null = null;
let ffmpegPath: string | null = null;

export const getPlaylistWindows = (): Map<string, PlaylistWindowInfo> => {
  return playlistWindows;
};

export const getMainWindowRef = (): BrowserWindow | null => {
  return mainWindow;
};

export const setMainWindowRefState = (win: BrowserWindow): void => {
  mainWindow = win;
};

export const getFfmpegPathRef = (): string | null => {
  return ffmpegPath;
};

export const setFfmpegPathRef = (value: string): void => {
  ffmpegPath = value;
};
