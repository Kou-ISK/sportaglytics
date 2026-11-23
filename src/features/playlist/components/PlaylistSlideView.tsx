import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Alert, Box } from '@mui/material';
import type { PlaylistSlide } from '../../../types/playlist/core';
import { renderSlideFrame } from '../utils/slideCanvas';

export const PlaylistSlideView = ({ slide }: { slide: PlaylistSlide }): ReactElement => {
  const [result, setResult] = useState<{ slide: PlaylistSlide; frame?: string; error?: string }>();
  useEffect(() => {
    let current = true;
    void renderSlideFrame(slide).then(
      (frame) => { if (current) setResult({ slide, frame }); },
      () => { if (current) setResult({ slide, error: 'スライドを表示できません。' }); },
    );
    return () => { current = false; };
  }, [slide]);
  if (result?.slide === slide && result.error) return <Alert severity="error">{result.error}</Alert>;
  return <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}>
    {result?.slide === slide && result.frame &&
      <Box component="img" alt={slide.title} src={result.frame}
        sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
  </Box>;
};
