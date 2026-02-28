import { app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { StringDecoder } from 'string_decoder';

export interface LlamaGenerateRequest {
  prompt: string;
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  maxTokens?: number;
  timeoutMs?: number;
  requestId?: string;
}

export interface LlamaGenerateResult {
  text: string;
  stderr?: string;
  binaryPath?: string;
  modelPath?: string;
  durationMs?: number;
}

export interface LlamaProgressEvent {
  requestId: string;
  phase:
    | 'start'
    | 'stdout'
    | 'stderr'
    | 'done'
    | 'error'
    | 'timeout'
    | 'cancelled';
  outputChars?: number;
  elapsedMs?: number;
  stderrChunk?: string;
  stdoutChunk?: string;
}

export interface LlamaModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
}

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

const resolveBinaryNameCandidates = () => {
  if (process.platform === 'win32') {
    return ['llama-completion.exe', 'llama-cli.exe', 'llama.exe', 'main.exe'];
  }
  return ['llama-completion', 'llama-cli', 'llama', 'main'];
};

const resolveLlamaBinaryPath = (): string | null => {
  const envPath =
    process.env.SPORTAGLYTICS_LLAMA_PATH || process.env.LLAMA_CPP_PATH;
  if (envPath && fs.existsSync(envPath)) {
    return envPath;
  }

  const platformFolder = process.platform;
  const baseCandidates: string[] = [];
  if (app.isPackaged) {
    baseCandidates.push(path.join(process.resourcesPath, 'llama', platformFolder));
    baseCandidates.push(path.join(process.resourcesPath, 'llama'));
  } else {
    baseCandidates.push(path.join(app.getAppPath(), 'public', 'llama', platformFolder));
    baseCandidates.push(path.join(app.getAppPath(), 'public', 'llama'));
    baseCandidates.push(path.join(process.cwd(), 'public', 'llama', platformFolder));
    baseCandidates.push(path.join(process.cwd(), 'public', 'llama'));
  }

  const names = resolveBinaryNameCandidates();
  for (const base of baseCandidates) {
    for (const name of names) {
      const candidate = path.join(base, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
};

const listModelCandidates = (model: string): string[] => {
  const platformFolder = process.platform;
  if (app.isPackaged) {
    return [
      path.join(process.resourcesPath, 'llama', 'models', model),
      path.join(process.resourcesPath, 'llama', platformFolder, 'models', model),
    ];
  }
  return [
    path.join(app.getAppPath(), 'public', 'llama', 'models', model),
    path.join(app.getAppPath(), 'public', 'llama', platformFolder, 'models', model),
    path.join(process.cwd(), 'public', 'llama', 'models', model),
    path.join(process.cwd(), 'public', 'llama', platformFolder, 'models', model),
  ];
};

const getModelSearchFolders = (): string[] => {
  const platformFolder = process.platform;
  if (app.isPackaged) {
    return [
      path.join(process.resourcesPath, 'llama', 'models'),
      path.join(process.resourcesPath, 'llama', platformFolder, 'models'),
    ];
  }
  return [
    path.join(app.getAppPath(), 'public', 'llama', 'models'),
    path.join(app.getAppPath(), 'public', 'llama', platformFolder, 'models'),
    path.join(process.cwd(), 'public', 'llama', 'models'),
    path.join(process.cwd(), 'public', 'llama', platformFolder, 'models'),
  ];
};

const collectModelsSync = (): LlamaModelInfo[] => {
  const results: LlamaModelInfo[] = [];
  const seen = new Set<string>();

  for (const folder of getModelSearchFolders()) {
    if (!fs.existsSync(folder)) continue;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch (_error) {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.gguf')) continue;
      const fullPath = path.join(folder, entry.name);
      if (seen.has(fullPath)) continue;
      try {
        const stat = fs.statSync(fullPath);
        results.push({
          name: entry.name,
          path: fullPath,
          sizeBytes: stat.size,
          modifiedAt: stat.mtimeMs,
        });
        seen.add(fullPath);
      } catch (_error) {
        // ignore
      }
    }
  }

  return results;
};

const pickBestModel = (models: LlamaModelInfo[]): LlamaModelInfo | null => {
  if (models.length === 0) return null;
  return models.reduce<LlamaModelInfo>((best, current) => {
    if (!best) return current;
    if (current.sizeBytes !== best.sizeBytes) {
      return current.sizeBytes > best.sizeBytes ? current : best;
    }
    return current.name.localeCompare(best.name) < 0 ? current : best;
  }, models[0]);
};

export const listLlamaModels = (): LlamaModelInfo[] => {
  return collectModelsSync();
};

const resolveModelPath = (model: string): string | null => {
  const normalized = model?.trim();
  const isAuto =
    !normalized || normalized.toLowerCase() === 'auto';

  if (!isAuto && normalized && path.isAbsolute(normalized) && fs.existsSync(normalized)) {
    return normalized;
  }

  if (!isAuto && normalized) {
    const candidates = listModelCandidates(normalized);
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const fallback = pickBestModel(collectModelsSync());
  return fallback?.path ?? null;
};

const writeTempFile = async (content: string, suffix: string) => {
  const tempDir = app.getPath('temp');
  const filename = `sportaglytics-llama-${Date.now()}-${suffix}`;
  const filePath = path.join(tempDir, filename);
  await fsPromises.writeFile(filePath, content, 'utf-8');
  return filePath;
};

const JSON_SCHEMA = JSON.stringify(
  {
    type: 'object',
    additionalProperties: false,
    required: [
      'summary',
      'hypotheses',
      'evidenceHighlights',
      'recommendedClips',
    ],
    properties: {
      summary: { type: 'string', maxLength: 500 },
      hypotheses: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'evidenceIds'],
          properties: {
            text: { type: 'string', maxLength: 240 },
            evidenceIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 5,
            },
          },
        },
      },
      evidenceHighlights: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'why'],
          properties: {
            id: { type: 'string' },
            why: { type: 'string', maxLength: 160 },
          },
        },
      },
      recommendedClips: {
        type: 'array',
        maxItems: 5,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'title',
            'centerId',
            'preSeconds',
            'postSeconds',
            'reason',
            'evidenceIds',
          ],
          properties: {
            title: { type: 'string', maxLength: 120 },
            centerId: { type: 'string' },
            preSeconds: { type: 'number' },
            postSeconds: { type: 'number' },
            reason: { type: 'string', maxLength: 240 },
            evidenceIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              maxItems: 5,
            },
          },
        },
      },
    },
  },
  null,
  2,
);

