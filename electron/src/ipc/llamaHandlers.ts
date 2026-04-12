import { ipcMain } from 'electron';
import {
  cancelLlamaRequest,
  generateWithLlama,
  listLlamaModels,
} from '../llamaManager';
import type { LlamaGenerateRequest } from '../llama/types';
import { isNonEmptyString, isPlainObject } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

let isRegistered = false;

const isOptionalFiniteNumber = (value: unknown): boolean => {
  return (
    value === undefined || (typeof value === 'number' && Number.isFinite(value))
  );
};

const isLlamaGenerateRequest = (
  value: unknown,
): value is LlamaGenerateRequest => {
  return (
    isPlainObject(value) &&
    isNonEmptyString(value.prompt) &&
    isNonEmptyString(value.model) &&
    isOptionalFiniteNumber(value.temperature) &&
    isOptionalFiniteNumber(value.topP) &&
    isOptionalFiniteNumber(value.topK) &&
    isOptionalFiniteNumber(value.repeatPenalty) &&
    isOptionalFiniteNumber(value.maxTokens) &&
    isOptionalFiniteNumber(value.timeoutMs) &&
    (value.requestId === undefined || isNonEmptyString(value.requestId))
  );
};

export const registerLlamaHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle('llama:generate', async (event, payload: unknown) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid llama generate sender');
    }
    if (!isLlamaGenerateRequest(payload)) {
      throw new Error('Invalid llama generate payload');
    }

    return generateWithLlama(payload, {
      onProgress: (update) => {
        if (!senderWindow.isDestroyed()) {
          senderWindow.webContents.send('llama:progress', update);
        }
      },
    });
  });

  ipcMain.handle('llama:list-models', async (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid llama list sender');
    }

    return listLlamaModels();
  });

  ipcMain.handle('llama:cancel', async (event, requestId: unknown) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid llama cancel sender');
    }
    if (!isNonEmptyString(requestId)) {
      return false;
    }

    return cancelLlamaRequest(requestId);
  });
};
