import type {
  ItemAnnotation,
  Playlist,
  PlaylistItem,
  PlaylistRow,
  PlaylistType,
} from '../../../types/playlist/core';
import {
  getPresentationItems,
  normalizePlaylistDocument,
} from '../../../shared/playlist/playlistDocument';
import { resolveViewModeForSources } from './viewMode';

interface BuildPlaylistPayloadParams {
  items: PlaylistItem[];
  videoSources: string[];
  packagePath: string | null;
  itemAnnotations: Record<string, ItemAnnotation>;
  name: string;
  type: PlaylistType;
  rows?: PlaylistRow[];
  normalizeDocument?: boolean;
  createId?: () => string;
  now?: () => number;
}

export interface LoadedPlaylistSnapshot {
  items: PlaylistItem[];
  rows?: PlaylistRow[];
  hasUnsavedChanges: boolean;
  playlistName: string;
  playlistType: PlaylistType;
  packagePath: string | null;
  loadedFilePath: string;
  isDirty: boolean;
  itemAnnotations: Record<string, ItemAnnotation>;
  videoSources: string[];
  viewMode: 'dual' | 'angle1';
  currentIndex: number;
}

const extractPlaylistAnnotations = (
  items: PlaylistItem[],
): Record<string, ItemAnnotation> => {
  const annotations: Record<string, ItemAnnotation> = {};
  for (const item of items) {
    if (item.annotation) {
      annotations[item.id] = item.annotation;
    }
  }
  return annotations;
};

const resolvePlaylistVideoSources = (items: PlaylistItem[]): string[] => {
  const sources: string[] = [];
  if (items[0]?.videoSource) {
    sources.push(items[0].videoSource);
  }
  if (items[0]?.videoSource2) {
    sources.push(items[0].videoSource2);
  }
  return sources;
};

export const buildPlaylistPayload = ({
  items,
  videoSources,
  packagePath,
  itemAnnotations,
  name,
  type,
  rows,
  normalizeDocument = false,
  createId = () => crypto.randomUUID(),
  now = () => Date.now(),
}: BuildPlaylistPayloadParams): Playlist => {
  const timestamp = now();
  const payload: Playlist = {
    id: createId(),
    name,
    type,
    items: items.map((item) => ({
      ...item,
      videoSource: item.videoSource ?? videoSources[0] ?? undefined,
      videoSource2: item.videoSource2 ?? videoSources[1] ?? undefined,
      annotation: item.annotation ?? itemAnnotations[item.id],
    })),
    sourcePackagePath: packagePath ?? undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(rows ? { rows } : {}),
  };
  if (normalizeDocument || rows || items.some((item) => item.rowId !== undefined)) {
    return normalizePlaylistDocument(payload);
  }
  return payload;
};

export const buildLoadedPlaylistSnapshot = (
  playlist: Playlist,
  loadedFilePath: string,
): LoadedPlaylistSnapshot => {
  const hasDocumentStructure =
    playlist.rows !== undefined || playlist.schemaVersion !== undefined;
  const normalized = normalizePlaylistDocument(playlist);
  const presentationItems = hasDocumentStructure
    ? getPresentationItems(normalized)
    : playlist.items;
  const videoSources = resolvePlaylistVideoSources(presentationItems);
  return {
    items: presentationItems,
    ...(hasDocumentStructure ? { rows: normalized.rows } : {}),
    hasUnsavedChanges: false,
    playlistName: playlist.name,
    playlistType: playlist.type || 'embedded',
    packagePath: playlist.sourcePackagePath || null,
    loadedFilePath,
    isDirty: false,
    itemAnnotations: extractPlaylistAnnotations(presentationItems),
    videoSources,
    viewMode: resolveViewModeForSources(videoSources),
    currentIndex: presentationItems.length > 0 ? 0 : -1,
  };
};
