import { VideoSyncData } from './VideoSync';

export type VideoAngleConfig = {
  id: string;
  name: string;
  relativePath: string;
  role?: 'primary' | 'secondary';
};

export type MetaData = {
  tightViewPath: string;
  wideViewPath: string | null;
  team1Name: string;
  team2Name: string;
  actionList: string[];
  angles?: VideoAngleConfig[];
  primaryAngleId?: string;
  secondaryAngleId?: string;
  syncData?: VideoSyncData; // 映像同期データ
};
