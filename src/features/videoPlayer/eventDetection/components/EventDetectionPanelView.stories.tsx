import type { Meta, StoryObj } from '@storybook/react';
import { EventDetectionPanelView } from './EventDetectionPanelView';
const meta = {
  title: 'Features/VideoPlayer/EventDetection/Panel',
  component: EventDetectionPanelView,
  parameters: { layout: 'fullscreen' },
  args: {
    open: true,
    loadingModels: false,
    models: [
      {
        id: 'example',
        version: '1',
        displayName: 'Rugby Events',
        status: 'experimental',
        evaluationBasis: 'reference-coding',
        events: ['scrum', 'lineout', 'restart'],
        metrics: {},
      },
    ],
    selectedModelKey: 'example@1',
    angleOptions: [{ id: 'wide', name: 'Wide camera', localClipCount: 2 }],
    selectedAngleId: 'wide',
    mappings: [
      {
        eventType: 'scrum',
        actionName: 'Scrum',
        enabled: true,
        minConfidence: 0.65,
        leadTimeSeconds: 5,
        lagTimeSeconds: 15,
      },
      {
        eventType: 'lineout',
        actionName: 'Lineout',
        enabled: true,
        minConfidence: 0.7,
        leadTimeSeconds: 5,
        lagTimeSeconds: 15,
      },
      {
        eventType: 'restart',
        actionName: 'Restart',
        enabled: true,
        minConfidence: 0.7,
        leadTimeSeconds: 5,
        lagTimeSeconds: 15,
      },
    ],
    running: false,
    progress: null,
    error: null,
    summary: null,
    onClose: () => {},
    onModelChange: () => {},
    onAngleChange: () => {},
    onMappingChange: () => {},
    onRun: () => {},
    onCancel: () => {},
  },
} satisfies Meta<typeof EventDetectionPanelView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Running: Story = {
  args: {
    running: true,
    progress: {
      requestId: 'example',
      stage: 'analyzing',
      progress: 0.42,
      message: '映像を解析しています (42%)',
    },
  },
};
export const Empty: Story = {
  args: { models: [], selectedModelKey: '', mappings: [] },
};
export const Failed: Story = {
  args: {
    error: '解析する映像を読み込めませんでした。映像の接続を確認してください。',
  },
};
export const Complete: Story = {
  args: {
    summary: {
      added: 28,
      duplicates: 2,
      lowConfidence: 3,
      modelStatus: 'experimental',
    },
  },
};
export const Compact: Story = {
  parameters: { viewport: { defaultViewport: 'tablet' } },
};
