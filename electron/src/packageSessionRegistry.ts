import * as fs from 'node:fs';
import * as path from 'node:path';
import type { BrowserWindow } from 'electron';

export interface PackageSession {
  id: string;
  mainWindow: BrowserWindow;
  packagePath: string | null;
  auxiliaryWindows: Set<BrowserWindow>;
}

const sessions = new Map<string, PackageSession>();
const contextsBySender = new WeakMap<object, PackageSession>();
const sessionsByWindow = new WeakMap<BrowserWindow, PackageSession>();
let nextSessionId = 1;

export const normalizePackagePath = (packagePath: string): string => {
  const resolved = path.normalize(path.resolve(packagePath));
  let normalized = resolved;
  try {
    normalized = fs.realpathSync.native(resolved);
  } catch {
    // A path may be reserved before the package has finished being created.
    // The resolved path is still stable enough for that in-flight request.
  }
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
};

export const createPackageSession = (
  mainWindow: BrowserWindow,
): PackageSession => {
  const existing = sessionsByWindow.get(mainWindow);
  if (existing) return existing;

  const session: PackageSession = {
    id: `package-session-${nextSessionId++}`,
    mainWindow,
    packagePath: null,
    auxiliaryWindows: new Set(),
  };
  sessions.set(session.id, session);
  sessionsByWindow.set(mainWindow, session);
  return session;
};

export const getPackageSessionForWindow = (
  window: BrowserWindow | null | undefined,
): PackageSession | null => {
  if (!window || window.isDestroyed()) return null;
  const session = sessionsByWindow.get(window);
  return session &&
    sessions.has(session.id) &&
    !session.mainWindow.isDestroyed()
    ? session
    : null;
};

const getLiveWebContents = (window: BrowserWindow): unknown | null => {
  if (window.isDestroyed()) return null;

  try {
    return window.webContents;
  } catch {
    // Electron may destroy WebContents between the liveness check and access.
    return null;
  }
};

export const getPackageSessionForSender = (
  sender: unknown,
): PackageSession | null => {
  if (typeof sender === 'object' && sender !== null) {
    const context = contextsBySender.get(sender);
    if (
      context &&
      sessions.has(context.id) &&
      !context.mainWindow.isDestroyed()
    )
      return context;
  }
  for (const session of sessions.values()) {
    if (session.mainWindow.isDestroyed()) continue;
    if (getLiveWebContents(session.mainWindow) === sender) return session;
    for (const window of session.auxiliaryWindows) {
      if (getLiveWebContents(window) === sender) return session;
    }
  }
  return null;
};

export const getPackageSessionForId = (
  sessionId: string,
): PackageSession | null => sessions.get(sessionId) ?? null;

export const getPackageSessionForPackagePath = (
  packagePath: string,
): PackageSession | null => {
  const normalized = normalizePackagePath(packagePath);
  for (const session of sessions.values()) {
    if (!session.mainWindow.isDestroyed() && session.packagePath === normalized)
      return session;
  }
  return null;
};

/** Return a live session whose package has not been selected yet. */
export const getEmptyPackageSession = (): PackageSession | null => {
  for (const session of sessions.values()) {
    if (!session.mainWindow.isDestroyed() && session.packagePath === null) {
      return session;
    }
  }
  return null;
};

/**
 * Reserve a package path before notifying the renderer.
 *
 * Reserving at routing time closes the race where two Finder/Explorer opens
 * arrive while the first renderer is still loading its package.
 */
export const reservePackageSession = (
  mainWindow: BrowserWindow,
  packagePath: string,
): PackageSession => {
  const normalized = normalizePackagePath(packagePath);
  const existing = getPackageSessionForPackagePath(normalized);
  if (existing) return existing;

  const session = createPackageSession(mainWindow);
  session.packagePath = normalized;
  return session;
};

export const releasePackageSession = (
  mainWindow: BrowserWindow,
  packagePath: string,
): boolean => {
  const session = sessionsByWindow.get(mainWindow);
  if (!session || session.packagePath !== normalizePackagePath(packagePath)) {
    return false;
  }

  session.packagePath = null;
  return true;
};

export const focusPackageSession = (session: PackageSession): void => {
  const window = session.mainWindow;
  if (window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
};

export const bindPackageSession = (
  mainWindow: BrowserWindow,
  packagePath: string,
): PackageSession | null => {
  const session = createPackageSession(mainWindow);
  const normalized = normalizePackagePath(packagePath);
  const duplicate = getPackageSessionForPackagePath(normalized);
  if (duplicate && duplicate !== session) return duplicate;
  session.packagePath = normalized;
  return session;
};

export const registerAuxiliaryWindow = (
  session: PackageSession,
  auxiliaryWindow: BrowserWindow,
): void => {
  session.auxiliaryWindows.add(auxiliaryWindow);
  sessionsByWindow.set(auxiliaryWindow, session);
};

export const unregisterAuxiliaryWindow = (
  session: PackageSession,
  auxiliaryWindow: BrowserWindow,
): void => {
  session.auxiliaryWindows.delete(auxiliaryWindow);
  sessionsByWindow.delete(auxiliaryWindow);
};

export const getPackageSessions = (): readonly PackageSession[] => [
  ...sessions.values(),
];

export const removePackageSession = (session: PackageSession): void => {
  for (const auxiliaryWindow of session.auxiliaryWindows) {
    sessionsByWindow.delete(auxiliaryWindow);
  }
  sessionsByWindow.delete(session.mainWindow);
  sessions.delete(session.id);
};

export const closePackageSessionWindows = (session: PackageSession): void => {
  for (const window of [...session.auxiliaryWindows]) {
    if (!window.isDestroyed()) window.close();
  }
};

/** A recording owner shares command context, but outlives the package's UI windows. */
export const setPackageWindowContext = (
  window: BrowserWindow,
  session: PackageSession,
): void => {
  sessionsByWindow.set(window, session);
  contextsBySender.set(window.webContents, session);
};
