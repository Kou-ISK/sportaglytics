import { createContext } from 'react';
export interface NativeGroupSurfaceRegistration {
  playerId: string;
  sourceUrl: string;
  canvasId: string;
  presented: (generation: string) => void;
}
export const NativeGroupSurfaceContext = createContext<{
  register: (surface: NativeGroupSurfaceRegistration) => () => void;
} | null>(null);
