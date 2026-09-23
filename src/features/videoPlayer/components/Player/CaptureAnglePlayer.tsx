import { Alert, Box } from '@mui/material';
import type { ReactElement } from 'react';
import type { PackageMediaAngle } from '../../../../types/package/media';
import { useCaptureMediaSource } from '../../shared/capture/useCaptureMediaSource';
import type { SingleVideoPlayerProps } from './SingleVideo/types';
import { MemoizedSingleVideoPlayer } from './SingleVideoPlayer';

const ignoreDuration = (): void => undefined;

/** Keeps the source and decoder alive as new recording fragments arrive. */
export const CaptureAnglePlayer = ({
  angle,
  angleTime,
  ...props
}: SingleVideoPlayerProps & {
  angle: PackageMediaAngle;
  angleTime: number;
}): ReactElement => {
  const { source, failed } = useCaptureMediaSource(angle, angleTime);
  return (
    <>
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          visibility: props.videoSrc ? 'visible' : 'hidden',
        }}
      >
        {(source || props.videoSrc) && (
          <MemoizedSingleVideoPlayer
            {...props}
            videoSrc={source || props.videoSrc}
            timelineTimeSeconds={source ? angleTime : props.timelineTimeSeconds}
            isVideoPlaying={props.isVideoPlaying && Boolean(props.videoSrc)}
            setMaxSec={source ? ignoreDuration : props.setMaxSec}
          />
        )}
      </Box>
      {failed && (
        <Alert
          severity="warning"
          sx={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}
        >
          連続再生を利用できないため、区間ごとの再生に切り替えました。
        </Alert>
      )}
    </>
  );
};
