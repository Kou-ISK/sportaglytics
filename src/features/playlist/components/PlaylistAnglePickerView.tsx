import {
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  Radio,
  RadioGroup,
} from '@mui/material';
import type { PlaylistAngle } from '../../../types/playlist/core';

export interface PlaylistAnglePickerViewProps {
  value: PlaylistAngle;
  hasSecondary: boolean;
  onChange: (angle: PlaylistAngle) => void;
}

export const PlaylistAnglePickerView = ({
  value,
  hasSecondary,
  onChange,
}: PlaylistAnglePickerViewProps): React.JSX.Element => (
  <FormControl>
    <FormLabel id="playlist-default-angle-label">既定の映像</FormLabel>
    <RadioGroup
      aria-labelledby="playlist-default-angle-label"
      value={value}
      onChange={(_, next) => {
        if (next === 'angle1' || next === 'angle2') onChange(next);
      }}
    >
      <FormControlLabel
        value="angle1"
        control={<Radio size="small" />}
        label="アングル1"
      />
      <FormControlLabel
        value="angle2"
        control={<Radio size="small" />}
        label="アングル2"
        disabled={!hasSecondary}
      />
    </RadioGroup>
    <FormHelperText sx={{ mx: 0 }}>
      このクリップの再生開始時と「各クリップの既定アングル」での書き出しに使います。
    </FormHelperText>
  </FormControl>
);
