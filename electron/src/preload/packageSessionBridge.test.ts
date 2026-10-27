import { expect, it, vi } from 'vitest';
import type { IpcRenderer } from 'electron';
import { createAppBridgeFsApi } from './appBridgeFsApi';

it('forwards the bind/release generation and rejects non-boolean success replies', async () => {
  const invoke = vi.fn(async (..._args: unknown[]): Promise<unknown> => true);
  // Only invoke is used by these methods; a native renderer process is not created.
  const bridge = createAppBridgeFsApi({ invoke } as unknown as IpcRenderer);
  expect(await bridge.bindPackageSession?.('/sample.stpkg', 'new')).toBe(true);
  expect(invoke).toHaveBeenLastCalledWith(
    'package-session:bind',
    '/sample.stpkg',
    'new',
  );
  invoke.mockResolvedValue('true');
  expect(await bridge.releasePackageSession?.('/sample.stpkg', 'old')).toBe(
    false,
  );
  expect(invoke).toHaveBeenLastCalledWith(
    'package-session:release',
    '/sample.stpkg',
    'old',
  );
});
