import type { ReactElement } from 'react';
export const NativeSurfaceView = ({
  id,
  visible,
}: {
  id: string;
  visible: boolean;
}): ReactElement => (
  <canvas
    id={id}
    width={1920}
    height={1080}
    aria-label="ネイティブ再生映像"
    style={{
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      pointerEvents: 'none',
      visibility: visible ? 'visible' : 'hidden',
    }}
  />
);
