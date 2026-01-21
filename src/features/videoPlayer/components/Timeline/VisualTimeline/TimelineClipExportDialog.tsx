import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from '@mui/material';

type ExportScope = 'selected' | 'all';

type TimelineClipExportDialogProps = {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exportScope: ExportScope;
  setExportScope: (value: ExportScope) => void;
  selectedCount: number;
  exportMode: 'single' | 'perInstance' | 'perRow';
  setExportMode: (value: 'single' | 'perInstance' | 'perRow') => void;
  exportFileName: string;
  setExportFileName: (value: string) => void;
  angleOption: 'allAngles' | 'single' | 'multi';
  setAngleOption: (value: 'allAngles' | 'single' | 'multi') => void;
  selectedAngleIndex: number;
  setSelectedAngleIndex: (value: number) => void;
  videoSources?: string[];
  primarySource?: string;
  secondarySource?: string;
  setPrimarySource: (value: string) => void;
  setSecondarySource: (value: string) => void;
};

const renderSourceLabel = (src: string) => {
  const parts = src.split(/[/\\]/);
  const name = parts.pop() || src;
  const parent = parts.pop();
  return parent ? `${parent}/${name}` : name;
};

export const TimelineClipExportDialog = ({
  open,
  onClose,
  onExport,
  exportScope,
  setExportScope,
  selectedCount,
  exportMode,
  setExportMode,
  exportFileName,
  setExportFileName,
  angleOption,
  setAngleOption,
  selectedAngleIndex,
  setSelectedAngleIndex,
  videoSources,
  primarySource,
  secondarySource,
  setPrimarySource,
  setSecondarySource,
}: TimelineClipExportDialogProps) => {
  const sources = videoSources || [];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>クリップ書き出し</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          書き出し対象と出力モードを選択してください。オーバーレイは設定画面の値を使用します。
        </Typography>
        <Typography variant="subtitle2">Exporting:</Typography>
        <RadioGroup
          value={exportScope}
          onChange={(event) =>
            setExportScope(event.target.value === 'selected' ? 'selected' : 'all')
          }
        >
          <FormControlLabel value="all" control={<Radio />} label="全体" />
          <FormControlLabel
            value="selected"
            control={<Radio />}
            label={`選択インスタンス (${selectedCount} 件)`}
          />
        </RadioGroup>

        <Typography variant="subtitle2">Export As:</Typography>
        <Select
          size="small"
          value={exportMode}
          onChange={(event) =>
            setExportMode(event.target.value as 'single' | 'perInstance' | 'perRow')
          }
        >
          <MenuItem value="single">単一映像ファイル（連結）</MenuItem>
          <MenuItem value="perInstance">インスタンスごとに出力</MenuItem>
          <MenuItem value="perRow">行ごとに出力</MenuItem>
        </Select>
        <TextField
          label="ファイル名（連結時）/ プレフィックス"
          size="small"
          placeholder="例: combined_export"
          value={exportFileName}
          onChange={(event) => setExportFileName(event.target.value)}
          helperText="単一出力ではこの名前で保存。行/インスタンス出力では先頭に付与します（拡張子は自動で .mp4）。"
        />

        <Typography variant="subtitle2">Video Angles:</Typography>
        <RadioGroup
          row
          value={angleOption}
          onChange={(event) =>
            setAngleOption(event.target.value as 'allAngles' | 'single' | 'multi')
          }
        >
          <FormControlLabel
            value="allAngles"
            control={<Radio />}
            label="全アングル"
            disabled={!sources.length || sources.length < 2}
          />
          <FormControlLabel value="single" control={<Radio />} label="単一アングル" />
          <FormControlLabel
            value="multi"
            control={<Radio />}
            label="マルチ"
            disabled={!sources.length || sources.length < 2}
          />
        </RadioGroup>
        {angleOption === 'single' && (
          <RadioGroup
            row
            value={selectedAngleIndex}
            onChange={(event) => setSelectedAngleIndex(Number(event.target.value))}
          >
            {sources.map((_, index) => (
              <FormControlLabel
                key={index}
                value={index}
                control={<Radio />}
                label={`アングル${index + 1}`}
              />
            ))}
          </RadioGroup>
        )}
        {angleOption === 'multi' && (
          <>
            <TextField
              select
              SelectProps={{ native: true }}
              label="メイン映像"
              value={primarySource || ''}
              onChange={(event) => setPrimarySource(event.target.value)}
              size="small"
            >
              {sources.map((src) => (
                <option key={src} value={src}>
                  {renderSourceLabel(src)}
                </option>
              ))}
            </TextField>
            <TextField
              select
              SelectProps={{ native: true }}
              label="サブ映像（横並び）"
              value={secondarySource || ''}
              onChange={(event) => setSecondarySource(event.target.value)}
              size="small"
            >
              {sources.map((src) => (
                <option key={src} value={src}>
                  {renderSourceLabel(src)}
                </option>
              ))}
            </TextField>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button variant="contained" onClick={onExport}>
          書き出し
        </Button>
      </DialogActions>
    </Dialog>
  );
};
