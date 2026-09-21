import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Box, Button } from '@mui/material';
import { PlaylistSorterView } from './PlaylistSorterView';
import { usePlaylistSorter } from '../hooks/playlist/usePlaylistSorter';
import { usePlaylistHistory } from '../hooks/playlist/usePlaylistHistory';
import { applyPresentationOrder } from '../../../shared/playlist/playlistPresentationOrder';
import { sorterFixture } from '../fixtures/sorter';
import type { PlaylistItem } from '../../../types/playlist/core';
const Fixture = ({
  initialItems = sorterFixture,
}: {
  initialItems?: PlaylistItem[];
}): ReactElement => {
  const history = usePlaylistHistory(initialItems);
  const [selected, setSelected] = useState(new Set<string>());
  const props = usePlaylistSorter({
    items: history.items,
    currentIndex: -1,
    selectedItemIds: selected,
    onSelectItem: (id) => setSelected(new Set([id])),
    onPlayItem: () => undefined,
    onDeleteSelected: () => undefined,
    onReorder: (ids) =>
      history.setItems((items) => applyPresentationOrder(items, ids)),
  });
  return (
    <Box sx={{ height: 420, p: 1 }}>
      <Button disabled={!history.canUndo} onClick={history.undo}>
        元に戻す
      </Button>
      <Box sx={{ height: 360 }}>
        <PlaylistSorterView {...props} />
      </Box>
    </Box>
  );
};
const meta: Meta<typeof PlaylistSorterView> = {
  title: 'Workspace/Playlist/Sorter',
  component: PlaylistSorterView,
  render: () => <Fixture />,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Interactive: Story = {};
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <Box sx={{ width: 460 }}>
        <Story />
      </Box>
    ),
  ],
};
export const Empty: Story = { render: () => <Fixture initialItems={[]} /> };
