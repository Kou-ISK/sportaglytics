import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimelineProvenanceView } from './TimelineProvenanceView';
import { detectionProvenance } from '../../../../../../shared/timeline/fixtures/detectionProvenance';

const meta: Meta<typeof TimelineProvenanceView> = {
  title: 'Workspace/Timeline/Provenance',
  component: TimelineProvenanceView,
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Unknown: Story = {};
export const Detected: Story = { args: { provenance: detectionProvenance } };
export const MergedWithUnknown: Story = {
  args: { provenance: { ...detectionProvenance, hasUnknownSource: true } },
};
