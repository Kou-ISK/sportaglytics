import type { SCLabel } from '../timeline/sportscode';

export type PlaylistType = 'reference' | 'embedded';
export type DrawingToolType =
  | 'pen'
  | 'line'
  | 'arrow'
  | 'rectangle'
  | 'circle'
  | 'text'
  | 'select';
export type AnnotationTarget = 'primary' | 'secondary';
export type PlaylistLoopMode = 'none' | 'single' | 'all';

export interface DrawingObject {
  id: string;
  type: DrawingToolType;
  color: string;
  strokeWidth: number;
  fill?: boolean;
  startX: number;
  startY: number;
  endX?: number;
  endY?: number;
  path?: Array<{ x: number; y: number }>;
  text?: string;
  fontSize?: number;
  timestamp: number;
  target?: AnnotationTarget;
  baseWidth?: number;
  baseHeight?: number;
}

export interface ItemAnnotation {
  objects: DrawingObject[];
  freezeDuration: number;
  freezeAt: number;
}

export interface PlaylistAiMeta {
  reason?: string;
  centerId?: string;
  centerIds?: string[];
  evidenceIds?: string[];
  source?: 'ai-review';
}

export interface PlaylistItem {
  id: string;
  timelineItemId: string | null;
  actionName: string;
  startTime: number;
  endTime: number;
  labels?: SCLabel[];
  memo?: string;
  note?: string;
  addedAt: number;
  videoSource?: string;
  videoSource2?: string;
  annotation?: ItemAnnotation;
  aiMeta?: PlaylistAiMeta;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  type: PlaylistType;
  items: PlaylistItem[];
  sourcePackagePath?: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaylistState {
  playlists: Playlist[];
  activePlaylistId: string | null;
  playingItemId: string | null;
  loopMode: PlaylistLoopMode;
}

export interface PlaylistSaveProgressPayload {
  current: number;
  total: number;
}

export interface PlaylistFileLoadResult {
  playlist: Playlist;
  filePath: string;
}
