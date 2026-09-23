import { dialog, ipcMain } from 'electron';
import {
  PLAYLIST_WINDOW_CHANNELS,
  isPlaylistItem,
} from '../../../src/types/ipc/playlistWindow';
import type { PlaylistItem } from '../../../src/types/playlist/core';
import { getValidatedEventSenderWindow } from '../ipc/windowSenderGuards';
import { getWindowInfoBySender, isSenderPlaylistWindow } from './windowManager';
import {
  relinkPlaylistPackage,
  resolvePlaylistMediaReferences,
} from './mediaReferences';

const validItems = (items: unknown): items is PlaylistItem[] =>
  Array.isArray(items) && items.length <= 10000 && items.every(isPlaylistItem);

export const registerPlaylistMediaReferenceHandlers = (): void => {
  ipcMain.handle(
    PLAYLIST_WINDOW_CHANNELS.resolveMedia,
    async (event, items: unknown) => {
      if (
        !getValidatedEventSenderWindow(event) ||
        !isSenderPlaylistWindow(event.sender) ||
        !validItems(items)
      )
        throw new Error('Invalid playlist media request');
      return resolvePlaylistMediaReferences(
        items,
        getWindowInfoBySender(event.sender)?.filePath ?? undefined,
      );
    },
  );
  ipcMain.handle(
    PLAYLIST_WINDOW_CHANNELS.relinkPackage,
    async (event, items: unknown, itemId: unknown, target: unknown) => {
      const owner = getValidatedEventSenderWindow(event);
      if (
        !owner ||
        !isSenderPlaylistWindow(event.sender) ||
        !validItems(items) ||
        typeof itemId !== 'string' ||
        (target !== 'primary' && target !== 'secondary')
      )
        throw new Error('Invalid playlist relink request');
      const result = await dialog.showOpenDialog(owner, {
        title: '元パッケージの移動先を選択',
        properties: ['openDirectory', 'treatPackageAsDirectory'],
        filters: [{ name: 'SporTagLytics Package', extensions: ['stpkg'] }],
      });
      if (result.canceled || !result.filePaths[0] || owner.isDestroyed())
        return null;
      return relinkPlaylistPackage(
        items,
        itemId,
        target,
        result.filePaths[0],
        getWindowInfoBySender(event.sender)?.filePath ?? undefined,
      );
    },
  );
};
