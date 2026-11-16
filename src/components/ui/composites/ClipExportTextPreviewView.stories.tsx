import type { Meta, StoryObj } from '@storybook/react-vite';
import { ClipExportTextPreviewView } from './ClipExportTextPreviewView';
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
          layout: {
            lines: Array.from({ length: 10 }, () => ({
              text: '位置の確認',
              isBold: false,
            })),
            fontRatio: 24 / 1080,
            lineRatio: 30 / 1080,
            boxRatio: 0.2,
            paddingRatio: 0.01,
            overflow: true,
          },
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
