import { randomUUID } from 'node:crypto';
import type { PlaylistWindowInfo } from './state';

interface PendingLoad {
  id: string;
  filePath?: string;
}

// A ticket belongs to one live window and one read. Disk completion cannot
// change its committed document; only the renderer's acceptance can do that.
const pendingLoads = new WeakMap<PlaylistWindowInfo, PendingLoad>();

export const beginPlaylistDocumentLoad = (info: PlaylistWindowInfo): string => {
  const id = randomUUID();
  pendingLoads.set(info, { id });
  return id;
};

export const isCurrentPlaylistDocumentLoad = (
  info: PlaylistWindowInfo,
  id: string,
): boolean => !info.window.isDestroyed() && pendingLoads.get(info)?.id === id;

export const resolvePlaylistDocumentLoad = (
  info: PlaylistWindowInfo,
  id: string,
  filePath: string,
): boolean => {
  if (!isCurrentPlaylistDocumentLoad(info, id)) return false;
  pendingLoads.set(info, { id, filePath });
  return true;
};

export const acceptPlaylistDocumentLoad = (
  info: PlaylistWindowInfo,
  id: string,
): boolean => {
  const pending = pendingLoads.get(info);
  if (!isCurrentPlaylistDocumentLoad(info, id) || !pending?.filePath)
    return false;
  info.filePath = pending.filePath;
  delete info.initialFilePath;
  pendingLoads.delete(info);
  // Dirty state is published by the renderer after its accepted snapshot and
  // queued additions are applied. A disk read/ack must never clear newer edits.
  return true;
};

export const cancelPlaylistDocumentLoad = (info: PlaylistWindowInfo): void => {
  pendingLoads.delete(info);
};
