import { app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import { StringDecoder } from 'string_decoder';
import {
  listLlamaModels as discoverLlamaModels,
  resolveLlamaBinaryPath,
  resolveModelPath,
} from './llama/modelDiscovery';
import {
  extractJsonCandidate,
  JSON_SCHEMA,
  normalizeLlamaOutput,
  truncateLog,
} from './llama/outputNormalizer';
import type {
  LlamaGenerateRequest,
  LlamaGenerateResult,
  LlamaModelInfo,
  LlamaProgressEvent,
} from './llama/types';

export type {
  LlamaGenerateRequest,
  LlamaGenerateResult,
  LlamaModelInfo,
  LlamaProgressEvent,
} from './llama/types';

const activeRequests = new Map<
  string,
  { child: ChildProcess; cleanup: () => void; cancelled: boolean }
>();

export const cancelLlamaRequest = (requestId: string): boolean => {
  if (!requestId) return false;
  const entry = activeRequests.get(requestId);
  if (!entry) return false;
  entry.cancelled = true;
  try {
    entry.cleanup?.();
  } catch (_error) {
    // ignore
  }
  try {
    entry.child.kill();
  } catch (_error) {
    // ignore
  }
  return true;
};

const writeTempFile = async (content: string, suffix: string): Promise<string> => {
  const tempDir = app.getPath('temp');
  const filename = `sportaglytics-llama-${Date.now()}-${suffix}`;
  const filePath = path.join(tempDir, filename);
  await fsPromises.writeFile(filePath, content, 'utf-8');
  return filePath;
};

export const listLlamaModels = (): LlamaModelInfo[] => {
  return discoverLlamaModels();
};

export const generateWithLlama = async (
  request: LlamaGenerateRequest,
  options?: { onProgress?: (event: LlamaProgressEvent) => void },
): Promise<LlamaGenerateResult> => {
  const binaryPath = resolveLlamaBinaryPath();
  if (!binaryPath) {
    throw new Error('llama.cppバイナリが見つかりませんでした。');
  }

  const modelPath = resolveModelPath(request.model);
  if (!modelPath) {
    throw new Error('llama.cppモデルファイルが見つかりませんでした。');
  }

  const temperature = typeof request.temperature === 'number' ? request.temperature : 0.2;
  const topP = typeof request.topP === 'number' ? request.topP : 0.85;
  const topK = typeof request.topK === 'number' ? request.topK : 40;
  const repeatPenalty =
    typeof request.repeatPenalty === 'number' ? request.repeatPenalty : 1.1;
  const maxTokens = typeof request.maxTokens === 'number' ? request.maxTokens : 512;
  const timeoutMs = request.timeoutMs ?? 300000;
  const requestId = request.requestId?.trim() || undefined;

  const promptPath = await writeTempFile(request.prompt, 'prompt.txt');
  const schemaPath = await writeTempFile(JSON_SCHEMA, 'schema.json');
  const logVerbosity = 1;
  const args = [
    '-m',
    modelPath,
    '-f',
    promptPath,
    '--json-schema-file',
    schemaPath,
    '-n',
    String(maxTokens),
    '--temp',
    String(temperature),
    '--top-p',
    String(topP),
    '--top-k',
    String(topK),
    '--repeat-penalty',
    String(repeatPenalty),
    '--simple-io',
    '--no-display-prompt',
    '-no-cnv',
    '--log-verbosity',
    String(logVerbosity),
  ];

  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    let wasCancelled = false;
    const cleanup = () => {
      fsPromises.unlink(promptPath).catch(() => undefined);
      fsPromises.unlink(schemaPath).catch(() => undefined);
    };

    const child = spawn(binaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    if (requestId) {
      activeRequests.set(requestId, { child, cleanup, cancelled: false });
    }
    try {
      child.stdin?.end();
    } catch (_error) {
      // ignore
    }

    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');
    let stdout = '';
    let stderr = '';
    let settled = false;
    let idleTimer: NodeJS.Timeout | null = null;
    const idleTimeoutMs = Math.min(
      60000,
      Math.max(20000, Math.floor(timeoutMs * 0.25)),
    );

    let lastProgressAt = 0;
    let lastProgressChars = 0;
    const emitProgress = (
      phase: LlamaProgressEvent['phase'],
      extra?: { stderrChunk?: string; stdoutChunk?: string },
    ) => {
      if (!requestId || !options?.onProgress) return;
      const now = Date.now();
      if (
        phase === 'stdout' &&
        now - lastProgressAt < 400 &&
        stdout.length - lastProgressChars < 200
      ) {
        return;
      }
      lastProgressAt = now;
      lastProgressChars = stdout.length;
      try {
        options.onProgress({
          requestId,
          phase,
          outputChars: stdout.length,
          elapsedMs: now - startedAt,
          ...extra,
        });
      } catch (_error) {
        // ignore
      }
    };

    emitProgress('start');

    const finalizeSuccess = (text: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      cleanup();
      if (requestId) {
        activeRequests.delete(requestId);
        emitProgress('done');
      }
      resolve({
        text: normalizeLlamaOutput(text),
        stderr: stderr ? truncateLog(stderr, 4000) : undefined,
        binaryPath,
        modelPath,
        durationMs: Date.now() - startedAt,
      });
      try {
        child.kill();
      } catch (_error) {
        // ignore
      }
    };

    const finalizeError = (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      cleanup();
      if (requestId) {
        activeRequests.delete(requestId);
        if (!wasCancelled) {
          emitProgress('error');
        }
      }
      reject(error);
    };

    const handleTimeout = (reason: string) => {
      if (settled) return;
      try {
        child.kill();
      } catch (_error) {
        // ignore
      }
      if (requestId) {
        emitProgress('timeout');
      }
      const candidate = extractJsonCandidate(stdout);
      if (candidate) {
        stderr += '\n[timeout]';
        finalizeSuccess(candidate);
        return;
      }
      if (stdout.trim()) {
        stderr += '\n[timeout]';
        finalizeSuccess(stdout);
        return;
      }
      finalizeError(new Error(reason));
    };

    const timer = setTimeout(() => {
      handleTimeout('llama.cppの応答がタイムアウトしました。');
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      const chunk = stdoutDecoder.write(data);
      stdout += chunk;
      emitProgress('stdout', { stdoutChunk: chunk });
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(() => {
        handleTimeout('llama.cppの応答がタイムアウトしました。');
      }, idleTimeoutMs);
      if (!settled && stdout.includes('{') && stdout.includes('}')) {
        const candidate = extractJsonCandidate(stdout);
        if (candidate) {
          finalizeSuccess(candidate);
        }
      }
    });

    child.stderr.on('data', (data) => {
      const chunk = stderrDecoder.write(data);
      stderr += chunk;
      if (logVerbosity > 0 && chunk.trim()) {
        console.info(`[llama.cpp] ${chunk.trim()}`);
      }
      emitProgress('stderr', { stderrChunk: chunk });
    });

    child.on('close', (code) => {
      if (settled) return;
      clearTimeout(timer);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      cleanup();
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      if (requestId) {
        const entry = activeRequests.get(requestId);
        if (entry?.cancelled) {
          wasCancelled = true;
          activeRequests.delete(requestId);
          emitProgress('cancelled');
          finalizeError(new Error('llama.cppの生成をキャンセルしました。'));
          return;
        }
      }
      if (code === 0) {
        const candidate = extractJsonCandidate(stdout);
        finalizeSuccess(candidate ?? stdout);
      } else {
        const message = stderr.trim() || 'llama.cppが異常終了しました。';
        finalizeError(new Error(message));
      }
    });

    child.on('error', (error) => {
      finalizeError(
        error instanceof Error
          ? error
          : new Error('llama.cppが異常終了しました。'),
      );
    });
  });
};
