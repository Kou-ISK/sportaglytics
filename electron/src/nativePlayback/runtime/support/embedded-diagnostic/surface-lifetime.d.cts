export interface SurfaceLifetime {
  transfer(): void;
  acknowledge(): void;
  gpuRelease(): void;
  quarantine(): void;
  ended(): boolean;
  uncertain(): boolean;
}
export function createLifetime(release: () => void): SurfaceLifetime;
