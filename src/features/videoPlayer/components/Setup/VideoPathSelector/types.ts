import type { Dispatch, SetStateAction } from 'react';
import type { VideoSyncData } from '../../../../../types/video/sync';
import type {
  PackageMediaAngle,
  PackageMediaClip,
} from '../../../../../types/package/metadata';
export type { PackageMediaAngle, PackageMediaClip };

export interface VideoPathSelectorProps {
  setVideoList: Dispatch<SetStateAction<string[]>>;
  setIsFileSelected: Dispatch<SetStateAction<boolean>>;
  setTimelineFilePath: Dispatch<SetStateAction<string>>;
  setPackagePath: Dispatch<SetStateAction<string>>;
  setMetaDataConfigFilePath: Dispatch<SetStateAction<string>>;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
  setMediaAngles: Dispatch<SetStateAction<PackageMediaAngle[]>>;
}

export interface WizardFormState {
  packageName: string;
  team1Name: string;
  team2Name: string;
}

export interface AngleSelection {
  id: string;
  name: string;
  clips: ClipSelection[];
}

export interface ClipSelection {
  id: string;
  sourceKind: 'local' | 'youtube';
  source: string;
  gapBeforeSeconds: number;
  timelineStartSeconds?: number;
  durationSeconds?: number;
}

export interface WizardSelectionState {
  selectedDirectory: string;
  angles: AngleSelection[];
}

export interface PackageLoadResult {
  videoList: string[];
  syncData: VideoSyncData | undefined;
  timelinePath: string;
  metaDataConfigFilePath: string;
  packagePath?: string;
  mediaAngles?: PackageMediaAngle[];
}

export interface RecentPackage {
  path: string;
  name: string;
  team1Name: string;
  team2Name: string;
  lastOpened: number;
  videoCount: number;
}
