import {
  ClipExportTextOptionsView,
  type ClipExportTextOptionsProps,
} from '../../../components/ui/composites/ClipExportTextOptionsView';
import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type {
  ClipExportAngleOption as AngleOption,
  ClipExportMode as ExportMode,
  ClipExportOverlaySettings as OverlaySettings,
  ClipExportScope,
} from '../../../shared/clipExport/clipExportTypes';

export type { AngleOption, ExportMode, OverlaySettings };

type PlaylistExportDialogProps = ClipExportTextOptionsProps & {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exportFileName: string;
  setExportFileName: (value: string) => void;
  exportScope: ClipExportScope;
  setExportScope: (value: ClipExportScope) => void;
  selectedItemCount: number;
  exportMode: ExportMode;
  setExportMode: (value: ExportMode) => void;
  angleOption: AngleOption;
  setAngleOption: (value: AngleOption) => void;
  videoSources: string[];
  selectedAngleIndex: number;
  setSelectedAngleIndex: (value: number) => void;
  overlaySettings: OverlaySettings;
  setOverlaySettings: (
    updater: (prev: OverlaySettings) => OverlaySettings,
  ) => void;
  disableExport: boolean;
};

export const PlaylistExportDialog = ({
  open,
  onClose,
  onExport,
  exportFileName,
  setExportFileName,
  exportScope,
  setExportScope,
  selectedItemCount,
  exportMode,
  setExportMode,
  angleOption,
  setAngleOption,
  videoSources,
  selectedAngleIndex,
  setSelectedAngleIndex,
  overlaySettings,
  setOverlaySettings,
  disableExport,
  overlayChoice,
  onOverlayChoice,
  notePreview,
}: PlaylistExportDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>プレイリストを書き出し</DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gap: 1.5 }}>
        <TextField
          label="ファイル名 (拡張子不要)"
          fullWidth
          size="small"
          value={exportFileName}
          onChange={(event) => setExportFileName(event.target.value)}
        />
        <Stack spacing={1}>
          <Typography variant="body2">書き出し範囲</Typography>
          <RadioGroup
            row
            value={exportScope}
            onChange={(event) =>
              setExportScope(event.target.value as ClipExportScope)
            }
          >
            <FormControlLabel
              value="all"
              control={<Radio size="small" />}
              label="全体"
            />
            <FormControlLabel
              value="selected"
              control={<Radio size="small" />}
              label={`選択中のアイテム (${selectedItemCount} 件)`}
            />
          </RadioGroup>
        </Stack>
        <Divider />
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
        >
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
            出力モード
          </Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            sx={{ '& .MuiToggleButton-root': { whiteSpace: 'nowrap' } }}
            value={exportMode}
            onChange={(_, value) => value && setExportMode(value)}
          >
            <ToggleButton value="single">1ファイル</ToggleButton>
            <ToggleButton value="perInstance">インスタンスごと</ToggleButton>
            <ToggleButton value="perRow">アクションごと</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Stack spacing={2}>
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
          >
            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
              アングル
            </Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={angleOption}
              onChange={(_, value) =>
                value && setAngleOption(value as AngleOption)
              }
            >
              <ToggleButton
                value="allAngles"
                disabled={videoSources.length < 2}
              >
                全アングル
              </ToggleButton>
              <ToggleButton value="single">単一アングル</ToggleButton>
              <ToggleButton value="multi" disabled={videoSources.length < 2}>
                マルチ
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {angleOption === 'single' && (
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              flexWrap="wrap"
              alignItems="center"
            >
              <Typography variant="body2" sx={{ minWidth: 80 }}>
                選択アングル
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={selectedAngleIndex}
                onChange={(_, value) =>
                  value !== null && setSelectedAngleIndex(value)
                }
              >
                {videoSources.map((_, index) => (
                  <ToggleButton key={index} value={index}>
                    アングル{index + 1}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Stack>
          )}
        </Stack>
        <Divider />
        <ClipExportTextOptionsView
          overlayChoice={overlayChoice}
          onOverlayChoice={onOverlayChoice}
          overlaySettings={overlaySettings}
          setOverlaySettings={setOverlaySettings}
          notePreview={notePreview}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={onExport}
          variant="contained"
          disabled={disableExport || overlayChoice === null}
        >
          書き出す
        </Button>
      </DialogActions>
    </Dialog>
  );
};
