import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box } from '@mui/material';
import { TimelineReviewView } from './TimelineReviewView';
import { useTimelineReview } from './useTimelineReview';
import { reviewTimeline } from '../../../../fixtures/timelineReview';
import type { TimelineData } from '../../../../../../types/timeline/core';

const many = Array.from({ length: 240 }, (_, i) => ({
  ...reviewTimeline[i % reviewTimeline.length],
  id: String(i),
  startTime: i * 3,
  endTime: i * 3 + 2,
  memo: i === 0 ? '長い行名とノートの確認。'.repeat(30) : `確認用ノート ${i}`,
}));
const Fixture = ({
  data = many,
  initialQuery = '',
  width = 320,
}: {
  data?: TimelineData[];
  initialQuery?: string;
  width?: number;
}): ReactElement => {
  const [selected, setSelected] = useState<string[]>(
    data[0] ? [data[0].id] : [],
  );
  const review = useTimelineReview(data, selected, initialQuery);
  return (
    <Box sx={{ height: 450, width, border: 1, borderColor: 'divider' }}>
      <TimelineReviewView
        {...review}
        onActivate={(id) => setSelected([id])}
        onEdit={() => undefined}
        onAddToPlaylist={() => undefined}
        formatTime={(time) =>
          `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}`
        }
      />
    </Box>
  );
};
const meta: Meta<typeof TimelineReviewView> = {
  title: 'Workspace/Timeline/Review',
  component: TimelineReviewView,
  render: () => <Fixture />,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const ManyAndLongNote: Story = {};
export const Empty: Story = { render: () => <Fixture data={[]} /> };
export const NoMatches: Story = {
  render: () => <Fixture initialQuery="一致しない検索" />,
};
export const Compact: Story = { render: () => <Fixture width={260} /> };
