export interface PackageOpenReadyResult {
  status: 'ready';
  packagePath: string;
  migrated: boolean;
  reused: boolean;
  sourcePath?: string;
}

export interface PackageOpenNeedsDestinationResult {
  status: 'needs-destination';
  sourcePath: string;
  suggestedPath: string;
}

export type PackageOpenPreparationResult =
  | PackageOpenReadyResult
  | PackageOpenNeedsDestinationResult;
