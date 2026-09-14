import { useState } from 'react';
import type { ReactElement } from 'react';
import { VideoPathSelectorView } from './VideoPathSelectorView';
import type { VideoPathSelectorViewProps } from './VideoPathSelectorView';
import type { Meta, StoryObj } from '@storybook/react-vite';

const InteractiveStart = (props: VideoPathSelectorViewProps): ReactElement => {
  const [query, setQuery] = useState(props.searchQuery ?? '');
  const [packages, setPackages] = useState(props.recentPackages);
  return (
    <VideoPathSelectorView
      {...props}
      recentPackages={packages}
      searchQuery={query}
      onSearchChange={setQuery}
      onRemoveRecentPackage={(path) =>
        setPackages((current) => current.filter((pkg) => pkg.path !== path))
      }
    />
  );
};

const meta = {
  title: 'Workspace/Start',
  component: VideoPathSelectorView,
  render: (args) => <InteractiveStart {...args} />,
  args: {
    showWelcome: true,
    dragState: { isDragging: false, isValidDrop: false },
    dragHandlers: {},
    recentPackages: [],
    onOpenPackage: () => {},
    onOpenWizard: () => {},
    onOpenRecentPackage: () => {},
    onRemoveRecentPackage: () => {},
  },
} satisfies Meta<typeof VideoPathSelectorView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Empty: Story = {};
export const RecentMatches: Story = {
  args: {
    recentPackages: [
      {
        path: '/matches/final.stpkg',
        name: '決勝戦｜前半・後半レビュー',
        team1Name: 'ホーム',
        team2Name: 'アウェイ',
        videoCount: 2,
        lastOpened: 1788994800000,
      },
      {
        path: '/matches/round4.stpkg',
        name: '第4節｜ディフェンスから攻撃への切り替え・チーム全体レビュー',
        team1Name: '長いチーム名のホームチーム',
        team2Name: 'ビジターチーム',
        videoCount: 3,
        lastOpened: 1788908400000,
      },
    ],
  },
};
export const Light: Story = {
  ...RecentMatches,
  globals: { themeMode: 'light' },
};
export const ValidDrop: Story = {
  args: { dragState: { isDragging: true, isValidDrop: true } },
};
export const InvalidDrop: Story = {
  args: { dragState: { isDragging: true, isValidDrop: false } },
};

export const Returning: Story = {
  args: { ...RecentMatches.args, showWelcome: false },
};
export const Loading: Story = {
  args: { ...RecentMatches.args, busy: true },
};
export const OpenError: Story = {
  args: {
    ...RecentMatches.args,
    error: 'パッケージ設定を読み込めませんでした。',
    errorDetails:
      '/Volumes/Team Archive/Season 2026/final.stpkg\nENOENT: 外付けドライブが見つかりません',
    onRetry: () => {},
    onDismissError: () => {},
  },
};
export const UnsupportedDrop: Story = {
  args: {
    ...RecentMatches.args,
    invalidDrop: true,
    error:
      '.stpkg パッケージを1つドロップしてください。映像ファイルは「新しいパッケージを作成」から追加できます。',
    onRetry: () => {},
    onDismissError: () => {},
  },
};
export const SearchNoResults: Story = {
  args: { ...RecentMatches.args, searchQuery: '見つからない試合' },
};

export const FullHistory: Story = {
  args: {
    showWelcome: false,
    recentPackages: Array.from({ length: 6 }, (_, index) => ({
      path: `/Volumes/Team Archive/Season 2026/Match ${index + 1}/analysis.stpkg`,
      name: `第${index + 1}節｜ディフェンスから攻撃への切り替え・チーム全体レビュー`,
      team1Name: 'ホームチーム',
      team2Name: 'アウェイチーム',
      videoCount: 4,
      lastOpened: 1788994800000 - index * 86400000,
    })),
  },
};
