/* @vitest-environment jsdom */
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../../../contexts/NotificationProvider';
import { getAppTheme } from '../../../../theme';
import { VideoPathSelectorView } from './VideoPathSelectorView';
import { CreatePackageWizardView } from './VideoPathSelector/CreatePackageWizardView';
import type { DragAndDropState } from './VideoPathSelector/hooks/useDragAndDrop';
import { VideoSelectionStep } from './VideoPathSelector/steps/VideoSelectionStep';

const dragState: DragAndDropState = {
  isDragging: false,
  isValidDrop: false,
};

const renderWithProviders = (ui: React.ReactElement): void => {
  render(
    <ThemeProvider theme={getAppTheme('dark')}>
      <NotificationProvider>{ui}</NotificationProvider>
    </ThemeProvider>,
  );
};

afterEach(() => {
  cleanup();
});

describe('VideoPathSelectorView', () => {
  it('keeps all five startup entry points available', () => {
    const callbacks = {
      onOpenPackage: vi.fn(),
      onOpenWizard: vi.fn(),
      onOpenCapture: vi.fn(),
      onOpenLegacyPackage: vi.fn(),
      onOpenSportscode: vi.fn(),
    };
    renderWithProviders(
      <VideoPathSelectorView
        {...callbacks}
        showWelcome={false}
        dragState={dragState}
        dragHandlers={{}}
        recentPackages={[]}
        onOpenRecentPackage={vi.fn()}
        onRemoveRecentPackage={vi.fn()}
      />,
    );
    for (const name of [
      'パッケージを開く',
      '新しいパッケージを作成',
      'ライブキャプチャ',
      '旧SporTagフォルダを開く',
      'Sportscode XMLから作成',
    ]) {
      fireEvent.click(screen.getByRole('button', { name }));
    }
    for (const callback of Object.values(callbacks)) {
      expect(callback).toHaveBeenCalledOnce();
    }
  });

  it('opens files through a callback without a notification or Electron provider', () => {
    const onOpenPackage = vi.fn();
    render(
      <ThemeProvider theme={getAppTheme('dark')}>
        <VideoPathSelectorView
          showWelcome
          dragState={dragState}
          dragHandlers={{}}
          recentPackages={[]}
          onOpenPackage={onOpenPackage}
          onOpenWizard={vi.fn()}
          onOpenRecentPackage={vi.fn()}
          onRemoveRecentPackage={vi.fn()}
        />
      </ThemeProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'パッケージを開く' }));
    expect(onOpenPackage).toHaveBeenCalledTimes(1);
    expect(screen.getByText('最近開いたパッケージはありません')).toBeTruthy();
  });

  it('prioritizes opening an existing package over creating a new one', () => {
    renderWithProviders(
      <VideoPathSelectorView
        showWelcome
        dragState={dragState}
        dragHandlers={{}}
        recentPackages={[]}
        onOpenPackage={vi.fn()}
        onOpenWizard={vi.fn()}
        onOpenRecentPackage={vi.fn()}
        onRemoveRecentPackage={vi.fn()}
      />,
    );

    expect(screen.getByText('パッケージを開く')).toBeTruthy();
    expect(screen.getByText('新しいパッケージを作成')).toBeTruthy();
    expect(screen.queryByText('Package workspace')).toBeNull();
    expect(screen.queryByText('Drop .stpkg')).toBeNull();
  });

  it('opens the package wizard from the create entry point', () => {
    const handleOpenWizard = vi.fn();

    renderWithProviders(
      <VideoPathSelectorView
        showWelcome
        dragState={dragState}
        dragHandlers={{}}
        recentPackages={[]}
        onOpenPackage={vi.fn()}
        onOpenWizard={handleOpenWizard}
        onOpenRecentPackage={vi.fn()}
        onRemoveRecentPackage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('新しいパッケージを作成'));

    expect(handleOpenWizard).toHaveBeenCalledTimes(1);
  });
});

