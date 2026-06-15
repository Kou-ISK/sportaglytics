import { useCallback } from 'react';
import {
  getVideoJsPlayer,
  type VideoJsPlayerHandle,
} from '../../../../shared/videojs/videoJsAdapter';

export type GetExistingVideoJsPlayer = (
  id: string,
) => VideoJsPlayerHandle | undefined;

export const useExistingVideoJsPlayer = (): GetExistingVideoJsPlayer =>
  useCallback((id: string) => {
    try {
      return getVideoJsPlayer(id);
    } catch (error) {
      console.debug('getExistingPlayer error', error);
      return undefined;
    }
  }, []);
