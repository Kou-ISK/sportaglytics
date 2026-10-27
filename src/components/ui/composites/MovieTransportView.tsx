import type { ReactElement, ReactNode } from 'react';
import { IconButton, Stack, Tooltip } from '@mui/material';
import Pause from '@mui/icons-material/Pause';
import PlayArrow from '@mui/icons-material/PlayArrow';
import SkipPrevious from '@mui/icons-material/SkipPrevious';
import SkipNext from '@mui/icons-material/SkipNext';
import FastRewind from '@mui/icons-material/FastRewind';
import FastForward from '@mui/icons-material/FastForward';

export interface MovieTransportViewProps {
  playing: boolean;
  disabled?: boolean;
  onTogglePlay: () => void;
  onBackward: () => void;
  onForward: () => void;
  backwardLabel: string;
  forwardLabel: string;
  outerBackward?: { label: string; onClick: () => void };
  outerForward?: { label: string; onClick: () => void };
}
/** 再生状態を持たない Hudl Sportscode 12系を参照したフラットな再生操作部。 */
export const MovieTransportView = (
  props: MovieTransportViewProps,
): ReactElement => {
  const control = (
    label: string,
    onClick: () => void,
    icon: ReactNode,
  ): ReactElement => (
    <Tooltip title={label}>
      <span>
        <IconButton
          aria-label={label}
          disabled={props.disabled}
          onClick={onClick}
          size="small"
          sx={{
            width: 30,
            height: 30,
            p: 0.5,
            borderRadius: 0,
            color: (theme) => theme.custom.tokens.media.muted,
            '&:hover': { bgcolor: (theme) => theme.custom.tokens.media.hover },
          }}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
  return (
    <Stack
      direction="row"
      alignItems="center"
      role="group"
      aria-label="映像再生操作"
      sx={{
        flexShrink: 0,
        bgcolor: 'transparent',
      }}
    >
      {props.outerBackward &&
        control(
          props.outerBackward.label,
          props.outerBackward.onClick,
          <SkipPrevious fontSize="small" />,
        )}
      {control(
        props.backwardLabel,
        props.onBackward,
        <FastRewind sx={{ fontSize: 18 }} />,
      )}
      <Tooltip title={props.playing ? '一時停止' : '再生'}>
        <span>
          <IconButton
            aria-label={props.playing ? '一時停止' : '再生'}
            disabled={props.disabled}
            onClick={props.onTogglePlay}
            sx={{
              width: 32,
              height: 30,
              borderRadius: 0,
              color: (theme) => theme.custom.tokens.media.foreground,
            }}
          >
            {props.playing ? <Pause fontSize="small" /> : <PlayArrow />}
          </IconButton>
        </span>
      </Tooltip>
      {control(
        props.forwardLabel,
        props.onForward,
        <FastForward sx={{ fontSize: 18 }} />,
      )}
      {props.outerForward &&
        control(
          props.outerForward.label,
          props.outerForward.onClick,
          <SkipNext fontSize="small" />,
        )}
    </Stack>
  );
};
