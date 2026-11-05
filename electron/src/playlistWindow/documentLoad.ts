import { randomUUID } from 'node:crypto';
import type { PlaylistWindowInfo } from './state';
import type { AcceptedEmbeddedDocument } from './acceptedEmbeddedAssets';

interface PendingLoad {
  id: string;
  filePath?: string;
  snapshot?: AcceptedEmbeddedDocument | null;
}

// A ticket belongs to one live window and one read. Disk completion cannot
// change its committed document; only the renderer's acceptance can do that.
const pendingLoads = new WeakMap<PlaylistWindowInfo, PendingLoad>();
const documentRevisions = new WeakMap<PlaylistWindowInfo, number>();
const acceptedDocuments = new WeakMap<
  PlaylistWindowInfo,
  AcceptedEmbeddedDocument | null
>();
export const acceptedEmbeddedDocument = (
  info: PlaylistWindowInfo,
): AcceptedEmbeddedDocument | null => acceptedDocuments.get(info) ?? null;
export const playlistDocumentRevision = (info: PlaylistWindowInfo): number =>
  documentRevisions.get(info) ?? 0;
const advanceRevision = (info: PlaylistWindowInfo): void => {
  documentRevisions.set(info, playlistDocumentRevision(info) + 1);
};

export const beginPlaylistDocumentLoad = (info: PlaylistWindowInfo): string => {
  advanceRevision(info);
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
  snapshot: AcceptedEmbeddedDocument | null = null,
): boolean => {
  if (!isCurrentPlaylistDocumentLoad(info, id)) return false;
  pendingLoads.set(info, { id, filePath, snapshot });
  return true;
};

export const acceptPlaylistDocumentLoad = (
  info: PlaylistWindowInfo,
  id: string,
): boolean => {
  const pending = pendingLoads.get(info);
  if (!isCurrentPlaylistDocumentLoad(info, id) || !pending?.filePath)
    return false;
  advanceRevision(info);
  info.filePath = pending.filePath;
  acceptedDocuments.set(info, pending.snapshot ?? null);
  delete info.initialFilePath;
  pendingLoads.delete(info);
  // Dirty state is published by the renderer after its accepted snapshot and
  // queued additions are applied. A disk read/ack must never clear newer edits.
  return true;
};

export const cancelPlaylistDocumentLoad = (info: PlaylistWindowInfo): void => {
  advanceRevision(info);
  pendingLoads.delete(info);
};
