import type { Meta, StoryObj } from '@storybook/react-vite';
import { SportscodeImportView } from './SportscodeImportView';
const preview = {
  document: {
    version: 2 as const,
    rows: [{ id: 'row', name: 'Coral 攻撃', color: '#4D8DFF' }],
    instances: [
      {
        id: 'scene',
        actionName: 'Coral 攻撃',
        startTime: 4.25,
        endTime: 8.75,
        memo: '架空ノート',
      },
    ],
  },
  sessionStart: null,
  warnings: [],
};
const meta = {
  title: 'Workspace/SportscodeImport',
  component: SportscodeImportView,
  args: {
    open: true,
    busy: false,
    error: '',
    xmlName: '',
    videoName: '',
    name: '',
    offset: '0',
    confirmed: false,
    preview: null,
    canImport: false,
    onSelectXml: () => {},
    onSelectVideo: () => {},
    onNameChange: () => {},
    onOffsetChange: () => {},
    onConfirm: () => {},
    onImport: () => {},
    onClose: () => {},
  },
} satisfies Meta<typeof SportscodeImportView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const Ready: Story = {
  args: {
    xmlName: '架空 #%.xml',
    videoName: '架空 #%.mp4',
    name: '新しいプロジェクト',
    confirmed: true,
    canImport: true,
    preview,
  },
};
export const Warnings: Story = {
  args: {
    ...Ready.args,
    preview: {
      ...preview,
      sessionStart: '2026-01-02 10:00:00 +0000',
      warnings: [
        '開始日時は自動補正しません。',
        '未対応の項目 drawing は読み込みません。',
      ],
    },
  },
};
export const Failed: Story = {
  args: {
    ...Ready.args,
    error:
      '場面の時刻が選択した映像の長さを超えています。映像と秒数補正を確認してください。',
  },
};
export const Copying: Story = {
  args: { ...Ready.args, busy: true, canImport: false },
};
