import { useTimelineHistory } from '../../../app/hooks/useTimelineHistory';
import { ActionPresetProvider } from '../../../../../contexts/ActionPresetContext';
import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button, Typography } from '@mui/material';
import { NotificationProvider } from '../../../../../contexts/NotificationProvider';
import { VisualTimelineView } from './VisualTimelineView';
import { useVisualTimelineController } from './hooks/useVisualTimelineController';
import { reviewRows, reviewTimeline } from '../../../fixtures/timelineReview';
const TimelineFixture = (): ReactElement => {
  const { timeline, setTimeline, undo, redo, canUndo, canRedo } =
    useTimelineHistory(reviewTimeline);
  const [time, setTime] = useState(45);
  const [selected, setSelected] = useState<string[]>([]);
  const props = useVisualTimelineController({
    timeline,
    onUpdateTimeRange: (id, startTime, endTime) =>
      setTimeline(
        timeline.map((item) =>
          item.id === id ? { ...item, startTime, endTime } : item,
        ),
      ),
    onUndo: undo,
    onRedo: redo,
    rows: reviewRows,
    maxSec: 120,
    currentTime: time,
    onSeek: setTime,
    onDelete: (ids) =>
      setTimeline(timeline.filter((item) => !ids.includes(item.id))),
    onUpdateTimelineItem: (id, updates) =>
      setTimeline(
        timeline.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        ),
      ),
    selectedIds: selected,
    onSelectionChange: setSelected,
    teamNames: ['ホーム', 'アウェイ'],
  });
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="technical" data-testid="seek-time">
        {time.toFixed(3)}
      </Typography>
      <Button disabled={!canUndo} onClick={undo}>
        元に戻す
      </Button>
      <Button disabled={!canRedo} onClick={redo}>
        やり直す
      </Button>
      <Box sx={{ height: 265, mt: 1, border: 1, borderColor: 'divider' }}>
        <VisualTimelineView {...props} />
      </Box>
    </Box>
  );
};
const meta: Meta<typeof VisualTimelineView> = {
  title: 'Workspace/Timeline/Continuous',
  component: VisualTimelineView,
  decorators: [
    (Story) => (
      <NotificationProvider>
        <ActionPresetProvider>
          <Story />
        </ActionPresetProvider>
      </NotificationProvider>
    ),
  ],
  render: () => <TimelineFixture />,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
