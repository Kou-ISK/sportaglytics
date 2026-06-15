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
        activeStep={3}
        form={{ packageName: 'match-1', team1Name: 'A', team2Name: 'B' }}
        errors={{}}
        isCreating
        selection={{
          selectedDirectory: '/tmp',
          angles: [{ id: 'angle-1', name: 'Main', filePath: '/tmp/main.mp4' }],
        }}
        summaryItems={[{ label: 'パッケージ名', value: 'match-1' }]}
        onClose={vi.fn()}
        onBack={vi.fn()}
        onNext={vi.fn()}
        onFormChange={vi.fn()}
        onSelectDirectory={vi.fn()}
        onSelectVideo={vi.fn()}
        onAddAngle={vi.fn()}
        onRemoveAngle={vi.fn()}
        onUpdateAngleName={vi.fn()}
      />,
    );

    const createButton = screen.getByRole('button', { name: '作成中...' });

    expect(createButton).toBeTruthy();
    expect(createButton.hasAttribute('disabled')).toBe(true);
  });
});
