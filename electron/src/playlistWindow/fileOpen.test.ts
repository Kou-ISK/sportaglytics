import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  owner: { isDestroyed: vi.fn(() => false) },
  showOpenDialog: vi.fn(),
  showMessageBox: vi.fn(),
  load: vi.fn(),
  create: vi.fn(),
}));
vi.mock('electron', () => ({
  BrowserWindow: { getFocusedWindow: () => mocks.owner },
  dialog: {
    showOpenDialog: mocks.showOpenDialog,
    showMessageBox: mocks.showMessageBox,
  },
}));
vi.mock('./storage', () => ({ loadPlaylistFromPath: mocks.load }));
vi.mock('./windowManager', () => ({ createPlaylistWindow: mocks.create }));
import { openPlaylistFile } from './fileOpen';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.owner.isDestroyed.mockReturnValue(false);
  mocks.showOpenDialog.mockResolvedValue({
    canceled: false,
    filePaths: ['fixtures/review.stpl'],
  });
});

it('validates the selected package before opening its own window', async () => {
  await openPlaylistFile();
  expect(mocks.showOpenDialog).toHaveBeenCalledWith(
    mocks.owner,
    expect.objectContaining({
      properties: ['openDirectory', 'treatPackageAsDirectory'],
      filters: [{ name: 'SporTagLytics Playlist', extensions: ['stpl'] }],
    }),
  );
  expect(mocks.load).toHaveBeenCalledWith('fixtures/review.stpl');
  expect(mocks.create).toHaveBeenCalledWith(
    'fixtures/review.stpl',
    mocks.owner,
  );
  expect(mocks.load.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.create.mock.invocationCallOrder[0],
  );
});

it('does not create a window or read files when the picker is canceled', async () => {
  mocks.showOpenDialog.mockResolvedValue({
    canceled: true,
    filePaths: ['fixtures/review.stpl'],
  });
  await openPlaylistFile();
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.showMessageBox).not.toHaveBeenCalled();
});

it('reports an invalid document without creating a blank window', async () => {
  mocks.load.mockRejectedValue(new Error('Invalid playlist'));
  await openPlaylistFile();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.showMessageBox).toHaveBeenCalledWith(
    mocks.owner,
    expect.objectContaining({
      type: 'error',
      detail: 'Invalid playlist',
    }),
  );
});

it('does not attach a new window to an owner closed during the picker', async () => {
  mocks.showOpenDialog.mockImplementation(async () => {
    mocks.owner.isDestroyed.mockReturnValue(true);
    return { canceled: false, filePaths: ['fixtures/review.stpl'] };
  });
  await openPlaylistFile();
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
