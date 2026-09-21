/* @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTimelineClipExportDialog } from './useTimelineClipExportDialog';

const gatewayMocks = vi.hoisted(() => ({
  exportClipsWithOverlay: vi.fn(),
  subscribeClipExportMenuRequest: vi.fn(),
  sendTimelineWindowCommand: vi.fn(),
}));
vi.mock('../../../../app/gateways/timelineWindowGateway', () => ({
  sendTimelineWindowCommand: gatewayMocks.sendTimelineWindowCommand,
}));
const serviceMocks = vi.hoisted(() => ({
  executeClipExport: vi.fn(),
}));

vi.mock('../../../../../../shared/clipExport/clipExportGateway', () => ({
  canExportClipsWithOverlay: () => true,
  exportClipsWithOverlay: gatewayMocks.exportClipsWithOverlay,
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
    gatewayMocks.subscribeClipExportMenuRequest.mockReturnValue(
      () => undefined,
    );
  });

  it('opens without loading application settings', () => {
    const { result, unmount } = renderHook(() =>
      useTimelineClipExportDialog({
        timeline: [],
        selectedIds: [],
        videoSources: ['/source.mp4'],
        info: vi.fn(),
      }),
    );
    expect(
      gatewayMocks.subscribeClipExportMenuRequest.mock.invocationCallOrder[0],
    ).toBeLessThan(
      gatewayMocks.sendTimelineWindowCommand.mock.invocationCallOrder[0],
    );
    expect(gatewayMocks.sendTimelineWindowCommand).toHaveBeenCalledWith({
      type: 'clip-export-ready',
      ready: true,
    });
    act(() => gatewayMocks.subscribeClipExportMenuRequest.mock.calls[0][0]());
    expect(result.current.clipDialogOpen).toBe(true);
    unmount();
    expect(gatewayMocks.sendTimelineWindowCommand).toHaveBeenLastCalledWith({
      type: 'clip-export-ready',
      ready: false,
    });
  });

  it('requires a new overlay choice each time the dialog opens', async () => {
    const info = vi.fn();
    const { result } = renderHook(() =>
      useTimelineClipExportDialog({
        timeline: [],
        selectedIds: [],
        videoSources: ['/source.mp4'],
        info,
      }),
    );
    act(() => result.current.setClipDialogOpen(true));
    await act(async () => result.current.handleExportClips());
    expect(serviceMocks.executeClipExport).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      'オーバーレイテキストを含めるか選択してください',
    );
    act(() => result.current.chooseOverlay(false));
    expect(result.current.overlayChoice).toBe(false);
    act(() => result.current.setClipDialogOpen(false));
    act(() => result.current.setClipDialogOpen(true));
    expect(result.current.overlayChoice).toBeNull();
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
    act(() => result.current.chooseOverlay(false));
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
