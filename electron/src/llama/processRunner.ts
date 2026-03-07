import { spawn } from 'child_process';
import { StringDecoder } from 'string_decoder';
import {
  extractJsonCandidate,
  normalizeLlamaOutput,
  truncateLog,
} from './outputNormalizer';
import type { LlamaGenerateResult, LlamaProgressEvent } from './types';
import {
  isLlamaRequestCancelled,
  registerLlamaRequest,
  unregisterLlamaRequest,
} from './requestRegistry';

interface RunLlamaProcessParams {
  binaryPath: string;
  modelPath: string;
  promptPath: string;
  schemaPath: string;
  maxTokens: number;
  temperature: number;
  topP: number;
  topK: number;
  repeatPenalty: number;
  timeoutMs: number;
  requestId?: string;
  onProgress?: (event: LlamaProgressEvent) => void;
  cleanup: () => void;
}

const LOG_VERBOSITY = 1;
const TIMEOUT_MESSAGE = 'llama.cppの応答がタイムアウトしました。';

const buildLlamaArgs = (params: RunLlamaProcessParams): string[] => {
  return [
    '-m',
    params.modelPath,
    '-f',
    params.promptPath,
    '--json-schema-file',
    params.schemaPath,
    '-n',
    String(params.maxTokens),
    '--temp',
    String(params.temperature),
    '--top-p',
    String(params.topP),
    '--top-k',
    String(params.topK),
    '--repeat-penalty',
    String(params.repeatPenalty),
    '--simple-io',
    '--no-display-prompt',
    '-no-cnv',
    '--log-verbosity',
    String(LOG_VERBOSITY),
  ];
};

export const runLlamaProcess = (
  params: RunLlamaProcessParams,
): Promise<LlamaGenerateResult> => {
  const args = buildLlamaArgs(params);
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let wasCancelled = false;
    const child = spawn(params.binaryPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    if (params.requestId) {
      registerLlamaRequest(params.requestId, {
        child,
        cleanup: params.cleanup,
      });
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
      Math.max(20000, Math.floor(params.timeoutMs * 0.25)),
    );

    let lastProgressAt = 0;
    let lastProgressChars = 0;
    const emitProgress = (
      phase: LlamaProgressEvent['phase'],
      extra?: { stderrChunk?: string; stdoutChunk?: string },
    ) => {
      if (!params.requestId || !params.onProgress) return;
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
        params.onProgress({
          requestId: params.requestId,
          phase,
          outputChars: stdout.length,
          elapsedMs: now - startedAt,
          ...extra,
        });
      } catch (_error) {
        // ignore
      }
    };

    const finalizeSuccess = (text: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      params.cleanup();
      if (params.requestId) {
        unregisterLlamaRequest(params.requestId);
        emitProgress('done');
      }
      resolve({
        text: normalizeLlamaOutput(text),
        stderr: stderr ? truncateLog(stderr, 4000) : undefined,
        binaryPath: params.binaryPath,
        modelPath: params.modelPath,
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
      params.cleanup();
      if (params.requestId) {
        unregisterLlamaRequest(params.requestId);
        if (!wasCancelled) {
          emitProgress('error');
        }
      }
      reject(error);
    };

    const handleTimeout = () => {
      if (settled) return;
      try {
        child.kill();
      } catch (_error) {
        // ignore
      }
      if (params.requestId) {
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
      finalizeError(new Error(TIMEOUT_MESSAGE));
    };

    const timer = setTimeout(handleTimeout, params.timeoutMs);
    emitProgress('start');

    child.stdout.on('data', (data) => {
      const chunk = stdoutDecoder.write(data);
      stdout += chunk;
      emitProgress('stdout', { stdoutChunk: chunk });
      if (idleTimer) {
        clearTimeout(idleTimer);
      }
      idleTimer = setTimeout(handleTimeout, idleTimeoutMs);
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
      if (LOG_VERBOSITY > 0 && chunk.trim()) {
        console.info(`[llama.cpp] ${chunk.trim()}`);
      }
      emitProgress('stderr', { stderrChunk: chunk });
    });

    child.on('close', (code) => {
      if (settled) return;
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();

      if (params.requestId && isLlamaRequestCancelled(params.requestId)) {
        wasCancelled = true;
        unregisterLlamaRequest(params.requestId);
        emitProgress('cancelled');
        finalizeError(new Error('llama.cppの生成をキャンセルしました。'));
        return;
      }

      if (code === 0) {
        const candidate = extractJsonCandidate(stdout);
        finalizeSuccess(candidate ?? stdout);
        return;
      }

      const message = stderr.trim() || 'llama.cppが異常終了しました。';
      finalizeError(new Error(message));
    });

    child.on('error', (error) => {
      finalizeError(
        error instanceof Error ? error : new Error('llama.cppが異常終了しました。'),
      );
    });
  });
};
