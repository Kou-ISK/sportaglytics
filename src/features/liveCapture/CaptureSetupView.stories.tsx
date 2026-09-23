import { useState } from 'react';
import type { ReactElement } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CaptureSetupView } from './CaptureSetupView';
import type { CaptureSetupViewProps } from './CaptureSetupView';

const sources: CaptureSetupViewProps['sources'] = [
  {
    id: 'one',
    name: 'アングル1',
    kind: 'device',
    videoDeviceId: '',
    audioDeviceId: '',
    url: '',
  },
  {
    id: 'two',
    name: 'アングル2',
    kind: 'network',
    videoDeviceId: '',
    audioDeviceId: '',
    url: 'rtsp://camera.example/live',
  },
];
const InteractiveCapture = (props: CaptureSetupViewProps): ReactElement => {
  const [inputs, setInputs] = useState(props.sources);
  const [name, setName] = useState(props.name);
  return (
    <CaptureSetupView
      {...props}
      name={name}
      onNameChange={setName}
      sources={inputs}
      onSourcesChange={setInputs}
      onAddSource={() =>
        setInputs((previous) => [
          ...previous,
          {
            ...sources[0],
            id: `angle-${previous.length + 1}`,
            name: `アングル${previous.length + 1}`,
          },
        ])
      }
    />
  );
};
const meta = {
  title: 'Capture/Setup',
  component: CaptureSetupView,
  parameters: { layout: 'fullscreen' },
  render: (args) => <InteractiveCapture {...args} />,
  args: {
    name: 'ライブ録画',
    sources,
    devices: [
      { id: 'usb', name: 'USB Capture', kind: 'video' },
      { id: 'iphone', name: 'iPhone Camera', kind: 'video' },
      { id: 'audio', name: 'Capture Audio', kind: 'audio' },
    ],
    quality: '1080p',
    snapshot: null,
    busy: false,
    error: '',
    networkAvailable: true,
    onNameChange: () => {},
    onSourcesChange: () => {},
    onQualityChange: () => {},
    onRefreshDevices: () => {},
    onAddSource: () => {},
    onStart: () => {},
    onStop: () => {},
    onHide: () => {},
    onRetry: () => {},
  },
} satisfies Meta<typeof CaptureSetupView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Setup: Story = {};
export const Light: Story = { globals: { themeMode: 'light' } };
export const FourInputs: Story = {
  args: {
    sources: [
      ...sources,
      { ...sources[0], id: 'three', name: 'アングル3' },
      { ...sources[1], id: 'four', name: 'アングル4' },
    ],
  },
};
export const Recording: Story = {
  args: {
    snapshot: {
      id: 'capture',
      name: 'ライブ録画',
      packagePath: 'recordings/live.stpkg',
      phase: 'recording',
      elapsedSeconds: 90,
      availableEndSeconds: 86,
      mediaAngles: [],
      inputs: sources.map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.kind,
        phase: 'recording',
        segmentCount: 43,
        recordedSeconds: 86,
      })),
    },
  },
};
export const Reconnect: Story = {
  args: {
    snapshot: {
      ...Recording.args!.snapshot!,
      inputs: [
        Recording.args!.snapshot!.inputs[0],
        {
          ...Recording.args!.snapshot!.inputs[1],
          phase: 'disconnected',
          message:
            '入力が切断されました。接続先と機器を確認して再接続してください。',
        },
      ],
    },
  },
};
export const PermissionError: Story = {
  args: {
    error: 'カメラを確認できません。接続とOSのカメラ権限を確認してください。',
  },
};

export const RecordingLight: Story = {
  args: Recording.args,
  globals: { themeMode: 'light' },
};
