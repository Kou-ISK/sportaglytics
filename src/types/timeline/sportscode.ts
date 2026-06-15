export interface SCLabel {
  name: string;
  group?: string;
}

export interface SCInstance {
  uniqueId: string;
  instanceNum: number;
  modifyCount: number;
  startTime: number;
  endTime: number;
  notes: string;
  sharing: boolean;
  labels: SCLabel[];
}

export interface SCRow {
  rowNum: number;
  modifyCount: number;
  name: string;
  uniqueId: string;
  color: string;
  instances: SCInstance[];
}

export interface SCTimelineContent {
  packagePath: string;
  uniqueId: string;
  currentModifyCount: number;
  labels: SCLabel[];
  rows: SCRow[];
}

export interface SCTimelineFile {
  timeline: SCTimelineContent;
  currentPlaybackTime?: number;
}
