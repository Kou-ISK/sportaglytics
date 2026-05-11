import type { AnalysisView } from '../analysis/view';
import type { PlaylistItem } from '../playlist/core';
import type { TimelineData } from '../timeline/core';
import { isPlaylistItem } from './playlistWindow';
import {
  isArrayOf,
  isFiniteNumber,
  isOptional,
  isPlainObject,
  isString,
  isStringArray,
} from './shared';

export const ANALYSIS_WINDOW_CHANNELS = {
  openWindow: 'analysis:open-window',
  closeWindow: 'analysis:close-window',
  isWindowOpen: 'analysis:is-window-open',
  syncToWindow: 'analysis:sync-to-window',
  sync: 'analysis:sync',
  jumpToSegment: 'analysis:jump-to-segment',
  createAiPlaylist: 'analysis:create-ai-playlist',
  dashboardExternalOpen: 'analysis-dashboard:external-open',
} as const;

const ANALYSIS_VIEWS = new Set<AnalysisView>([
  'dashboard',
  'momentum',
  'matrix',
  'ai',
]);

export interface AnalysisWindowSyncPayload {
  timeline: TimelineData[];
  teamNames: string[];
  view?: AnalysisView;
}

export interface AnalysisAiPlaylistPayload {
  name: string;
  items: PlaylistItem[];
}

export interface IAnalysisWindowAPI {
  openWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  isWindowOpen: () => Promise<boolean>;
  syncToWindow: (payload: AnalysisWindowSyncPayload) => void;
  onSync: (callback: (payload: AnalysisWindowSyncPayload) => void) => void;
  offSync: (callback: (payload: AnalysisWindowSyncPayload) => void) => void;
  sendJumpToSegment: (segment: TimelineData) => void;
  sendCreateAiPlaylist: (payload: AnalysisAiPlaylistPayload) => void;
  onJumpToSegment: (callback: (segment: TimelineData) => void) => () => void;
  onCreateAiPlaylist: (
    callback: (payload: AnalysisAiPlaylistPayload) => void,
  ) => () => void;
  onDashboardExternalOpen: (callback: (filePath: string) => void) => () => void;
}

export const isAnalysisView = (value: unknown): value is AnalysisView => {
  return typeof value === 'string' && ANALYSIS_VIEWS.has(value as AnalysisView);
};

export const isTimelineData = (value: unknown): value is TimelineData => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isString(value.id) &&
    isString(value.actionName) &&
    isFiniteNumber(value.startTime) &&
    isFiniteNumber(value.endTime) &&
    isString(value.memo) &&
    isOptional(
      value.labels,
      (candidate): candidate is Array<{ name: string; group?: string }> => {
        return isArrayOf(candidate, (label): label is { name: string; group?: string } => {
          return (
            isPlainObject(label) &&
            isString(label.name) &&
            isOptional(label.group, isString)
          );
        });
      },
    ) &&
    isOptional(value.color, isString)
  );
};

export const isAnalysisWindowSyncPayload = (
  value: unknown,
): value is AnalysisWindowSyncPayload => {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    isArrayOf(value.timeline, isTimelineData) &&
    isStringArray(value.teamNames) &&
    isOptional(value.view, isAnalysisView)
  );
};

export const isAnalysisAiPlaylistPayload = (
  value: unknown,
): value is AnalysisAiPlaylistPayload => {
  if (!isPlainObject(value)) {
    return false;
  }

  return isString(value.name) && isArrayOf(value.items, isPlaylistItem);
};
