export interface PackageAnglePayload {
  id: string;
  name: string;
  sourcePath: string;
  role?: 'primary' | 'secondary';
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
    relativePath: string;
  }>;
}

export interface NormalizedAngle {
  id: string;
  name: string;
  role?: 'primary' | 'secondary';
  relativePath: string;
  absolutePath: string;
}

export interface ConvertConfigResult {
  success: boolean;
  config?: Record<string, unknown>;
  error?: string;
}
