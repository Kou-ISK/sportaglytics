import { desktopCapturer, webContents, type Session } from 'electron';
import * as os from 'node:os';

const authorizedWebContentsIds = new Set<number>();

export const isLoopbackAudioCaptureSupported = (): boolean => {
  if (process.platform !== 'darwin') return false;
  const darwinMajor = Number.parseInt(os.release().split('.')[0] ?? '', 10);
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
      const sources = await desktopCapturer.getSources({ types: ['screen'] });
      const source = sources[0];
      if (!source) {
        callback({});
        return;
      }
      callback({ video: source, audio: 'loopback' });
    },
    { useSystemPicker: true },
  );
};
