import React from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useActionPreset } from '../../../../../contexts/ActionPresetContext';
import { resolveActionLabelGroups } from '../../../shared/actionLabelGroups';
import type { TimelineData } from '../../../../../types/timeline/core';
import type { SCLabel } from '../../../../../types/timeline/sportscode';
import {
  getLabelsFromTimelineData,
  normalizeLabelGroupName,
} from '../../../../../utils/labelExtractors';
import { useTimelineEditDraft } from './hooks/useTimelineEditDraft';
import { useTimelineValidation } from './hooks/useTimelineValidation';

export interface TimelineEditDraft {
  id: string;
  actionName: string;
  memo: string;
  labels: SCLabel[];
  startTime: string;
  endTime: string;
  originalStartTime: number;
  originalEndTime: number;
}

interface TimelineEditDialogProps {
  draft: TimelineEditDraft | null;
  open: boolean;
  timeline: TimelineData[];
  onChange: (changes: Partial<TimelineEditDraft>) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
}

type EditableLabelGroup = {
  groupName: string;
  options: string[];
};

const addGroupOptions = (
  groups: Map<string, Set<string>>,
  groupName: string | undefined,
  options: readonly string[],
): void => {
  const name = groupName?.trim();
  if (!name) return;
  const existingName =
    Array.from(groups.keys()).find(
      (key) => normalizeLabelGroupName(key) === normalizeLabelGroupName(name),
    ) ?? name;
  const values = groups.get(existingName) ?? new Set<string>();
  options.forEach((option) => {
    const value = option.trim();
    if (value) values.add(value);
  });
  groups.set(existingName, values);
};

const getEditorLabels = (item: TimelineData): SCLabel[] => {
  if (item.labels && item.labels.length > 0) {
    return item.labels;
  }
  return getLabelsFromTimelineData(item);
};

const buildEditableLabelGroups = (
  timeline: TimelineData[],
  draft: TimelineEditDraft | null,
  actionGroups: EditableLabelGroup[],
): EditableLabelGroup[] => {
  const groups = new Map<string, Set<string>>();

  if (draft) {
    draft.labels.forEach((label) =>
      addGroupOptions(groups, label.group, [label.name]),
    );
  }
  timeline.forEach((item) => {
    getEditorLabels(item).forEach((label) =>
      addGroupOptions(groups, label.group, [label.name]),
    );
  });
  actionGroups.forEach((group) =>
    addGroupOptions(groups, group.groupName, group.options),
  );

  return Array.from(groups.entries()).map(([groupName, values]) => ({
    groupName,
    options: Array.from(values).sort((a, b) => a.localeCompare(b)),
  }));
};

