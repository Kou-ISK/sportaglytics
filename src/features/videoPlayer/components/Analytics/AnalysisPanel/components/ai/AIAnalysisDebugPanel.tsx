import React from 'react';
import { Box, Button, Divider, Stack, TextField, Typography } from '@mui/material';

interface LlmRetryInfo {
  attempt: number;
  total: number;
  mode: 'reduce' | 'repair';
  reason: string;
}

interface LlmDebugInfo {
  stderr?: string;
  binaryPath?: string;
  modelPath?: string;
  durationMs?: number;
}

interface AIAnalysisDebugPanelProps {
  llmRawText: string | null;
  llmLiveLog: string;
  llmRetryInfo: LlmRetryInfo | null;
  llmDebug: LlmDebugInfo | null;
  showDebug: boolean;
  setShowDebug: (value: boolean) => void;
}

export const AIAnalysisDebugPanel = ({
  llmRawText,
  llmLiveLog,
  llmRetryInfo,
  llmDebug,
  showDebug,
  setShowDebug,
}: AIAnalysisDebugPanelProps) => {
  if (!llmRawText && !llmDebug?.stderr && !llmLiveLog) {
    return null;
  }

  return (
    <>
      <Divider />
      <Box>
        <Button size="small" variant="text" onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? 'デバッグ情報を隠す' : 'デバッグ情報を表示'}
        </Button>
        {showDebug && (
          <Stack spacing={2} mt={1}>
            {llmRetryInfo && (
              <Typography variant="caption" color="text.secondary">
                再試行理由: {llmRetryInfo.reason}
              </Typography>
            )}
            {llmLiveLog && (
              <TextField
                label="LLM live log"
                value={llmLiveLog}
                multiline
                minRows={3}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            )}
            {llmRawText && (
              <TextField
                label="LLM raw output"
                value={llmRawText}
                multiline
                minRows={4}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            )}
            {llmDebug?.stderr && (
              <TextField
                label="LLM stderr"
                value={llmDebug.stderr}
                multiline
                minRows={3}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            )}
            {(llmDebug?.binaryPath || llmDebug?.modelPath || llmDebug?.durationMs != null) && (
              <Stack spacing={0.5}>
                {llmDebug?.binaryPath && (
                  <Typography variant="caption" color="text.secondary">
                    binary: {llmDebug.binaryPath}
                  </Typography>
                )}
                {llmDebug?.modelPath && (
                  <Typography variant="caption" color="text.secondary">
                    model: {llmDebug.modelPath}
                  </Typography>
                )}
                {llmDebug?.durationMs != null && (
                  <Typography variant="caption" color="text.secondary">
                    duration: {llmDebug.durationMs} ms
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        )}
      </Box>
    </>
  );
};
