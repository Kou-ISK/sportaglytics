import type {
  ItemAnnotation,
  Playlist,
  PlaylistItem,
  PlaylistType,
} from '../../../types/playlist/core';
import { resolveViewModeForSources } from './viewMode';

interface BuildPlaylistPayloadParams {
  items: PlaylistItem[];
  videoSources: string[];
  packagePath: string | null;
  itemAnnotations: Record<string, ItemAnnotation>;
  name: string;
  type: PlaylistType;
  createId?: () => string;
  now?: () => number;
}

export interface LoadedPlaylistSnapshot {
  items: PlaylistItem[];
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
  createId = () => crypto.randomUUID(),
  now = () => Date.now(),
}: BuildPlaylistPayloadParams): Playlist => {
  const timestamp = now();
  return {
    id: createId(),
    name,
    type,
    items: items.map((item) => ({
      ...item,
      videoSource: item.videoSource ?? videoSources[0] ?? undefined,
      videoSource2: item.videoSource2 ?? videoSources[1] ?? undefined,
      annotation: itemAnnotations[item.id] ?? item.annotation,
    })),
    sourcePackagePath: packagePath ?? undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const buildLoadedPlaylistSnapshot = (
  playlist: Playlist,
  loadedFilePath: string,
): LoadedPlaylistSnapshot => {
  const videoSources = resolvePlaylistVideoSources(playlist.items);
  return {
    items: playlist.items,
    hasUnsavedChanges: false,
    playlistName: playlist.name,
    playlistType: playlist.type || 'embedded',
    packagePath: playlist.sourcePackagePath || null,
    loadedFilePath,
    isDirty: false,
    itemAnnotations: extractPlaylistAnnotations(playlist.items),
    videoSources,
    viewMode: resolveViewModeForSources(videoSources),
    currentIndex: playlist.items.length > 0 ? 0 : -1,
  };
};
