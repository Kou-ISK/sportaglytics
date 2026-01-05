import { Dispatch, SetStateAction } from 'react';
import { VideoSyncData } from '../../../../../types/VideoSync';

export interface VideoPathSelectorProps {
  setVideoList: Dispatch<SetStateAction<string[]>>;
  setIsFileSelected: Dispatch<SetStateAction<boolean>>;
  setTimelineFilePath: Dispatch<SetStateAction<string>>;
  setPackagePath: Dispatch<SetStateAction<string>>;
  setMetaDataConfigFilePath: Dispatch<SetStateAction<string>>;
  setSyncData: Dispatch<SetStateAction<VideoSyncData | undefined>>;
}

export interface WizardFormState {
  packageName: string;
  team1Name: string;
  team2Name: string;
}

export type AngleRole = 'primary' | 'secondary';

export interface AngleSelection {
  id: string;
  name: string;
  filePath: string;
}

export interface WizardSelectionState {
  selectedDirectory: string;
  angles: AngleSelection[];
}

export interface WizardStepContext
  extends WizardFormState,
    WizardSelectionState {
  errors: Partial<Record<keyof WizardFormState, string>>;
  activeStep: number;
}

export interface SyncStatus {
  isAnalyzing: boolean;
  syncProgress: number;
  syncStage: string;
}

export interface PackageLoadResult {
  videoList: string[];
  syncData: VideoSyncData | undefined;
  timelinePath: string;
  metaDataConfigFilePath: string;
  packagePath?: string;
}
