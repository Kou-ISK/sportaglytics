/* @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimelineClipExportDialog } from './useTimelineClipExportDialog';

const gatewayMocks = vi.hoisted(() => ({
  exportClipsWithOverlay: vi.fn(),
  loadClipOverlaySettings: vi.fn(),
  subscribeClipExportMenuRequest: vi.fn(),
}));
const serviceMocks = vi.hoisted(() => ({
  executeClipExport: vi.fn(),
}));

vi.mock('../../../../../../shared/clipExport/clipExportGateway', () => ({
  canExportClipsWithOverlay: () => true,
  exportClipsWithOverlay: gatewayMocks.exportClipsWithOverlay,
  loadClipOverlaySettings: gatewayMocks.loadClipOverlaySettings,
  subscribeClipExportMenuRequest: gatewayMocks.subscribeClipExportMenuRequest,
}));

vi.mock('../../../../../../shared/clipExport/clipExportService', async () => {
  const actual = await vi.importActual<
    typeof import('../../../../../../shared/clipExport/clipExportService')
  >('../../../../../../shared/clipExport/clipExportService');
  return {
    ...actual,
    executeClipExport: serviceMocks.executeClipExport,
  };
});

describe('useTimelineClipExportDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    gatewayMocks.loadClipOverlaySettings.mockResolvedValue(null);
    gatewayMocks.subscribeClipExportMenuRequest.mockReturnValue(
      () => undefined,
    );
  });

  it('closes the modal before the background export finishes', async () => {
    let resolveExport:
      | ((value: { success: boolean; message: string }) => void)
      | null = null;
    serviceMocks.executeClipExport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveExport = resolve;
        }),
    );
    const info = vi.fn();
    const { result } = renderHook(() =>
      useTimelineClipExportDialog({
        timeline: [
          {
            id: 'clip-1',
            actionName: 'Scrum',
            startTime: 0,
            endTime: 5,
            memo: '',
          },
        ],
        selectedIds: [],
        videoSources: ['/source.mp4'],
        info,
      }),
    );

    act(() => result.current.setClipDialogOpen(true));
    let exportPromise: Promise<void> | null = null;
    act(() => {
      exportPromise = result.current.handleExportClips();
    });

    await waitFor(() => expect(result.current.clipDialogOpen).toBe(false));
    expect(serviceMocks.executeClipExport).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveExport?.({ success: true, message: '完了' });
      await exportPromise;
    });
    expect(info).toHaveBeenCalledWith('完了');
  });
});
