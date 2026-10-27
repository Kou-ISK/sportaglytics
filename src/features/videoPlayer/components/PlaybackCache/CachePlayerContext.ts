import { createContext } from 'react';
import type { CachePlayerPort } from './cachePlayerSwitch';
export interface CachePlayerRegistration {
  source: string;
  port: CachePlayerPort;
  suppressMetadata: (suppress: boolean) => void;
}
export const CachePlayerContext = createContext<{
  register: (registration: CachePlayerRegistration) => () => void;
} | null>(null);
