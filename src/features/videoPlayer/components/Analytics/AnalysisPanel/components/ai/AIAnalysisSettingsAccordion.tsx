import React from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { AIAnalysisSettings } from '../../../../../../../types/Settings';

interface AvailableModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
}

interface AIAnalysisSettingsAccordionProps {
  accordionSx: {
    borderRadius: number;
    border: string;
    borderColor: string;
    boxShadow: string;
    '&:before': { display: string };
    '&.Mui-expanded': { mt: number };
  };
  isSettingsAccordionOpen: boolean;
  onSettingsAccordionChange: (expanded: boolean) => void;
  modelSummary: string;
  showAiSettings: boolean;
  onToggleShowAiSettings: () => void;
  aiSettings: AIAnalysisSettings;
  onAiSettingsChange: (next: AIAnalysisSettings) => void;
  modelsStatus: 'idle' | 'loading' | 'done' | 'error';
  availableModels: AvailableModelInfo[];
  isAutoModel: boolean;
  recommendedModel: AvailableModelInfo | null;
  modelsError: string | null;
  availableGroups: string[];
  onSaveSettings: () => void;
  settingsMessage: string | null;
  formatBytes: (value: number) => string;
}

export const AIAnalysisSettingsAccordion = ({
  accordionSx,
  isSettingsAccordionOpen,
  onSettingsAccordionChange,
  modelSummary,
  showAiSettings,
  onToggleShowAiSettings,
  aiSettings,
  onAiSettingsChange,
  modelsStatus,
  availableModels,
  isAutoModel,
  recommendedModel,
  modelsError,
  availableGroups,
  onSaveSettings,
  settingsMessage,
  formatBytes,
}: AIAnalysisSettingsAccordionProps) => {
  return (
    <Accordion
      disableGutters
      expanded={isSettingsAccordionOpen}
      onChange={(_event, expanded) => onSettingsAccordionChange(expanded)}
      sx={accordionSx}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          AI設定
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            ローカルLLMの接続先とディメンション定義を設定します。
          </Typography>
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography variant="body2" color="text.secondary">
              現在のモデル: {modelSummary}
            </Typography>
            <Button size="small" variant="text" onClick={onToggleShowAiSettings}>
              {showAiSettings ? '設定を閉じる' : '設定を開く'}
            </Button>
          </Box>
          <Collapse in={showAiSettings}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="モデルファイル"
                  value={aiSettings.model}
                  onChange={(event) =>
                    onAiSettingsChange({
                      ...aiSettings,
                      model: event.target.value,
                    })
                  }
                  placeholder="auto / example.gguf"
                  helperText="auto にすると、検出された最大サイズのモデルを自動選択します。"
                  sx={{ flex: 1 }}
                />
              </Stack>
              {modelsStatus === 'loading' && (
                <Typography variant="body2" color="text.secondary">
                  モデル一覧を取得中...
                </Typography>
              )}
              {availableModels.length > 0 && (
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    label="auto (推奨)"
                    color={isAutoModel ? 'primary' : 'default'}
                    onClick={() =>
                      onAiSettingsChange({
                        ...aiSettings,
                        model: 'auto',
                      })
                    }
                  />
                  {availableModels.map((model) => (
                    <Chip
                      key={model.path}
                      label={`${model.name} (${formatBytes(model.sizeBytes)})`}
                      color={aiSettings.model === model.name ? 'primary' : 'default'}
                      onClick={() =>
                        onAiSettingsChange({
                          ...aiSettings,
                          model: model.name,
                        })
                      }
                    />
                  ))}
                </Stack>
              )}
              {recommendedModel &&
                !isAutoModel &&
                aiSettings.model !== recommendedModel.name && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() =>
                      onAiSettingsChange({
                        ...aiSettings,
                        model: recommendedModel.name,
                      })
                    }
                  >
                    推奨モデルに切り替え
                  </Button>
                )}
              {modelsError && <Alert severity="warning">{modelsError}</Alert>}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Temperature"
                  value={aiSettings.temperature}
                  onChange={(event) =>
                    onAiSettingsChange({
                      ...aiSettings,
                      temperature: Number(event.target.value),
                    })
                  }
                  type="number"
                  inputProps={{ min: 0, max: 1, step: 0.1 }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Top K"
                  value={aiSettings.topK}
                  onChange={(event) =>
                    onAiSettingsChange({
                      ...aiSettings,
                      topK: Number(event.target.value),
                    })
                  }
                  type="number"
                  inputProps={{ min: 1, step: 1 }}
                  sx={{ flex: 1 }}
                />
                <FormControl sx={{ flex: 1 }}>
                  <InputLabel id="ai-team-group">チーム判定group</InputLabel>
                  <Select
                    labelId="ai-team-group"
                    label="チーム判定group"
                    value={aiSettings.teamLabelGroup ?? ''}
                    onChange={(event) =>
                      onAiSettingsChange({
                        ...aiSettings,
                        teamLabelGroup: event.target.value,
                      })
                    }
                  >
                    <MenuItem value="">自動検出</MenuItem>
                    {availableGroups.map((group) => (
                      <MenuItem key={group} value={group}>
                        {group}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
              <Button variant="outlined" onClick={onSaveSettings}>
                AI設定を保存
              </Button>
              {settingsMessage && <Alert severity="info">{settingsMessage}</Alert>}
              <Typography variant="caption" color="text.secondary">
                モデルは `public/llama/models` 配下に配置してください。
              </Typography>
            </Stack>
          </Collapse>
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
};
