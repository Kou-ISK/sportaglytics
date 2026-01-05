import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Paper,
  Stack,
  Typography,
} from '@mui/material';

interface SummaryItem {
  label: string;
  value: React.ReactNode;
}

interface SummaryStepProps {
  items: SummaryItem[];
}

/**
 * Step 4: 作成内容の確認
 */
export const SummaryStep: React.FC<SummaryStepProps> = ({ items }) => {
  return (
    <Stack spacing={2}>
      <Alert severity="success">
        <AlertTitle>作成内容の確認</AlertTitle>
        以下の内容でパッケージを作成します
      </Alert>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {items.map((item) => (
            <Box key={item.label}>
              <Typography variant="caption" color="text.secondary">
                {item.label}
              </Typography>
              {typeof item.value === 'string' ||
              typeof item.value === 'number' ? (
                <Typography variant="body1">{item.value}</Typography>
              ) : (
                item.value
              )}
            </Box>
          ))}
        </Stack>
      </Paper>
    </Stack>
  );
};
