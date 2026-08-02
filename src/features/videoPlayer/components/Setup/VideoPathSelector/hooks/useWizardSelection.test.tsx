/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WizardSelectionState } from '../types';
import { useWizardSelection } from './useWizardSelection';

const gatewayMocks = vi.hoisted(() => ({
  selectPackageDirectory: vi.fn(),
  selectVideoFile: vi.fn(),
  selectVideoFiles: vi.fn(),
}));

vi.mock('../gateway/packageGateway', () => gatewayMocks);

const createInitialSelection = (): WizardSelectionState => ({
  selectedDirectory: '',
  angles: [
    {
      id: 'angle-1',
      name: 'Angle 1',
      clips: [],
    },
  ],
});

describe('useWizardSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates one angle per selected file for stack import', async () => {
    gatewayMocks.selectVideoFiles.mockResolvedValue([
      '/videos/main.mp4',
      '/videos/wide.mp4',
    ]);
    let angleIndex = 1;
    let clipIndex = 1;
    const { result } = renderHook(() =>
      useWizardSelection({
        createAngleId: () => `new-angle-${angleIndex++}`,
        createClipId: () => `new-clip-${clipIndex++}`,
        createInitialSelection,
        showError: vi.fn(),
      }),
    );

    await act(async () => result.current.handleSelectVideosAsAngles());

    expect(result.current.selection.angles).toHaveLength(2);
    expect(result.current.selection.angles.map((angle) => angle.name)).toEqual([
      'Angle 1',
      'Angle 2',
    ]);
    expect(
      result.current.selection.angles.map((angle) => angle.clips[0].source),
    ).toEqual(['/videos/main.mp4', '/videos/wide.mp4']);
  });

  it('reuses the initial empty angle for a YouTube source', () => {
    const { result } = renderHook(() =>
      useWizardSelection({
        createAngleId: () => 'youtube-angle',
        createClipId: () => 'youtube-clip',
        createInitialSelection,
        showError: vi.fn(),
      }),
    );

    act(() =>
      result.current.handleAddYoutubeClip(
        'angle-1',
        'https://youtu.be/example',
      ),
    );

    expect(result.current.selection.angles).toHaveLength(1);
    expect(result.current.selection.angles[0].clips[0]).toMatchObject({
      sourceKind: 'youtube',
      source: 'https://youtu.be/example',
    });
  });

  it('returns the directory selected at the final create action', async () => {
    gatewayMocks.selectPackageDirectory.mockResolvedValue('/packages');
    const { result } = renderHook(() =>
      useWizardSelection({
        createAngleId: () => 'angle',
        createClipId: () => 'clip',
        createInitialSelection,
        showError: vi.fn(),
      }),
    );

    let directory: string | null = null;
    await act(async () => {
      directory = await result.current.handleSelectDirectory();
    });

    expect(directory).toBe('/packages');
    expect(result.current.selection.selectedDirectory).toBe('/packages');
  });

  it('keeps dropped local videos in order and enforces the 16 clip limit', () => {
    let clipIndex = 1;
    const showError = vi.fn();
    const { result } = renderHook(() =>
      useWizardSelection({
        createAngleId: () => 'angle',
        createClipId: () => `clip-${clipIndex++}`,
        createInitialSelection,
        showError,
      }),
    );
    const paths = Array.from(
      { length: 18 },
      (_, index) => `/videos/${String(index + 1).padStart(2, '0')}.mp4`,
    );

    act(() => result.current.handleAddDroppedVideos('angle-1', paths));

    expect(result.current.selection.angles[0].clips).toHaveLength(16);
    expect(
      result.current.selection.angles[0].clips.map((clip) => clip.source),
    ).toEqual(paths.slice(0, 16));
    expect(showError).not.toHaveBeenCalled();
  });

  it('rejects unsupported dropped files', () => {
    const showError = vi.fn();
    const { result } = renderHook(() =>
      useWizardSelection({
        createAngleId: () => 'angle',
        createClipId: () => 'clip',
        createInitialSelection,
        showError,
      }),
    );

    act(() =>
      result.current.handleAddDroppedVideos('angle-1', [
        '/videos/readme.txt',
      ]),
    );

    expect(result.current.selection.angles[0].clips).toHaveLength(0);
    expect(showError).toHaveBeenCalled();
  });
});
