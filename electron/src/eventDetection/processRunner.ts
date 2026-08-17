import { spawn } from 'child_process';
import { app } from 'electron';
import { readFile, stat, unlink, writeFile } from 'fs/promises';
import * as path from 'path';
import type {
  EventDetectionProgress,
  EventDetectionRequest,
  EventDetectionResult,
} from '../../../src/types/eventDetection/core';
import { isEventDetectionResult } from '../../../src/types/ipc/eventDetection';
import type { VerifiedEventDetectionModel } from './types';
import {
  registerEventDetectionProcess,
  unregisterEventDetectionProcess,
} from './requestRegistry';

const DEFAULT_TIMEOUT_MS = 90 * 60 * 1000;
const MAX_STDERR_BYTES = 64 * 1024;
const MAX_RESULT_BYTES = 20 * 1024 * 1024;

interface RunEventDetectionParams {
  model: VerifiedEventDetectionModel;
  request: EventDetectionRequest;
  timeoutMs?: number;
  onProgress?: (progress: EventDetectionProgress) => void;
}

const removeFile = async (filePath: string): Promise<void> => {
  await unlink(filePath).catch(() => undefined);
};

const validateResultForRequest = (
  result: EventDetectionResult,
  request: EventDetectionRequest,
  model: VerifiedEventDetectionModel,
): void => {
  if (
    result.requestId !== request.requestId ||
    result.modelId !== request.modelId ||
    result.modelVersion !== request.modelVersion
  ) {
    throw new Error('Event detector returned a result for a different request.');
  }

  const requestedEvents = new Set(request.events);
  const supportedEvents = new Set(model.info.events);
  const hasUnsupportedCandidate = result.candidates.some(
    (candidate) =>
      !requestedEvents.has(candidate.eventType) ||
      !supportedEvents.has(candidate.eventType),
  );
  if (hasUnsupportedCandidate) {
    throw new Error('Event detector returned an unsupported event class.');
  }
};

export const runEventDetectionProcess = async ({
  model,
  request,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onProgress,
}: RunEventDetectionParams): Promise<EventDetectionResult> => {
  const tempDirectory = app.getPath('temp');
  const safeRequestId = request.requestId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const requestPath = path.join(
    tempDirectory,
    `sportaglytics-event-${safeRequestId}-${nonce}-request.json`,
  );
  const outputPath = path.join(
    tempDirectory,
    `sportaglytics-event-${safeRequestId}-${nonce}-result.json`,
  );

  await writeFile(requestPath, JSON.stringify(request), {
    encoding: 'utf-8',
    mode: 0o600,
  });

  onProgress?.({
    requestId: request.requestId,
    stage: 'preparing',
    progress: 0.05,
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        model.runnerPath,
        [
          '--request',
          requestPath,
          '--output',
          outputPath,
          '--model-dir',
          model.modelDirectory,
        ],
        {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'ignore', 'pipe'],
        },
      );
      registerEventDetectionProcess(request.requestId, child);

      let stderr = '';
      child.stderr.on('data', (chunk: Buffer) => {
        if (stderr.length >= MAX_STDERR_BYTES) return;
        stderr += chunk.toString('utf-8').slice(0, MAX_STDERR_BYTES - stderr.length);
      });

      onProgress?.({
        requestId: request.requestId,
        stage: 'analyzing',
        progress: 0.1,
      });

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Event detection timed out.'));
      }, Math.max(1_000, timeoutMs));

      child.once('error', (error) => {
        clearTimeout(timeout);
        unregisterEventDetectionProcess(request.requestId);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timeout);
        unregisterEventDetectionProcess(request.requestId);
        if (code === 0) {
          resolve();
          return;
        }
        const detail = stderr.trim();
        reject(
          new Error(
            `Event detector exited abnormally (${signal ?? code ?? 'unknown'}).${
              detail ? ` ${detail}` : ''
            }`,
          ),
        );
      });
    });

    onProgress?.({
      requestId: request.requestId,
      stage: 'finalizing',
      progress: 0.95,
    });

    const outputStats = await stat(outputPath);
    if (outputStats.size > MAX_RESULT_BYTES) {
      throw new Error('Event detector result exceeded the maximum allowed size.');
    }
    const raw = await readFile(outputPath, 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!isEventDetectionResult(parsed)) {
      throw new Error('Event detector returned an invalid result.');
    }
    validateResultForRequest(parsed, request, model);

    onProgress?.({
      requestId: request.requestId,
      stage: 'finalizing',
      progress: 1,
    });
    return parsed;
  } finally {
    await Promise.all([removeFile(requestPath), removeFile(outputPath)]);
  }
};
