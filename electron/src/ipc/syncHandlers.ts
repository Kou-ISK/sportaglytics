import * as fs from 'node:fs/promises';
import {
  isNonEmptyString,
  isPlainObject,
  normalizeSyncDataPayload,
} from './ipcPayloadGuards';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

let isRegistered = false;

export const registerSyncHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  registerHandleWithAliases(
    'sync:save-data',
    ['save-sync-data'],
    async (event, configPath: unknown, syncData: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid sync save sender');
      }

      const normalizedSyncData = normalizeSyncDataPayload(syncData);
      if (!isNonEmptyString(configPath) || !normalizedSyncData) {
        return false;
      }

      try {
        const raw = await fs.readFile(configPath, 'utf-8');
        const parsed = JSON.parse(raw || '{}') as unknown;
        const json = isPlainObject(parsed) ? parsed : {};
        json.syncData = {
          syncOffset: normalizedSyncData.syncOffset,
          isAnalyzed: normalizedSyncData.isAnalyzed,
          confidenceScore: normalizedSyncData.confidenceScore,
        };
        await fs.writeFile(configPath, JSON.stringify(json, null, 2), 'utf-8');
        return true;
      } catch (error) {
        console.error('save-sync-data error:', error);
        return false;
      }
    },
  );
};
