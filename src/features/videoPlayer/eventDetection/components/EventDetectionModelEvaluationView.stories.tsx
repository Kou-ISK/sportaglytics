import type { Meta, StoryObj } from '@storybook/react';
import { EventDetectionModelEvaluationView } from './EventDetectionModelEvaluationView';

const meta = {
  title: 'Features/VideoPlayer/EventDetection/ModelEvaluation',
  component: EventDetectionModelEvaluationView,
  args: {
    model: {
      id: 'example-model',
      version: '2.0.0',
      displayName: 'Event Detection',
      status: 'experimental',
      evaluationBasis: 'reference-coding',
      events: ['restart', 'scrum', 'lineout'],
      metrics: {
        restart: {
          precision: 0.4,
          recall: 1,
          evaluatedMatches: 2,
          confidenceThreshold: 0.3,
        },
        scrum: {
          precision: 0.5,
          recall: 0.96,
          evaluatedMatches: 2,
          confidenceThreshold: 0.65,
        },
        lineout: {
          precision: 0.3,
          recall: 0.97,
          evaluatedMatches: 2,
          confidenceThreshold: 0.25,
        },
      },
    },
  },
} satisfies Meta<typeof EventDetectionModelEvaluationView>;

export default meta;
type Story = StoryObj<typeof meta>;
export const ReferenceCoding: Story = {};
export const ReportedMetrics: Story = {
  args: { model: { ...meta.args.model, evaluationBasis: 'reported-metrics' } },
};
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
