import { ipcMain } from 'electron';
import {
  cancelLlamaRequest,
  generateWithLlama,
  listLlamaModels,
} from '../llamaManager';

let isRegistered = false;

export const registerLlamaHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle('llama:generate', async (event, payload) => {
    return generateWithLlama(payload, {
      onProgress: (update) => {
        event.sender.send('llama:progress', update);
      },
    });
  });

  ipcMain.handle('llama:list-models', async () => {
    return listLlamaModels();
  });

  ipcMain.handle('llama:cancel', async (_event, requestId: string) => {
    return cancelLlamaRequest(requestId);
  });
};
