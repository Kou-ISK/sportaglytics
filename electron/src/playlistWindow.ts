/**
 * Playlist window public facade.
 *
 * Keep this file as a stable entrypoint for existing imports
 * while implementation details live in dedicated modules.
 */
import type { BrowserWindow } from 'electron';
import { registerPlaylistHandlers as registerHandlers } from './playlistWindow/handlers';
import { setFfmpegPathRef, setMainWindowRefState } from './playlistWindow/state';
import {
  addItemToAllWindows,
  closeAllPlaylistWindows,
  closePlaylistWindow,
  createPlaylistWindow,
  getOpenWindowCount,
  isPlaylistWindowOpen,
  sendPlaylistFileToWindow,
  setWindowDirty,
  syncToPlaylistWindow,
} from './playlistWindow/windowManager';

export const setMainWindowRef = (win: BrowserWindow): void => {
  setMainWindowRefState(win);
};

export const setFfmpegPath = (ffmpegPath: string): void => {
  setFfmpegPathRef(ffmpegPath);
};

export {
  createPlaylistWindow,
  sendPlaylistFileToWindow,
  closeAllPlaylistWindows,
  closePlaylistWindow,
  isPlaylistWindowOpen,
  getOpenWindowCount,
  addItemToAllWindows,
  setWindowDirty,
  syncToPlaylistWindow,
};

export const registerPlaylistHandlers = (): void => {
  registerHandlers();
};
