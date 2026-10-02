import { useState } from 'react';
import type { ReactElement } from 'react';
import { Button } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CreatePackageWizardView } from './CreatePackageWizardView';
import type { CreatePackageWizardViewProps } from './CreatePackageWizardView';

const InteractiveWizard = (
  props: CreatePackageWizardViewProps,
): ReactElement => {
  const [open, setOpen] = useState(props.open);
  const [form, setForm] = useState(props.form);
  const [activeStep, setActiveStep] = useState(props.activeStep);
  return (
    <>
      <Button onClick={() => setOpen(true)}>新しいパッケージを作成</Button>
      <CreatePackageWizardView
        {...props}
        open={open}
        form={form}
        activeStep={activeStep}
        onFormChange={(updates) =>
          setForm((current) => ({ ...current, ...updates }))
        }
        onNext={() => (activeStep === 0 ? setActiveStep(1) : props.onNext())}
        onBack={() => setActiveStep(0)}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

const meta = {
  title: 'Workspace/CreatePackage',
  component: CreatePackageWizardView,
  render: (args) => <InteractiveWizard {...args} />,
  args: {
    open: true,
    activeStep: 0,
    form: {
      packageName: '合成試合レビュー',
      team1Name: 'Red',
      team2Name: 'Blue',
    },
    errors: {},
    isCreating: false,
    selection: {
      selectedDirectory: '',
      angles: [
        {
          id: 'angle-main',
          name: 'メイン',
          clips: [
            {
              id: 'clip-main',
              sourceKind: 'local',
              source: 'fixtures/synthetic.mp4',
              gapBeforeSeconds: 0,
            },
          ],
        },
      ],
    },
    onClose: () => {},
    onBack: () => {},
    onNext: () => {},
    onFormChange: () => {},
    onSelectVideo: async () => {},
    onSelectVideos: async () => {},
    onSelectVideosAsAngles: async () => {},
    onAddYoutubeClip: () => {},
    onAddDroppedVideos: () => {},
    onAddAngle: () => {},
    onRemoveAngle: () => {},
    onUpdateAngleName: () => {},
    onRemoveClip: () => {},
    onUpdateClip: () => {},
    onReorderClip: () => {},
    onMoveClip: () => {},
  },
} satisfies Meta<typeof CreatePackageWizardView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const BasicInfo: Story = {};
export const Light: Story = { globals: { themeMode: 'light' } };
export const ValidationErrors: Story = {
  args: {
    form: { packageName: '', team1Name: '', team2Name: '' },
    errors: {
      packageName: '名前を入力してください',
      team1Name: 'チーム名を入力してください',
      team2Name: 'チーム名を入力してください',
    },
  },
};
export const VideoSelection: Story = { args: { activeStep: 1 } };
export const Creating: Story = { args: { activeStep: 1, isCreating: true } };