describe('startup recent packages and recovery', () => {
  const packages = [
    {
      path: '/Volumes/Archive/final.stpkg',
      name: '決勝',
      team1Name: 'Blue',
      team2Name: 'Red',
      videoCount: 2,
      lastOpened: 1788994800000,
    },
    {
      path: '/matches/round4.stpkg',
      name: '第4節',
      team1Name: 'Green',
      team2Name: 'White',
      videoCount: 1,
      lastOpened: 1788908400000,
    },
  ];
  const props = {
    showWelcome: false,
    dragState,
    dragHandlers: {},
    recentPackages: packages,
    onOpenPackage: vi.fn(),
    onOpenWizard: vi.fn(),
    onOpenCapture: vi.fn(),
    onOpenLegacyPackage: vi.fn(),
    onOpenSportscode: vi.fn(),
    onOpenRecentPackage: vi.fn(),
    onRemoveRecentPackage: vi.fn(),
  };
  it.each(['決勝', 'blue', 'ARCHIVE'])(
    'filters by name, team or path: %s',
    (query) => {
      renderWithProviders(
        <VideoPathSelectorView {...props} searchQuery={query} />,
      );
      expect(screen.getByRole('button', { name: '決勝を開く' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: '第4節を開く' })).toBeNull();
    },
  );
  it('lets users clear a search without matches', () => {
    const onSearchChange = vi.fn();
    renderWithProviders(
      <VideoPathSelectorView
        {...props}
        searchQuery="unknown"
        onSearchChange={onSearchChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '検索をクリア' }));
    expect(onSearchChange).toHaveBeenCalledWith('');
  });
  it('removes history without opening or removing the package file', () => {
    const onRemove = vi.fn();
    const onOpen = vi.fn();
    renderWithProviders(
      <VideoPathSelectorView
        {...props}
        onRemoveRecentPackage={onRemove}
        onOpenRecentPackage={onOpen}
      />,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: '決勝を最近開いたパッケージから削除',
      }),
    );
    expect(onRemove).toHaveBeenCalledWith(packages[0].path);
    expect(onOpen).not.toHaveBeenCalled();
  });
  it('disables opening, creating and history actions during loading', () => {
    renderWithProviders(<VideoPathSelectorView {...props} busy />);
    for (const name of [
      'パッケージを開く',
      '新しいパッケージを作成',
      'ライブキャプチャ',
      '旧SporTagフォルダを開く',
      'Sportscode XMLから作成',
      '決勝を開く',
      '決勝を最近開いたパッケージから削除',
    ]) {
      expect(
        screen.getByRole('button', { name }).hasAttribute('disabled'),
      ).toBe(true);
    }
    expect(
      screen.getByRole('progressbar', { name: 'パッケージの読み込み' }),
    ).toBeTruthy();
  });
  it('keeps error details and offers retry without Electron', () => {
    const retry = vi.fn();
    renderWithProviders(
      <VideoPathSelectorView
        {...props}
        error="読み込めません"
        errorDetails="/offline.stpkg"
        onRetry={retry}
      />,
    );
    expect(screen.getByRole('alert').textContent).toContain('/offline.stpkg');
    fireEvent.click(screen.getByRole('button', { name: 'もう一度開く' }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('CreatePackageWizardView', () => {
  it('disables wizard actions while creating', () => {
    renderWithProviders(
      <CreatePackageWizardView
        open
        activeStep={1}
        form={{ packageName: 'match-1', team1Name: 'A', team2Name: 'B' }}
        errors={{}}
        isCreating
        selection={{
          selectedDirectory: '/tmp',
          angles: [
            {
              id: 'angle-1',
              name: 'Main',
              clips: [
                {
                  id: 'clip-1',
                  sourceKind: 'local',
                  source: '/tmp/main.mp4',
                  gapBeforeSeconds: 0,
                },
              ],
            },
          ],
        }}
        onClose={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
        onFormChange={vi.fn()}
        onSelectVideo={vi.fn()}
        onSelectVideos={vi.fn()}
        onSelectVideosAsAngles={vi.fn()}
        onAddYoutubeClip={vi.fn()}
        onAddDroppedVideos={vi.fn()}
        onAddAngle={vi.fn()}
        onRemoveAngle={vi.fn()}
        onUpdateAngleName={vi.fn()}
        onRemoveClip={vi.fn()}
        onUpdateClip={vi.fn()}
        onReorderClip={vi.fn()}
        onMoveClip={vi.fn()}
      />,
    );

    const createButton = screen.getByRole('button', { name: '作成中...' });

    expect(createButton).toBeTruthy();
    expect(createButton.hasAttribute('disabled')).toBe(true);
  });
});

describe('VideoSelectionStep', () => {
  it('reveals import choices and sync controls only when requested', async () => {
    const handleSelectVideos = vi.fn();
    const handleMoveClip = vi.fn();
    const handleReorderClip = vi.fn();

    renderWithProviders(
      <VideoSelectionStep
        angles={[
          {
            id: 'angle-main',
            name: 'Main',
            clips: [
              {
                id: 'clip-main-1',
                sourceKind: 'local',
                source: '/tmp/first-half.mp4',
                gapBeforeSeconds: 0,
              },
              {
                id: 'clip-main-2',
                sourceKind: 'local',
                source: '/tmp/second-half.mp4',
                gapBeforeSeconds: 2.5,
              },
            ],
          },
          {
            id: 'angle-endzone',
            name: 'Endzone',
            clips: [
              {
                id: 'clip-endzone-1',
                sourceKind: 'youtube',
                source: 'https://www.youtube.com/watch?v=example',
                gapBeforeSeconds: 0,
              },
            ],
          },
        ]}
        onSelectVideo={vi.fn()}
        onSelectVideos={handleSelectVideos}
        onSelectVideosAsAngles={vi.fn()}
        onAddYoutubeClip={vi.fn()}
        onAddDroppedVideos={vi.fn()}
        onAddAngle={vi.fn()}
        onRemoveAngle={vi.fn()}
        onUpdateAngleName={vi.fn()}
        onRemoveClip={vi.fn()}
        onUpdateClip={vi.fn()}
        onReorderClip={handleReorderClip}
        onMoveClip={handleMoveClip}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'このアングルに映像を追加' }),
    ).toBeTruthy();
    expect(screen.getByText('first-half.mp4')).toBeTruthy();
    expect(
      screen.getAllByText('同期位置は再生画面のシンクモードで設定').length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('開始位置（秒）')).toBeNull();
    expect(screen.queryByText('同期を調整…')).toBeNull();

    fireEvent.click(
      screen.getByRole('button', { name: 'このアングルに映像を追加' }),
    );
    expect(screen.getByText('ローカル映像')).toBeTruthy();
    expect(screen.getByText('YouTube')).toBeTruthy();
    fireEvent.click(screen.getByText('ローカル映像'));
    expect(handleSelectVideos).toHaveBeenCalledWith('angle-main');

    fireEvent.click(
      screen.getAllByRole('button', { name: '映像を上へ移動' })[1],
    );
    expect(handleMoveClip).toHaveBeenCalledWith(
      'angle-main',
      'clip-main-2',
      -1,
    );

    const dragHandles = document.querySelectorAll<HTMLElement>(
      '[data-clip-drag-handle]',
    );
    const clipRows = document.querySelectorAll<HTMLElement>('[data-clip-row]');
    fireEvent.pointerDown(dragHandles[1], { button: 0 });
    fireEvent.pointerEnter(clipRows[0], { buttons: 1 });
    expect(handleReorderClip).toHaveBeenCalledWith(
      'angle-main',
      'clip-main-2',
      'clip-main-1',
    );

    fireEvent.click(screen.getByText('Endzone'));
    expect(
      screen.getByText('https://www.youtube.com/watch?v=example'),
    ).toBeTruthy();
  });
});
