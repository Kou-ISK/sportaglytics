import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaylistNoteEditorView } from './PlaylistNoteEditorView';
const meta = {
  title: 'Workspace/Playlist/NoteEditor',
  component: PlaylistNoteEditorView,
  args: {
    value: '外側のスペースを確認。\n次のサポートの位置を修正する。',
    onChange: () => {},
    onBlur: () => {},
    onKeyDown: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 280, padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PlaylistNoteEditorView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Inspector: Story = {};
export const SorterCell: Story = { args: { compact: true } };
export const Empty: Story = { args: { value: '' } };
