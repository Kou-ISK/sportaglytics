import * as fs from 'node:fs/promises';
import { registerHandleWithAliases } from './registerHandleWithAliases';

let isRegistered = false;

export const registerSyncHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  registerHandleWithAliases(
    'sync:save-data',
    ['save-sync-data'],
    async (
      _event,
      configPath: string,
      syncData: {
        syncOffset: number;
        isAnalyzed: boolean;
        confidenceScore?: number;
      },
    ) => {
      try {
        const raw = await fs.readFile(configPath, 'utf-8');
        const json = JSON.parse(raw || '{}');
        json.syncData = {
          syncOffset: Number(syncData?.syncOffset) || 0,
          isAnalyzed: !!syncData?.isAnalyzed,
          confidenceScore:
            typeof syncData?.confidenceScore === 'number'
              ? syncData.confidenceScore
              : undefined,
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
