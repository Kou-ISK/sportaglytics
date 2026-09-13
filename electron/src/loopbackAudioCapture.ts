import { desktopCapturer, webContents, type Session } from 'electron';
import * as os from 'node:os';

const authorizedWebContentsIds = new Set<number>();

export const isLoopbackAudioCaptureSupported = (
  platform: NodeJS.Platform = process.platform,
  release = os.release(),
): boolean => {
  if (platform === 'win32') return true;
  if (platform !== 'darwin') return false;
  const darwinMajor = Number.parseInt(release.split('.')[0] ?? '', 10);
  return Number.isFinite(darwinMajor) && darwinMajor >= 22;
};

export const authorizeLoopbackCapture = (webContentsId: number): void => {
  authorizedWebContentsIds.add(webContentsId);
};

export const revokeLoopbackCapture = (webContentsId: number): void => {
  authorizedWebContentsIds.delete(webContentsId);
};

export const registerLoopbackAudioCapture = (
  electronSession: Session,
): void => {
  electronSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      const requestWebContents = request.frame
        ? webContents.fromFrame(request.frame)
        : undefined;
      const webContentsId = requestWebContents?.id;
      if (
        !isLoopbackAudioCaptureSupported() ||
        webContentsId === undefined ||
        !authorizedWebContentsIds.delete(webContentsId)
      ) {
        callback({});
        return;
      }
      try {
        const sources = await desktopCapturer.getSources({ types: ['screen'] });
        const source = sources[0];
        callback(source ? { video: source, audio: 'loopback' } : {});
      } catch {
        callback({});
      }
    },
    { useSystemPicker: process.platform === 'darwin' },
  );
};
