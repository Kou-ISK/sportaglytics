import type { VideoSyncData } from '../video/sync';

export interface VideoAngleConfig {
  id: string;
  name: string;
  relativePath?: string;
  sourceKind?: 'local' | 'youtube';
  sourceUrl?: string;
  clips?: VideoClipConfig[];
  role?: 'primary' | 'secondary';
}

export interface VideoClipConfig {
  id: string;
  sourceKind: 'local' | 'youtube';
  relativePath?: string;
  sourceUrl?: string;
  gapBeforeSeconds: number;
  timelineStartSeconds?: number;
  durationSeconds?: number;
}

export interface PackageMediaClip {
  id: string;
  sourceKind: 'local' | 'youtube';
  source: string;
  gapBeforeSeconds: number;
  timelineStartSeconds: number;
  durationSeconds?: number;
}

export interface PackageMediaAngle {
  id: string;
  name: string;
  sourceKind: 'local' | 'youtube';
  clips: PackageMediaClip[];
  /** Original config.json angles[] index. Runtime playback may reorder angles. */
  configIndex?: number;
}

export interface MetaData {
  tightViewPath: string;
  wideViewPath: string | null;
  team1Name: string;
  team2Name: string;
  actionList: string[];
  angles?: VideoAngleConfig[];
  primaryAngleId?: string;
  secondaryAngleId?: string;
  syncData?: VideoSyncData;
}
