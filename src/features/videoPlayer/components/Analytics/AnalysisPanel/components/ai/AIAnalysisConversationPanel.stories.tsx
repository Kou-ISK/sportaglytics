import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { AIAnalysisConversationPanel } from './AIAnalysisConversationPanel';
import { reviewAiResult } from '../../fixtures/aiAnalysisReview';

const meta = {
  title: 'Workspace/Analysis/AIResult',
  component: AIAnalysisConversationPanel,
  decorators: [
    (Story) => (
      <Box sx={{ p: 2, maxWidth: 760 }}>
        <Story />
      </Box>
    ),
  ],
  args: reviewAiResult,
} satisfies Meta<typeof AIAnalysisConversationPanel>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Result: Story = {};
export const Light: Story = { globals: { themeMode: 'light' } };
export const NotRun: Story = {
  args: { displayQuestion: '', aiResponse: null, generationStatus: 'idle' },
};
export const Running: Story = {
  args: {
    aiResponse: null,
    generationStatus: 'running',
    llmProgress: {
      requestId: 'synthetic-request',
      elapsedMs: 1800,
      outputChars: 100,
    },
  },
};
export const MissingEvidence: Story = {
  args: {
    hasGroundedOutput: false,
    validatedHypotheses: [],
    validatedHighlights: [],
  },
};
