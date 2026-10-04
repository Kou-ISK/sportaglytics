import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { AnalysisCard } from './AnalysisCard';
import { MomentumChart } from '../../MomentumChart';
import { createMomentumDataFactory } from '../../../../../../shared/analysis/momentum';
import {
  incompatibleReviewTimeline,
  reviewTimeline,
} from '../fixtures/reviewTimeline';

const meta = {
  title: 'Workspace/Analysis/Momentum',
  component: AnalysisCard,
  decorators: [
    (Story) => (
      <Box sx={{ p: 2 }}>
        <Story />
      </Box>
    ),
  ],
  args: {
    title: 'モメンタムチャート',
    children: (
      <MomentumChart
        createMomentumData={createMomentumDataFactory(reviewTimeline)}
        teamNames={['Red', 'Blue']}
        disableAnimation
      />
    ),
  },
} satisfies Meta<typeof AnalysisCard>;
export default meta;
type Story = StoryObj<typeof meta>;
export const MatchingData: Story = {};
export const Light: Story = { globals: { themeMode: 'light' } };
export const NoPossession: Story = {
  args: {
    children: (
      <MomentumChart
        createMomentumData={createMomentumDataFactory(
          incompatibleReviewTimeline,
        )}
        teamNames={['Red', 'Blue']}
        disableAnimation
      />
    ),
  },
};
export const MissingTeams: Story = {
  args: {
    children: (
      <MomentumChart
        createMomentumData={createMomentumDataFactory(reviewTimeline)}
        teamNames={[]}
        disableAnimation
      />
    ),
  },
};