const truncateLog = (value: string, maxChars: number) => {
  if (value.length <= maxChars) return value;
  return value.slice(-maxChars);
};

const normalizeLlamaOutput = (value: string) => {
  const cleaned = value.replace(/\s*\[end of text\]\s*/gi, '');
  return cleaned.trim();
};

const hasRequiredKeys = (value: unknown): boolean => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.summary === 'string' &&
    Array.isArray(obj.hypotheses) &&
    Array.isArray(obj.evidenceHighlights) &&
    Array.isArray(obj.recommendedClips)
  );
};

const extractJsonCandidate = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (hasRequiredKeys(parsed)) return trimmed;
  } catch (_error) {
    // continue searching
  }

  const candidates: Array<{ start: number; end: number; text: string }> = [];
  const stack: number[] = [];
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === '{') {
      stack.push(i);
    } else if (ch === '}') {
      const start = stack.pop();
      if (start != null) {
        candidates.push({
          start,
          end: i,
          text: raw.slice(start, i + 1),
        });
      }
    }
  }

  let best: string | null = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.text);
      if (hasRequiredKeys(parsed)) {
        if (!best || candidate.text.length > best.length) {
          best = candidate.text;
        }
      }
    } catch (_error) {
      // ignore
    }
  }

  return best;
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

  const temperature =
    typeof request.temperature === 'number' ? request.temperature : 0.2;
  const topP = typeof request.topP === 'number' ? request.topP : 0.85;
  const topK = typeof request.topK === 'number' ? request.topK : 40;
  const repeatPenalty =
    typeof request.repeatPenalty === 'number' ? request.repeatPenalty : 1.1;
  const maxTokens =
    typeof request.maxTokens === 'number' ? request.maxTokens : 512;
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
      finalizeError(error instanceof Error ? error : new Error('llama.cppが異常終了しました。'));
    });
  });
};
