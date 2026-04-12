import { useCallback, useState } from 'react';
import type { VideoPlayerError } from '../../../../types/video/error';

interface UseVideoPlayerErrorsReturn {
  error: VideoPlayerError | null;
  setError: (value: VideoPlayerError | null) => void;
  clearError: () => void;
}

export const useVideoPlayerErrors = (): UseVideoPlayerErrorsReturn => {
  const [error, setErrorState] = useState<VideoPlayerError | null>(null);

  const setError = useCallback((value: VideoPlayerError | null) => {
    setErrorState(value);
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  return { error, setError, clearError };
};
