import { ipcMain } from 'electron';
import * as path from 'path';
import { EVENT_DETECTION_CHANNELS, isEventDetectionRequest } from '../../../src/types/ipc/eventDetection';
import {
  cancelEventDetection,
  listEventDetectionModels,
  runEventDetection,
} from '../eventDetection/eventDetectionManager';
import { isNonEmptyString } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

let isRegistered = false;

export const registerEventDetectionHandlers = (): void => {
  if (isRegistered) return;
  isRegistered = true;

  ipcMain.handle(EVENT_DETECTION_CHANNELS.listModels, async (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid event detection model-list sender');
    }
    return listEventDetectionModels();
  });

  ipcMain.handle(EVENT_DETECTION_CHANNELS.run, async (event, payload: unknown) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid event detection sender');
    }
    if (!isEventDetectionRequest(payload)) {
      throw new Error('Invalid event detection request');
    }
    if (payload.clips.some((clip) => !path.isAbsolute(clip.videoPath))) {
      throw new Error('Event detection requires absolute local video paths');
    }

    return runEventDetection(payload, {
      onProgress: (progress) => {
        if (!senderWindow.isDestroyed()) {
          senderWindow.webContents.send(
            EVENT_DETECTION_CHANNELS.progress,
            progress,
          );
        }
      },
    });
  });

  ipcMain.handle(
    EVENT_DETECTION_CHANNELS.cancel,
    async (event, requestId: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid event detection cancel sender');
      }
      if (!isNonEmptyString(requestId)) return false;
      return cancelEventDetection(requestId);
    },
  );
};
