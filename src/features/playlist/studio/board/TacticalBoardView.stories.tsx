import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactElement } from 'react';
import { TacticalBoardView } from './TacticalBoardView';
import { useTacticalBoardEditor } from './useTacticalBoardEditor';
import type { TacticalBoard } from '../../../../types/playlist/tacticalBoard';
const fixture: TacticalBoard = {
  widthMeters: 70,
  lengthMeters: 100,
  time: 8.2,
  markers: [
    { id: 'a1', x: 15, y: 35, kind: 'team1', label: '9' },
    { id: 'a2', x: 30, y: 40, kind: 'team1', label: '10' },
    { id: 'a3', x: 48, y: 45, kind: 'team1', label: '12' },
    { id: 'b1', x: 32, y: 52, kind: 'team2', label: '7' },
    { id: 'b2', x: 50, y: 55, kind: 'team2', label: '8' },
    { id: 'ball', x: 18, y: 37, kind: 'ball', label: '' },
  ],
  arrows: [{ id: 'pass', from: { x: 19, y: 37 }, to: { x: 28, y: 40 } }],
};
const Fixture = ({
  empty = false,
  error = false,
}: {
  empty?: boolean;
  error?: boolean;
}): ReactElement => {
  const editor = useTacticalBoardEditor(
    empty ? { ...fixture, markers: [], arrows: [] } : fixture,
  );
  return (
    <TacticalBoardView
      open
      editor={editor}
      image=""
      busy={false}
      progress={0}
      error={error ? '映像を読み込めませんでした。手動で配置できます。' : ''}
      candidates={empty ? [] : null}
      canRecognize={false}
      recognitionHint="ピッチの4点を現在のフレームで較正してください。"
      onClose={() => {}}
      onSave={() => {}}
      onDetect={() => {}}
      onCancelDetection={() => {}}
      onImport={() => {}}
      onDismissCandidates={() => {}}
      onExport={() => {}}
    />
  );
};
const meta: Meta<typeof TacticalBoardView> = {
  title: 'Playlist/Paint/Tactical Board',
  component: TacticalBoardView,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof meta>;
export const Formation: Story = { render: () => <Fixture /> };
export const Empty: Story = { render: () => <Fixture empty /> };
export const RecognitionUnavailable: Story = {
  render: () => <Fixture error />,
};
