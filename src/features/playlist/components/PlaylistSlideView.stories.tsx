import type { Meta, StoryObj } from '@storybook/react-vite';
import { PlaylistSlideView } from './PlaylistSlideView';

const meta = {
  title: 'Workspace/Playlist/MeetingSlide',
  component: PlaylistSlideView,
  args: { slide: { title: '場面を振り返る', body: '守備が動いた瞬間に、どのスペースが空きましたか？' } },
  decorators: [(Story) => <div style={{ height: 320 }}><Story /></div>],
} satisfies Meta<typeof PlaylistSlideView>;
export default meta;
export const Meeting: StoryObj<typeof meta> = {};
