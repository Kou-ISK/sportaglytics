import { PlaylistScrubSlider } from '../components/PlaylistScrubSlider';
import { studioControlLayout } from './studioControlLayout';
import { mediaChromeSx } from '../../../design-system/mediaChrome';
import type { ReactElement } from 'react';
import {
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { MovieTransportView } from '../../../components/ui';

export interface StudioTransportViewProps {
  scrubOwnerKey?: string;
  coachMode?: boolean;
  onCoachModeChange?: (value: boolean) => void;
  time: number;
  min: number;
  max: number;
  playing: boolean;
  disabled: boolean;
  freezeDuration: number;
  onSeek: (time: number) => void;
  onScrub?: (time: number, final: boolean) => void;
  onTogglePlay: () => void;
  onFreezeDurationChange: (duration: number) => void;
}
export const StudioTransportView = (
  props: StudioTransportViewProps,
): ReactElement => (
  <Stack
    spacing={1}
    sx={[
      mediaChromeSx,
      studioControlLayout,
      {
        m: 0.75,
        px: 1,
        py: 0.5,
        borderTop: 1,
        borderColor: 'divider',
        flexShrink: 0,
      },
    ]}
  >
    {props.coachMode && (
      <PlaylistScrubSlider
        key={props.scrubOwnerKey}
        aria-label="Paint 再生位置"
        min={props.min}
        max={Math.max(props.min + 0.001, props.max)}
        time={props.time}
        disabled={props.disabled}
        onPreview={(_, time) =>
          props.onScrub ? props.onScrub(time, false) : props.onSeek(time)
        }
        onCommit={(time) =>
          props.onScrub ? props.onScrub(time, true) : props.onSeek(time)
        }
      />
    )}
    <Stack
      direction="row"
      alignItems="center"
      useFlexGap
      spacing={1}
      sx={{ flexWrap: 'wrap', rowGap: 1 }}
    >
      {props.onCoachModeChange && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={props.coachMode ? 'coach' : 'edit'}
          aria-label="Paint 表示モード"
          onChange={(_, value: string | null) => {
            if (value) props.onCoachModeChange?.(value === 'coach');
          }}
        >
          <ToggleButton
            value="edit"
            title="描画の形・時間・追尾を細かく編集します。"
          >
            編集
          </ToggleButton>
          <ToggleButton
            value="coach"
            title="映像を見せながら簡単に描画。詳細設定と時間軸を隠します。"
          >
            プレゼン
          </ToggleButton>
        </ToggleButtonGroup>
      )}
      <Typography variant="technical" sx={{ minWidth: 116 }}>
        {props.time.toFixed(2)} / {props.max.toFixed(2)} s
      </Typography>
      <Stack direction="row" justifyContent="center" sx={{ flex: 1 }}>
        <MovieTransportView
          playing={props.playing}
          disabled={props.disabled}
          onTogglePlay={props.onTogglePlay}
          backwardLabel="0.1秒戻る"
          forwardLabel="0.1秒進む"
          onBackward={() => props.onSeek(Math.max(props.min, props.time - 0.1))}
          onForward={() => props.onSeek(Math.min(props.max, props.time + 0.1))}
          outerBackward={{
            label: 'クリップの先頭',
            onClick: () => props.onSeek(props.min),
          }}
          outerForward={{
            label: 'クリップの末尾',
            onClick: () => props.onSeek(props.max),
          }}
        />
      </Stack>
      <TextField
        hiddenLabel
        type="number"
        size="small"
        value={props.freezeDuration}
        disabled={props.disabled || props.playing}
        onChange={(event) => {
          const value = Number(event.target.value);
          if (Number.isFinite(value) && value >= 1 && value <= 60)
            props.onFreezeDurationChange(value);
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">静止</InputAdornment>
            ),
            endAdornment: <InputAdornment position="end">s</InputAdornment>,
          },
          htmlInput: {
            min: 1,
            max: 60,
            step: 0.5,
            'aria-label': '静止時間（秒）',
            title: '静止時間（秒）',
          },
        }}
        sx={{
          width: 120,
          '& .MuiInputBase-root': {
            height: 30,
            bgcolor: (theme) => theme.custom.tokens.media.hover,
          },
        }}
      />
    </Stack>
  </Stack>
);
