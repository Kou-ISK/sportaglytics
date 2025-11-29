import React from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useActionPreset } from '../../../../../contexts/ActionPresetContext';
import type { SCLabel } from '../../../../../types/SCTimeline';
import { useTimelineEditDraft } from './hooks/useTimelineEditDraft';
import { useTimelineValidation } from './hooks/useTimelineValidation';

export interface TimelineEditDraft {
  id: string;
  actionName: string;
  qualifier: string;
  labels: SCLabel[];
  startTime: string;
  endTime: string;
  originalStartTime: number;
  originalEndTime: number;
}

interface TimelineEditDialogProps {
  draft: TimelineEditDraft | null;
  open: boolean;
  onChange: (changes: Partial<TimelineEditDraft>) => void;
  onClose: () => void;
  onDelete: () => void;
  onSave: () => void;
}

export const TimelineEditDialog: React.FC<TimelineEditDialogProps> = ({
  draft,
  open,
  onChange,
  onClose,
  onDelete,
  onSave,
}) => {
  const { activeActions } = useActionPreset();

  const { safeStartTime, safeEndTime, qualifier, setStartTime, setEndTime, setQualifier } =
    useTimelineEditDraft({ draft, onChange });
  const { startError, endError, isValid } = useTimelineValidation(draft);

  const findActionDefinition = (actionName: string) => {
    const baseAction = actionName.split(' ').slice(1).join(' ');
    return activeActions.find((act) => act.action === baseAction);
  };

  const actionDefinition = draft
    ? findActionDefinition(draft.actionName)
    : undefined;

  // アクション定義からラベルグループを取得
  // 新しいgroups構造を優先し、なければ旧来のtypes/resultsから生成
  const labelGroups = React.useMemo(() => {
    if (actionDefinition?.groups && actionDefinition.groups.length > 0) {
      return actionDefinition.groups;
    }
    // 後方互換性: types/resultsから生成
    const legacyGroups = [];
    if (actionDefinition?.types && actionDefinition.types.length > 0) {
      legacyGroups.push({
        groupName: 'actionType',
        options: actionDefinition.types,
      });
    }
    if (actionDefinition?.results && actionDefinition.results.length > 0) {
      legacyGroups.push({
        groupName: 'actionResult',
        options: actionDefinition.results,
      });
    }
    return legacyGroups;
  }, [actionDefinition]);

  if (!draft) {
    return null;
  }

  // 特定のグループのラベル値を取得
  const getLabelValue = (groupName: string): string => {
    const label = draft.labels.find((l) => l.group === groupName);
    return label?.name || '';
  };

  // ラベル値を更新
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
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

          {labelGroups.length > 0 ? (
            <>
              {labelGroups.map((group) => (
                <FormControl key={group.groupName} fullWidth size="small">
                  <InputLabel>{group.groupName}</InputLabel>
                  <Select
                    value={getLabelValue(group.groupName)}
                    label={group.groupName}
                    onChange={(event) =>
                      handleLabelChange(group.groupName, event.target.value)
                    }
                  >
                    <MenuItem value="">
                      <em>なし</em>
                    </MenuItem>
                    {group.options.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">
              このアクションには追加のラベルがありません
            </Typography>
          )}

          <TextField
            label="メモ"
            type="text"
            fullWidth
            size="small"
            variant="outlined"
            multiline
            rows={2}
            value={qualifier}
            onChange={(event) => setQualifier(event.target.value)}
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
