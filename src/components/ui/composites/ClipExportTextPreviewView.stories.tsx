import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClipExportTextPreviewView } from './ClipExportTextPreviewView';
import { layoutClipExportText } from '../../../shared/clipExport/clipExportTextLayout';
const meta = {
  title: 'Workspace/Export/TextPreview',
  component: ClipExportTextPreviewView,
  args: {
    preview: {
      clips: [],
      index: 0,
      loading: true,
      blocked: true,
      select: () => {},
      retry: () => {},
    },
  },
} satisfies Meta<typeof ClipExportTextPreviewView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Loading: Story = {};
export const Error: Story = {
  args: {
    preview: {
      ...meta.args.preview,
      loading: false,
      error:
        '映像を読み込めませんでした。接続・保存場所を確認して、再試行してください。',
    },
  },
};
export const Overflow: Story = {
  args: {
    preview: {
      ...meta.args.preview,
      loading: false,
      clips: [
        {
          title: '1. スクラム',
          width: 1920,
          height: 1080,
          layout: layoutClipExportText(
            [{ text: '位置の確認\n'.repeat(9), isBold: false }],
            16 / 9,
          ),
        },
      ],
    },
  },
};
export const Narrow: Story = {
  ...Overflow,
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
};
export const Light: Story = { ...Overflow, globals: { themeMode: 'light' } };
