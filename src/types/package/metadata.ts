import type { VideoSyncData } from '../video/sync';

export interface VideoAngleConfig {
  id: string;
  name: string;
  relativePath: string;
  role?: 'primary' | 'secondary';
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
