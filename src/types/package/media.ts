/** Stored media timelines are shared with Main and have no browser-only types. */
export interface PackageMediaClip {
  id: string;
  sourceKind: 'local' | 'youtube';
  source: string;
  gapBeforeSeconds: number;
  timelineStartSeconds: number;
  durationSeconds?: number;
}

export interface PackageMediaAngle {
  playbackFormat?: 'fragmented-mp4';
  id: string;
  name: string;
  sourceKind: 'local' | 'youtube';
  clips: PackageMediaClip[];
}
