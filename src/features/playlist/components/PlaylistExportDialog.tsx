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

type ExportScope = 'all' | 'selected';
export type ExportMode = 'single' | 'perInstance' | 'perRow';
export type AngleOption = 'allAngles' | 'single' | 'multi';

export type OverlaySettings = {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
};

type PlaylistExportDialogProps = {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exportFileName: string;
  setExportFileName: (value: string) => void;
  exportScope: ExportScope;
  setExportScope: (value: ExportScope) => void;
  selectedItemCount: number;
  exportMode: ExportMode;
  setExportMode: (value: ExportMode) => void;
  angleOption: AngleOption;
  setAngleOption: (value: AngleOption) => void;
  videoSources: string[];
  selectedAngleIndex: number;
  setSelectedAngleIndex: (value: number) => void;
  overlaySettings: OverlaySettings;
  setOverlaySettings: (updater: (prev: OverlaySettings) => OverlaySettings) => void;
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
}: PlaylistExportDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>プレイリストを書き出し</DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 1.5, pt: 1 }}>
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
            value={exportScope}
            onChange={(event) =>
              setExportScope(event.target.value as ExportScope)
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
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">出力モード</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={exportMode}
            onChange={(_, value) => value && setExportMode(value)}
          >
            <ToggleButton value="single">1ファイル</ToggleButton>
            <ToggleButton value="perInstance">インスタンスごと</ToggleButton>
            <ToggleButton value="perRow">アクションごと</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2">アングル</Typography>
            <ToggleButtonGroup
              exclusive
              size="small"
              value={angleOption}
              onChange={(_, value) =>
                value && setAngleOption(value as AngleOption)
              }
            >
              <ToggleButton value="allAngles" disabled={videoSources.length < 2}>
                全アングル
              </ToggleButton>
              <ToggleButton value="single">単一アングル</ToggleButton>
              <ToggleButton value="multi" disabled={videoSources.length < 2}>
                マルチ
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          {angleOption === 'single' && (
            <Stack direction="row" spacing={1} alignItems="center" pl={2}>
              <Typography variant="body2" sx={{ minWidth: 80 }}>
                選択アングル
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={selectedAngleIndex}
                onChange={(_, value) => value !== null && setSelectedAngleIndex(value)}
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
        <Stack spacing={1}>
          <Typography variant="body2">オーバーレイ</Typography>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={overlaySettings.enabled ? 'on' : 'off'}
            onChange={(_, value) =>
              setOverlaySettings((prev) => ({
                ...prev,
                enabled: value === 'on',
              }))
            }
          >
            <ToggleButton value="on">表示</ToggleButton>
            <ToggleButton value="off">非表示</ToggleButton>
          </ToggleButtonGroup>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Button
              size="small"
              variant={overlaySettings.showActionName ? 'contained' : 'outlined'}
              onClick={() =>
                setOverlaySettings((prev) => ({
                  ...prev,
                  showActionName: !prev.showActionName,
                }))
              }
            >
              アクション名
            </Button>
            <Button
              size="small"
              variant={overlaySettings.showActionIndex ? 'contained' : 'outlined'}
              onClick={() =>
                setOverlaySettings((prev) => ({
                  ...prev,
                  showActionIndex: !prev.showActionIndex,
                }))
              }
            >
              通番
            </Button>
            <Button
              size="small"
              variant={overlaySettings.showLabels ? 'contained' : 'outlined'}
              onClick={() =>
                setOverlaySettings((prev) => ({
                  ...prev,
                  showLabels: !prev.showLabels,
                }))
              }
            >
              ラベル
            </Button>
            <Button
              size="small"
              variant={overlaySettings.showMemo ? 'contained' : 'outlined'}
              onClick={() =>
                setOverlaySettings((prev) => ({
                  ...prev,
                  showMemo: !prev.showMemo,
                }))
              }
            >
              メモ
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
            形式: 1行目=通番+アクション名（太字）、2行目=ラベル、3行目=メモ
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={onExport} variant="contained" disabled={disableExport}>
          書き出す
        </Button>
      </DialogActions>
    </Dialog>
  );
};
