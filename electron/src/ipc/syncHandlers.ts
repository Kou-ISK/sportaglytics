import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { app } from 'electron';
import ffmpegPath from 'ffmpeg-static';
import {
  isNonEmptyString,
  isPlainObject,
  normalizeSyncDataPayload,
} from './ipcPayloadGuards';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

let isRegistered = false;
const execFileAsync = promisify(execFile);

const getFfmpegPath = (): string => {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary not found');
  }

  return app.isPackaged
    ? ffmpegPath.replace('app.asar', 'app.asar.unpacked')
    : ffmpegPath;
};

const createTempWavPath = (): string => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(os.tmpdir(), `sportaglytics-sync-${unique}.wav`);
};

const extractAudioWavBase64 = async (videoPath: string): Promise<string> => {
  await fs.access(videoPath);
  const tempWavPath = createTempWavPath();

  try {
    await execFileAsync(
      getFfmpegPath(),
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-i',
        videoPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '44100',
        '-t',
        '90',
        tempWavPath,
      ],
      { maxBuffer: 1024 * 1024 },
    );

    const content = await fs.readFile(tempWavPath);
    return content.toString('base64');
  } finally {
    await fs.rm(tempWavPath, { force: true });
  }
};

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

  registerHandleWithAliases(
    'sync:extract-audio-wav',
    ['extract-audio-wav-for-sync'],
    async (event, videoPath: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid sync audio extract sender');
      }
      if (!isNonEmptyString(videoPath)) {
        return null;
      }

      try {
        return await extractAudioWavBase64(videoPath);
      } catch (error) {
        console.error('extract-audio-wav error:', error);
        return null;
      }
    },
  );
};
