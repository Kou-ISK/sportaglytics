import type { ReactElement } from 'react';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import type { ClipExportOverlaySettings } from '../../../shared/clipExport/clipExportTypes';

export interface ClipExportTextOptionsProps {
  overlayChoice: boolean | null;
  onOverlayChoice: (enabled: boolean) => void;
  overlaySettings: ClipExportOverlaySettings;
  setOverlaySettings: (
    update: (previous: ClipExportOverlaySettings) => ClipExportOverlaySettings,
  ) => void;
  notePreview?: string;
}

export const ClipExportTextOptionsView = ({
  overlayChoice,
  onOverlayChoice,
  overlaySettings,
  setOverlaySettings,
  notePreview,
}: ClipExportTextOptionsProps): ReactElement => (
  <Stack spacing={1}>
    <FormControl component="fieldset" required>
      <FormLabel component="legend">
        今回の映像にオーバーレイテキストを含めますか？
      </FormLabel>
      <RadioGroup
        row
        aria-label="オーバーレイテキスト"
        value={
          overlayChoice === null ? '' : overlayChoice ? 'include' : 'exclude'
        }
        onChange={(_, value) => onOverlayChoice(value === 'include')}
      >
        <FormControlLabel
          value="include"
          control={<Radio size="small" />}
          label="含める"
        />
        <FormControlLabel
          value="exclude"
          control={<Radio size="small" />}
          label="含めない"
        />
      </RadioGroup>
    </FormControl>
    {overlayChoice === true && (
      <>
        <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5}>
          {(
            [
              ['showActionName', 'アクション名'],
              ['showActionIndex', '通番'],
              ['showLabels', 'ラベル'],
              ['showMemo', 'ノート'],
            ] as const
          ).map(([key, label]) => (
            <FormControlLabel
              key={key}
              label={label}
              control={
                <Checkbox
                  size="small"
                  checked={overlaySettings[key]}
                  onChange={(_, checked) =>
                    setOverlaySettings((previous) => ({
                      ...previous,
                      [key]: checked,
                    }))
                  }
                />
              }
            />
          ))}
        </Stack>
        {overlaySettings.showMemo && notePreview !== undefined && (
          <Typography
            variant="body2"
            sx={{
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              maxHeight: 120,
              overflow: 'auto',
              p: 1,
              bgcolor: 'action.hover',
            }}
          >
            {notePreview || '対象クリップにノートはありません。'}
          </Typography>
        )}
      </>
    )}
    <Typography variant="caption" color="text.secondary">
      書き出すたびに選択してください。含めない場合もPaintの描画とフリーズは出力します。
      テキストを含める場合は再エンコードします。
    </Typography>
  </Stack>
);
