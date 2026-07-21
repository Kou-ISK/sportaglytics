export interface PackageAnglePayload {
  id: string;
  name: string;
  clips: PackageClipPayload[];
  role?: 'primary' | 'secondary';
}

export interface PackageClipPayload {
  id: string;
  sourceKind: 'local' | 'youtube';
  source: string;
  gapBeforeSeconds: number;
}

export interface PackageMetaDataConfig extends Record<string, unknown> {
  tightViewPath?: string;
  wideViewPath?: string | null;
  team1Name?: string;
  team2Name?: string;
  actionList?: string[];
  primaryAngleId?: string;
  secondaryAngleId?: string;
  angles?: Array<{
    id: string;
    name: string;
    role?: 'primary' | 'secondary';
    relativePath?: string;
    sourceKind?: 'local' | 'youtube';
    sourceUrl?: string;
    clips?: Array<{
      id: string;
      sourceKind: 'local' | 'youtube';
      relativePath?: string;
      sourceUrl?: string;
      gapBeforeSeconds: number;
    }>;
  }>;
}

export interface NormalizedAngle {
  id: string;
  name: string;
  role?: 'primary' | 'secondary';
  relativePath?: string;
  absolutePath: string;
  sourceKind: 'local' | 'youtube';
  sourceUrl?: string;
  clips: Array<{
    id: string;
    sourceKind: 'local' | 'youtube';
    relativePath?: string;
    absolutePath?: string;
    sourceUrl?: string;
    gapBeforeSeconds: number;
  }>;
}

export interface ConvertConfigResult {
  success: boolean;
  config?: Record<string, unknown>;
  error?: string;
}