export const TimelineEditDialog: React.FC<TimelineEditDialogProps> = ({
  draft,
  open,
  timeline,
  onChange,
  onClose,
  onDelete,
  onSave,
}) => {
  const { activeActions } = useActionPreset();

  const {
    safeStartTime,
    safeEndTime,
    memo,
    setStartTime,
    setEndTime,
    setMemo,
  } = useTimelineEditDraft({ draft, onChange });
  const { startError, endError, isValid } = useTimelineValidation(draft);

  const findActionDefinition = (actionName: string) => {
    const baseAction = actionName.split(' ').slice(1).join(' ');
    return activeActions.find((act) => act.action === baseAction);
  };

  const actionDefinition = draft
    ? findActionDefinition(draft.actionName)
    : undefined;

  const labelGroups = React.useMemo(
    () =>
      buildEditableLabelGroups(
        timeline,
        draft,
        resolveActionLabelGroups(actionDefinition),
      ),
    [actionDefinition, draft, timeline],
  );
  const groupOptions = React.useMemo(
    () => labelGroups.map((group) => group.groupName),
    [labelGroups],
  );
  const [customGroup, setCustomGroup] = React.useState('');
  const [customLabel, setCustomLabel] = React.useState('');

  React.useEffect(() => {
    setCustomGroup('');
    setCustomLabel('');
  }, [draft?.id]);

  if (!draft) {
    return null;
  }

  const getLabelValue = (groupName: string): string => {
    const label = draft.labels.find((l) => l.group === groupName);
    return label?.name || '';
  };

  const handleLabelChange = (groupName: string, value: string) => {
    const updatedLabels = [...draft.labels];
    const existingIndex = updatedLabels.findIndex((l) => l.group === groupName);

    if (value === '') {
      // 空文字の場合はラベルを削除
      if (existingIndex >= 0) {
        updatedLabels.splice(existingIndex, 1);
      }
    } else if (existingIndex >= 0) {
      // 既存のラベルを更新
      updatedLabels[existingIndex] = { name: value, group: groupName };
    } else {
      // 新しいラベルを追加
      updatedLabels.push({ name: value, group: groupName });
    }

    onChange({ labels: updatedLabels });
  };

  const handleAddCustomLabel = () => {
    const groupName = customGroup.trim();
    const value = customLabel.trim();
    if (!groupName || !value) return;
    handleLabelChange(groupName, value);
    setCustomLabel('');
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          position: 'fixed',
          bottom: 80,
          top: 'auto',
          m: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>アクション編集</DialogTitle>
      <DialogContent sx={{ py: 1.5 }}>
        <Stack spacing={1.5} sx={{ mt: 0.5 }}>
          <Stack direction="row" spacing={1}>
            <TextField
              label="開始秒"
              type="number"
              value={safeStartTime}
              onChange={(event) => setStartTime(event.target.value)}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: 0.1 }}
              error={Boolean(startError)}
              helperText={startError}
            />
            <TextField
              label="終了秒"
              type="number"
              value={safeEndTime}
              onChange={(event) => setEndTime(event.target.value)}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: 0.1 }}
              error={Boolean(endError)}
              helperText={endError}
            />
          </Stack>

          <Stack spacing={1}>
            {labelGroups.map((group) => {
              const selectedValue = getLabelValue(group.groupName);
              const options = selectedValue
                ? Array.from(new Set([selectedValue, ...group.options]))
                : group.options;
              return (
                <Box key={group.groupName}>
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 0.5,
                      color: 'text.secondary',
                      fontWeight: 700,
                    }}
                  >
                    {group.groupName}
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    <Button
                      size="small"
                      variant={!selectedValue ? 'contained' : 'outlined'}
                      color={!selectedValue ? 'inherit' : 'primary'}
                      onClick={() => handleLabelChange(group.groupName, '')}
                      sx={{ minWidth: 56, px: 1, py: 0.25 }}
                    >
                      なし
                    </Button>
                    {options.map((option) => (
                      <Button
                        key={option}
                        size="small"
                        variant={selectedValue === option ? 'contained' : 'outlined'}
                        onClick={() => handleLabelChange(group.groupName, option)}
                        sx={{
                          minWidth: 72,
                          px: 1,
                          py: 0.25,
                          justifyContent: 'center',
                        }}
                      >
                        {option}
                      </Button>
                    ))}
                  </Box>
                </Box>
              );
            })}

            <Stack direction="row" spacing={1} alignItems="center">
              <Autocomplete
                freeSolo
                options={groupOptions}
                value={customGroup}
                onInputChange={(_, value) => setCustomGroup(value)}
                onChange={(_, value) => setCustomGroup(value ?? '')}
                sx={{ flex: 1 }}
                renderInput={(params) => (
                  <TextField {...params} label="グループ" size="small" />
                )}
              />
              <TextField
                label="ラベル"
                value={customLabel}
                onChange={(event) => setCustomLabel(event.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <Button
                variant="outlined"
                onClick={handleAddCustomLabel}
                disabled={!customGroup.trim() || !customLabel.trim()}
              >
                追加
              </Button>
            </Stack>
          </Stack>

          <TextField
            label="メモ"
            type="text"
            fullWidth
            size="small"
            variant="outlined"
            multiline
            rows={2}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="任意のメモ"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="error" onClick={onDelete} disabled={!draft.id}>
          削除
        </Button>
        <Button onClick={onClose}>キャンセル</Button>
        <Button onClick={onSave} variant="contained" disabled={!isValid}>
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
};
