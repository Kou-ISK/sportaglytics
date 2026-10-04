// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fixture from '../fixtures/synthetic-edit-list.xml?raw';
import { useSportscodeImport } from './useSportscodeImport';
import {
  createSportscodeProject,
  selectSportscodeXml,
} from '../gateway/sportscodeImportGateway';
import {
  selectPackageDirectory,
  selectVideoFile,
} from '../../VideoPathSelector/gateway/packageGateway';
vi.mock('../gateway/sportscodeImportGateway', () => ({
  createSportscodeProject: vi.fn(),
  selectSportscodeXml: vi.fn(),
}));
vi.mock('../../VideoPathSelector/gateway/packageGateway', () => ({
  selectPackageDirectory: vi.fn(),
  selectVideoFile: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(selectSportscodeXml).mockResolvedValue({
    path: '/originals/架空.xml',
    text: fixture,
    sha256: '1'.repeat(64),
  });
  vi.mocked(selectVideoFile).mockResolvedValue('/originals/架空.mp4');
  vi.mocked(selectPackageDirectory).mockResolvedValue(null);
});
afterEach(cleanup);
const ready = async () => {
  const onImported = vi.fn();
  const onClose = vi.fn();
  const hook = renderHook(() =>
    useSportscodeImport({ open: true, onImported, onClose }),
  );
  await act(async () => hook.result.current.onSelectXml());
  await waitFor(() =>
    expect(hook.result.current.preview?.document.instances.length).toBe(2),
  );
  expect(hook.result.current.canImport).toBe(false);
  await act(async () => hook.result.current.onSelectVideo());
  act(() => hook.result.current.onConfirm(true));
  expect(hook.result.current.canImport).toBe(true);
  return { ...hook, onImported, onClose };
};
it('requires an explicit video and confirmation, and creates nothing after destination cancellation', async () => {
  const hook = await ready();
  await act(async () => hook.result.current.onImport());
  expect(createSportscodeProject).not.toHaveBeenCalled();
  expect(hook.onImported).not.toHaveBeenCalled();
  expect(hook.onClose).not.toHaveBeenCalled();
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.error).toBe('');
});
it('invalidates confirmation on offset changes and rejects a negative resulting time', async () => {
  const hook = await ready();
  act(() => hook.result.current.onOffsetChange('-5'));
  expect(hook.result.current.confirmed).toBe(false);
  expect(hook.result.current.canImport).toBe(false);
  expect(hook.result.current.error).toContain('負');
  await act(async () => hook.result.current.onImport());
  expect(selectPackageDirectory).not.toHaveBeenCalled();
});
it('accepts one creation request and preserves explicit times and separate label groups', async () => {
  const hook = await ready();
  vi.mocked(selectPackageDirectory).mockResolvedValue('/new-projects');
  let reject: ((error: Error) => void) | undefined;
  vi.mocked(createSportscodeProject).mockImplementation(
    () =>
      new Promise((_resolve, rejectPromise) => {
        reject = rejectPromise;
      }),
  );
  await act(async () => {
    hook.result.current.onImport();
    hook.result.current.onImport();
  });
  await waitFor(() => expect(createSportscodeProject).toHaveBeenCalledOnce());
  expect(selectPackageDirectory).toHaveBeenCalledOnce();
  expect(hook.result.current.busy).toBe(true);
  hook.result.current.onClose();
  expect(hook.onClose).not.toHaveBeenCalled();
  const request = vi.mocked(createSportscodeProject).mock.calls[0][0];
  expect(request.videoPath).toBe('/originals/架空.mp4');
  expect(request.directory).toBe('/new-projects');
  expect(request.offsetSeconds).toBe(0);
  expect(request.document.instances[0].startTime).toBe(4.25);
  expect(request.document.instances[0].labels?.slice(0, 2)).toEqual([
    { group: '位置', name: '中央' },
    { group: '方向', name: '中央' },
  ]);
  await act(async () =>
    reject?.(
      new Error(
        "Error invoking remote method 'sportscode:import-package': Error: Synthetic permission failure",
      ),
    ),
  );
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.error).toBe('Synthetic permission failure');
  expect(hook.result.current.preview?.document.instances.length).toBe(2);
  act(() => hook.result.current.onOffsetChange('1'));
  expect(hook.result.current.error).toBe('');
  expect(hook.result.current.confirmed).toBe(false);
  expect(hook.result.current.preview?.document.instances[0].startTime).toBe(
    5.25,
  );
});
