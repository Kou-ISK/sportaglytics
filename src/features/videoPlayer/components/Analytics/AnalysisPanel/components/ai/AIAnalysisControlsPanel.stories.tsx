import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Stack } from '@mui/material';
import { AIAnalysisControlsPanel } from './AIAnalysisControlsPanel';
import type { AIAnalysisControlsPanelProps } from './AIAnalysisControlsPanel.types';
import { reviewAiControls } from '../../fixtures/aiAnalysisReview';

const InteractiveControls = (
  props: AIAnalysisControlsPanelProps,
): ReactElement => {
  const [question, setQuestion] = useState(props.question);
  const [showFilters, setShowFilters] = useState(props.showFilters);
  const [preset, setPreset] = useState(props.retrieverPreset);
  return (
    <Stack spacing={1.5} sx={{ p: 2, maxWidth: 760 }}>
      <AIAnalysisControlsPanel
        {...props}
        question={question}
        setQuestion={setQuestion}
        retrieverPreset={preset}
        onRetrieverPresetChange={setPreset}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
      />
    </Stack>
  );
};
const meta = {
  title: 'Workspace/Analysis/AIInput',
  component: AIAnalysisControlsPanel,
  render: (args) => <InteractiveControls {...args} />,
  args: reviewAiControls,
} satisfies Meta<typeof AIAnalysisControlsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const EmptyQuestion: Story = { args: { question: '' } };
export const Running: Story = { args: { generationStatus: 'running' } };
export const Error: Story = {
  args: {
    generationStatus: 'error',
    generationError:
      '合成エラー：分析を実行できませんでした。設定を確認して再実行してください。',
  },
};
export const WithEvidence: Story = { args: { evidenceItemsCount: 3 } };
export const Light: Story = { globals: { themeMode: 'light' } };
