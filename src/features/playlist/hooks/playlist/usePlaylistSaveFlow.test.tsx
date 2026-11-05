// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { usePlaylistSaveFlow } from './usePlaylistSaveFlow';
const mocks = vi.hoisted(() => ({ save: vi.fn(), saveAs: vi.fn(), close: vi.fn(), dirty: vi.fn() }));
vi.mock('../../gateway/playlistWindowGateway', () => ({
  savePlaylistFile: mocks.save, savePlaylistFileAs: mocks.saveAs,
  notifyPlaylistSavedAndClose: mocks.close, syncPlaylistDirtyState: mocks.dirty,
}));
const make = () => {
  const version = { token: '0:0', document: 0 };
  const setters = { setPlaylistName: vi.fn(), setPlaylistType: vi.fn(), setLoadedFilePath: vi.fn(),
    setIsDirty: vi.fn(), setHasUnsavedChanges: vi.fn(), setSaveDialogOpen: vi.fn(), setSaveProgress: vi.fn() };
  const params: Parameters<typeof usePlaylistSaveFlow>[0] = {
    items: [], videoSources: [], packagePath: null, itemAnnotations: {}, playlistName: 'Test',
    playlistType: 'embedded', playlistRows: [], getChangeToken: () => version.token,
    getDocumentGeneration: () => version.document, ...setters,
  };
  const hook = renderHook(() => usePlaylistSaveFlow(params));
  return { version, setters, hook };
};
beforeEach(() => { vi.resetAllMocks(); });
it('does not serialize a stale render immediately after an edit', async () => {
  const f = make(); f.version.token = '0:1';
  await act(() => f.hook.result.current.handleSavePlaylist());
  expect(mocks.save).not.toHaveBeenCalled(); expect(f.setters.setIsDirty).not.toHaveBeenCalled();
});
it('keeps later edits dirty and does not close after an older save', async () => {
  const pending = Promise.withResolvers<string | null>(); mocks.save.mockReturnValue(pending.promise);
  const f = make(); let saving!: Promise<void>;
  act(() => { saving = f.hook.result.current.handleSavePlaylist(true); });
  f.version.token = '0:1'; pending.resolve('/synthetic.stpl'); await act(() => saving);
  expect(mocks.close).not.toHaveBeenCalled(); expect(mocks.dirty).not.toHaveBeenCalled();
  expect(f.setters.setHasUnsavedChanges).not.toHaveBeenCalledWith(false);
});
it('serializes overlapping saves and does not apply a result to a replacement document', async () => {
  const pending = Promise.withResolvers<string | null>(); mocks.saveAs.mockReturnValue(pending.promise);
  const f = make(); let first!: Promise<void>;
  act(() => { first = f.hook.result.current.handleSavePlaylistAs('embedded', 'A'); });
  await act(() => f.hook.result.current.handleSavePlaylist());
  expect(mocks.save).not.toHaveBeenCalled();
  f.version.document++; f.version.token = '1:0'; pending.resolve('/synthetic.stpl'); await act(() => first);
  expect(f.setters.setLoadedFilePath).not.toHaveBeenCalled(); expect(mocks.dirty).not.toHaveBeenCalled();
});
it('marks an unchanged Save As clean and keeps the chosen path when newer edits remain', async () => {
  const pending = Promise.withResolvers<string | null>(); mocks.saveAs.mockReturnValueOnce(pending.promise);
  const f = make(); let first!: Promise<void>;
  act(() => { first = f.hook.result.current.handleSavePlaylistAs('embedded', 'A'); });
  f.version.token = '0:1'; pending.resolve('/synthetic.stpl'); await act(() => first);
  expect(f.setters.setLoadedFilePath).toHaveBeenCalledWith('/synthetic.stpl');
  expect(f.setters.setHasUnsavedChanges).not.toHaveBeenCalledWith(false);
  f.hook.rerender(); mocks.saveAs.mockResolvedValueOnce('/synthetic-2.stpl');
  await act(() => f.hook.result.current.handleSavePlaylistAs('embedded', 'B'));
  expect(f.setters.setHasUnsavedChanges).toHaveBeenCalledWith(false);
  expect(mocks.dirty).toHaveBeenCalledWith(false);
});
