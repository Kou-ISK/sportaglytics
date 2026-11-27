import {
  ClipExportTextOptionsView,
  type ClipExportTextOptionsProps,
} from '../../../components/ui/composites/ClipExportTextOptionsView';
import React from 'react';
import {
  Button,
  Checkbox,
  FormControl,
  FormLabel,
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

import type { PlaylistExportContent } from '../domain/playlistExportContent';

export type { AngleOption, ExportMode, OverlaySettings };

const exportModes: ReadonlyArray<{ value: ExportMode; label: string; detail: string }> = [
  { value: 'single', label: '1ファイル', detail: '再生順に1本へ結合' },
  { value: 'perInstance', label: 'インスタンスごと', detail: '各クリップ・スライドを別々に' },
  { value: 'perRow', label: 'アクションごと', detail: '同じアクション名でまとめる' },
  { value: 'organizerRows', label: 'Organizerの行ごと', detail: '作成したテーマ行でまとめる' },
];

type PlaylistExportDialogProps = ClipExportTextOptionsProps & {
  open: boolean;
  onClose: () => void;
  onExport: () => void;
  exportFileName: string;
  setExportFileName: (value: string) => void;
  exportScope: ClipExportScope;
  setExportScope: (value: ClipExportScope) => void;
  selectedItemCount: number;
  content: PlaylistExportContent;
  setContent: React.Dispatch<React.SetStateAction<PlaylistExportContent>>;
  availableSlideCount: number;
  hasVideo: boolean;
  outputItemCount: number;
  rowSummary?: { id: string; name: string; count: number; hasVideo?: boolean }[];
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
  rowSummary = [],
  content,
  setContent,
  availableSlideCount,
  hasVideo,
  outputItemCount,
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
  textPreview,
}: PlaylistExportDialogProps): React.ReactElement => {
  const titleId = React.useId();
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" aria-labelledby={titleId}>
      <DialogTitle id={titleId}>プレイリストのMP4書き出し</DialogTitle>
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
        <FormControl component="fieldset">
          <FormLabel component="legend">出力モード</FormLabel>
          <RadioGroup
            aria-label="出力モード"
            sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 166px), 1fr))', gap: 0.5 }}
            value={exportMode}
            onChange={(_, value) => {
              const option = exportModes.find((mode) => mode.value === value);
              if (option) setExportMode(option.value);
            }}
          >
            {exportModes.map(({ value, label, detail }) => (
              <FormControlLabel
                key={value}
                value={value}
                control={<Radio size="small" />}
                sx={{ m: 0, minWidth: 0, minHeight: 44 }}
                label={<><Typography variant="body2" component="span" display="block">{label}</Typography>
                  <Typography variant="caption" color="text.secondary" component="span">{detail}</Typography></>}
              />
            ))}
          </RadioGroup>
        </FormControl>
        {exportMode === 'organizerRows' && (
          <Stack spacing={0.5} aria-label="行別の書き出し予定">
            <Typography variant="subtitle2">
              出力 {rowSummary.reduce((sum, row) => sum +
                (row.hasVideo !== false && hasVideo && angleOption === 'allAngles'
                  ? videoSources.filter((source) => source.trim()).length : 1), 0)} 本
            </Typography>
            {rowSummary.map((row, index) => (
              <Typography key={row.id} variant="body2">{index + 1}. {row.name} · {row.count} 件</Typography>
            ))}
            {!rowSummary.length && <Typography variant="body2">対象行がありません</Typography>}
          </Stack>
        )}
        {hasVideo && <Stack spacing={2}>
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
              sx={{
                flexWrap: 'wrap',
                '& .MuiToggleButton-root': { minWidth: 0, whiteSpace: 'normal' },
              }}
              onChange={(_, value) =>
                value && setAngleOption(value as AngleOption)
              }
            >
              <ToggleButton value="defaultAngles">
                各クリップの既定アングル
              </ToggleButton>
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
          {angleOption === 'defaultAngles' && (
            <Typography variant="body2" color="text.secondary">
              クリップ詳細で設定したアングルを使い、再生順に書き出します。「1ファイル」なら異なるアングルも1本の映像にまとまります。
            </Typography>
          )}
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
        </Stack>}
        <Divider />
        <Stack spacing={1}>
          <Typography variant="subtitle2">MP4に含める内容</Typography>
          <FormControlLabel
            label="エフェクト（Paint・フリーズ・クロマキー）"
            control={<Checkbox
              size="small"
              checked={content.includeEffects}
              disabled={!hasVideo}
              onChange={(_, checked) => setContent((previous) => ({ ...previous, includeEffects: checked }))}
            />}
          />
          <FormControlLabel
            label={`スライド・タイトル（${availableSlideCount}件）`}
            control={<Checkbox
              size="small"
              checked={content.includeSlides}
              disabled={availableSlideCount === 0}
              onChange={(_, checked) => setContent((previous) => ({ ...previous, includeSlides: checked }))}
            />}
          />
          {content.includeSlides && availableSlideCount > 0 && <Typography variant="caption" color="text.secondary">
            各スライドは設定した秒数だけ表示します。映像と同じMP4に収める場合は1280×720・30 fpsです。
          </Typography>}
          {hasVideo && <ClipExportTextOptionsView
            overlayChoice={overlayChoice}
            onOverlayChoice={onOverlayChoice}
            overlaySettings={overlaySettings}
            setOverlaySettings={setOverlaySettings}
            notePreview={notePreview}
            textPreview={textPreview}
            prompt="インスタンステキスト（映像に焼き込む文字）"
            instructions="書き出すたびに選択してください。入れる場合は再エンコードします。"
          />}
          {outputItemCount === 0 && <Typography variant="body2" role="status">
            {availableSlideCount > 0
              ? 'スライドを除外したため、書き出すアイテムがありません。'
              : '書き出すアイテムがありません。'}
          </Typography>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
        <Button
          onClick={onExport}
          variant="contained"
          disabled={
            disableExport || outputItemCount === 0 ||
            (hasVideo && (overlayChoice === null || textPreview?.blocked)) ||
            (exportMode === 'organizerRows' && !rowSummary.length)
          }
        >
          書き出す
        </Button>
      </DialogActions>
    </Dialog>
  );
};
