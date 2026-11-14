import { expect, it } from 'vitest';
import { isExportProgressWindowState } from './exportProgressWindow';

it('accepts multiple retained records but rejects unsupported writer state', () => {
  const state = {
    id: 'job',
    status: 'failed',
    current: 0,
    total: 1,
    message: 'uncertain',
    startedAt: 1,
    updatedAt: 2,
  };
  const record = {
    id: 'record',
    path: '/example/staging',
    purpose: 'native-temp',
    device: '1',
    inode: '2',
    reason: 'cleanup-failed',
    writerStatus: 'unknown',
  };
  expect(
    isExportProgressWindowState({ ...state, retainedDirectories: [record] }),
  ).toBe(true);
  expect(
    isExportProgressWindowState({
      ...state,
      retainedDirectories: [{ ...record, writerStatus: 'closed' }],
    }),
  ).toBe(false);
  expect(
    isExportProgressWindowState({
      ...state,
      retainedDirectories: [record, record, record, record],
    }),
  ).toBe(true);
});
