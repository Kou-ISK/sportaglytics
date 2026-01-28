import { app } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { StringDecoder } from 'string_decoder';

export interface LlamaGenerateRequest {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlamaGenerateResult {
  text: string;
  stderr?: string;
  binaryPath?: string;
  modelPath?: string;
  durationMs?: number;
}

export interface LlamaModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
}

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
      summary: { type: 'string', maxLength: 400 },
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

export const generateWithLlama = async (
  request: LlamaGenerateRequest,
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
  const maxTokens =
    typeof request.maxTokens === 'number' ? request.maxTokens : 512;
  const timeoutMs = request.timeoutMs ?? 180000;

  const promptPath = await writeTempFile(request.prompt, 'prompt.txt');
  const schemaPath = await writeTempFile(JSON_SCHEMA, 'schema.json');
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
    '--simple-io',
    '--no-display-prompt',
    '-no-cnv',
    '--log-verbosity',
    '0',
  ];

  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch (_error) {
        // ignore
      }
      reject(new Error('llama.cppの応答がタイムアウトしました。'));
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdout += stdoutDecoder.write(data);
    });

    child.stderr.on('data', (data) => {
      stderr += stderrDecoder.write(data);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      fsPromises.unlink(promptPath).catch(() => undefined);
      fsPromises.unlink(schemaPath).catch(() => undefined);
      stdout += stdoutDecoder.end();
      stderr += stderrDecoder.end();
      if (code === 0) {
        resolve({
          text: normalizeLlamaOutput(stdout),
          stderr: stderr ? truncateLog(stderr, 4000) : undefined,
          binaryPath,
          modelPath,
          durationMs: Date.now() - startedAt,
        });
      } else {
        const message = stderr.trim() || 'llama.cppが異常終了しました。';
        reject(new Error(message));
      }
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      fsPromises.unlink(promptPath).catch(() => undefined);
      fsPromises.unlink(schemaPath).catch(() => undefined);
      reject(error);
    });
  });
};
