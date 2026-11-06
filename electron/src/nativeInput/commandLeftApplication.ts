import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { createCommandLeftMain } from './commandLeftMain';
import { registerCommandLeftIpc } from './commandLeftIpc';
import { loadSignedCommandLeftMonitor } from './commandLeftStartup';

/** Missing or unauthenticated addons leave the existing DOM key path intact. */
export const registerCommandLeftApplication = (): void => {
  if (!app.isPackaged || process.platform !== 'darwin' || process.arch !== 'arm64') return;
  let quitting = false;
  let registered = false;
  let input: ReturnType<typeof createCommandLeftMain> | null = null;
  app.once('will-quit', () => { quitting = true; input?.dispose(); });
  const startup = app.whenReady().then(async () => {
    if (quitting || !registered) return null;
    const monitor = await loadSignedCommandLeftMonitor(process.resourcesPath, path.join(app.getPath('userData'), 'native-preview'));
    if (quitting) return null;
    const candidate = createCommandLeftMain(monitor, () => BrowserWindow.getFocusedWindow());
    if (!candidate.start()) { candidate.dispose(); return null; }
    if (quitting) { candidate.dispose(); return null; }
    input = candidate;
    return candidate;
  }).catch(() => null); // The ordinary keyboard path remains active.
  try { registerCommandLeftIpc(startup); registered = true; } catch { /* leave DOM input intact */ }
};
