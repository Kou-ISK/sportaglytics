import type { BrowserWindow } from 'electron';

export interface PlaylistWindowInfo {
  window: BrowserWindow;
  filePath: string | null;
  isDirty: boolean;
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
