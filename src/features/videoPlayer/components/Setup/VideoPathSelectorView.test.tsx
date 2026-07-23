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
  it('shows balanced entry points for creating and opening packages', () => {
    renderWithProviders(
      <VideoPathSelectorView
        showWelcome
        dragState={dragState}
        dragHandlers={{}}
        wizardOpen={false}
        recentPackages={[]}
        onPackageLoaded={vi.fn()}
        onOpenWizard={vi.fn()}
        onCloseWizard={vi.fn()}
        onPackageCreated={vi.fn()}
        onOpenRecentPackage={vi.fn()}
        onRemoveRecentPackage={vi.fn()}
      />,
    );

    expect(screen.getByText('新規パッケージ')).toBeTruthy();
    expect(screen.getByText('開く')).toBeTruthy();
    expect(screen.queryByText('1. 映像を開く')).toBeNull();
  });

  it('opens the package wizard from the create entry point', () => {
    const handleOpenWizard = vi.fn();

    renderWithProviders(
      <VideoPathSelectorView
        showWelcome
        dragState={dragState}
        dragHandlers={{}}
        wizardOpen={false}
        recentPackages={[]}
        onPackageLoaded={vi.fn()}
        onOpenWizard={handleOpenWizard}
        onCloseWizard={vi.fn()}
        onPackageCreated={vi.fn()}
        onOpenRecentPackage={vi.fn()}
        onRemoveRecentPackage={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('新規パッケージ'));

    expect(handleOpenWizard).toHaveBeenCalledTimes(1);
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
