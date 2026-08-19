/* @vitest-environment jsdom */
import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAppTheme } from '../../../../theme';
import type { EventDetectionModelInfo } from '../../../../types/eventDetection/core';
import { EventDetectionDialogView } from './EventDetectionDialogView';

const experimentalModel: EventDetectionModelInfo = {
  id: 'rugby-event-test',
  version: '0.1.0-experimental.1',
  displayName: 'Rugby Event Detection',
  status: 'experimental',
  events: ['restart'],
  metrics: {
    restart: {
      precision: 0.084,
      recall: 1,
      evaluatedMatches: 2,
      confidenceThreshold: 0.24,
    },
  },
};

const renderDialog = (
  model: EventDetectionModelInfo,
  onMappingChange = vi.fn(),
): void => {
  render(
    <ThemeProvider theme={getAppTheme('dark')}>
      <EventDetectionDialogView
        open
        loadingModels={false}
        models={[model]}
        selectedModelKey={`${model.id}@${model.version}`}
        angleOptions={[{ id: 'main', name: 'Main', localClipCount: 1 }]}
        selectedAngleId="main"
        mappings={[
          {
            eventType: 'restart',
            actionName: 'リスタート',
            enabled: true,
            minConfidence: 0.24,
            leadTimeSeconds: 5,
            lagTimeSeconds: 15,
          },
        ]}
        progress={null}
        running={false}
        error={null}
        summary={null}
        onClose={vi.fn()}
        onModelChange={vi.fn()}
        onAngleChange={vi.fn()}
        onMappingChange={onMappingChange}
        onRun={vi.fn()}
        onCancel={vi.fn()}
      />
    </ThemeProvider>,
  );
};

afterEach(() => {
  cleanup();
});

describe('EventDetectionDialogView', () => {
  it('shows an experimental badge, warning, and measured quality information', () => {
    renderDialog(experimentalModel);

    expect(screen.getByText('試験')).toBeTruthy();
    expect(screen.getByText('試験的な自動検出機能')).toBeTruthy();
    expect(screen.getByText(/Recall 100%/)).toBeTruthy();
    expect(screen.getByText(/Precision 8%/)).toBeTruthy();
    expect(screen.getByText(/評価 2試合/)).toBeTruthy();
  });

  it('does not show the experimental warning for a verified model', () => {
    renderDialog({ ...experimentalModel, status: 'verified' });

    expect(screen.queryByText('試験的な自動検出機能')).toBeNull();
  });

  it('emits an edited confidence threshold from the view', () => {
    const onMappingChange = vi.fn();
    renderDialog(experimentalModel, onMappingChange);

    fireEvent.change(screen.getByLabelText('検出しきい値'), {
      target: { value: '0.65' },
    });

    expect(onMappingChange).toHaveBeenCalledWith('restart', {
      minConfidence: 0.65,
    });
  });
});
