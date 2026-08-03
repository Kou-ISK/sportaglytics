import * as fs from 'node:fs/promises';
import { execFile } from 'node:child_process';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { getFfmpegPath } from '../mediaTools';
import {
  isNonEmptyString,
  isPlainObject,
  normalizeSyncDataPayload,
} from './ipcPayloadGuards';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';
import {
  authorizeLoopbackCapture,
  isLoopbackAudioCaptureSupported,
  revokeLoopbackCapture,
} from '../loopbackAudioCapture';

let isRegistered = false;
const execFileAsync = promisify(execFile);

const createTempWavPath = (): string => {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return path.join(os.tmpdir(), `sportaglytics-sync-${unique}.wav`);
};

const extractAudioWavBase64 = async (
  videoPath: string,
  startSeconds = 0,
  durationSeconds = 90,
): Promise<string> => {
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
        '-ss',
        String(startSeconds),
        '-i',
        videoPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '44100',
        '-t',
        String(durationSeconds),
        tempWavPath,
      ],
      {
        maxBuffer: 1024 * 1024,
        timeout: 2 * 60 * 1000,
        killSignal: 'SIGKILL',
      },
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
          angleOffsets: normalizedSyncData.angleOffsets,
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
    'sync:begin-loopback-audio-capture',
    [],
    async (event) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid loopback capture sender');
      }
      if (!isLoopbackAudioCaptureSupported()) return false;
      authorizeLoopbackCapture(event.sender.id);
      return true;
    },
  );

  registerHandleWithAliases(
    'sync:end-loopback-audio-capture',
    [],
    async (event) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid loopback capture sender');
      }
      revokeLoopbackCapture(event.sender.id);
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

  registerHandleWithAliases(
    'sync:extract-audio-window',
    [],
    async (
      event,
      videoPath: unknown,
      startSeconds: unknown,
      durationSeconds: unknown,
    ) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid sync audio window sender');
      }
      if (
        !isNonEmptyString(videoPath) ||
        typeof startSeconds !== 'number' ||
        !Number.isFinite(startSeconds) ||
        startSeconds < 0 ||
        startSeconds > 86_400 ||
        typeof durationSeconds !== 'number' ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0 ||
        durationSeconds > 30
      ) {
        return null;
      }

      try {
        return await extractAudioWavBase64(
          videoPath,
          startSeconds,
          durationSeconds,
        );
      } catch (error) {
        console.error('extract-audio-window error:', error);
        return null;
      }
    },
  );
};
