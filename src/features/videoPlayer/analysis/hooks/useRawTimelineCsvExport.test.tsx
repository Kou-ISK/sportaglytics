/* @vitest-environment jsdom */

import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NotificationContext,
  type NotificationContextValue,
} from '../../../../contexts/NotificationContext';
import type { TimelineData } from '../../../../types/TimelineData';
import { useRawTimelineCsvExport } from './useRawTimelineCsvExport';

const timeline: TimelineData[] = [
  {
    id: 'timeline-1',
    actionName: 'Alpha - Try',
    startTime: 10,
    endTime: 15,
    memo: 'memo',
    labels: [],
  },
];

const createNotificationValue = (): NotificationContextValue => ({
  notify: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
});

describe('useRawTimelineCsvExport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete (globalThis.window as typeof globalThis.window & {
      electronAPI?: unknown;
    }).electronAPI;
  });

  it('subscribes to the menu handler and exports CSV successfully', async () => {
    const notification = createNotificationValue();
    let menuHandler: (() => void) | null = null;
    const saveFileDialog = vi.fn().mockResolvedValue('/tmp/timeline.csv');
    const writeTextFile = vi.fn().mockResolvedValue(true);

    (
      globalThis.window as typeof globalThis.window & {
        electronAPI?: typeof globalThis.window.electronAPI;
      }
    ).electronAPI = {
      saveFileDialog,
      writeTextFile,
      onMenuExportAnalysisRawCsv: vi.fn((handler: () => void) => {
        menuHandler = handler;
        return vi.fn();
      }),
    } as unknown as typeof globalThis.window.electronAPI;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotificationContext.Provider value={notification}>
        {children}
      </NotificationContext.Provider>
    );

    renderHook(() => useRawTimelineCsvExport({ timeline }), { wrapper });

    expect(menuHandler).not.toBeNull();

    act(() => {
      menuHandler?.();
    });

    await waitFor(() => {
      expect(saveFileDialog).toHaveBeenCalled();
      expect(writeTextFile).toHaveBeenCalled();
    });
    expect(notification.success).toHaveBeenCalledWith('Raw CSVを保存しました。');
  });

  it('reports an error when the export API is unavailable', async () => {
    const notification = createNotificationValue();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NotificationContext.Provider value={notification}>
        {children}
      </NotificationContext.Provider>
    );

    (
      globalThis.window as typeof globalThis.window & {
        electronAPI?: typeof globalThis.window.electronAPI;
      }
    ).electronAPI = {
      onMenuExportAnalysisRawCsv: vi.fn(() => vi.fn()),
    } as unknown as typeof globalThis.window.electronAPI;

    const { result } = renderHook(() => useRawTimelineCsvExport({ timeline }), {
      wrapper,
    });

    await act(async () => {
      await result.current.exportRawCsv();
    });

    expect(notification.error).toHaveBeenCalledWith(
      'Raw CSVエクスポート機能が利用できません。',
    );
  });
});
