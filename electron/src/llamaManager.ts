import { app } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

export interface LlamaGenerateRequest {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlamaGenerateResult {
  text: string;
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

const findAnyModelFile = (folders: string[]): string | null => {
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    try {
      const entries = fs.readdirSync(folder);
      const gguf = entries.find((entry) => entry.toLowerCase().endsWith('.gguf'));
      if (gguf) {
        const candidate = path.join(folder, gguf);
        if (fs.existsSync(candidate)) return candidate;
      }
    } catch (_error) {
      // ignore
    }
  }
  return null;
};

const resolveModelPath = (model: string): string | null => {
  if (model && path.isAbsolute(model) && fs.existsSync(model)) {
    return model;
  }

  const candidates = model ? listModelCandidates(model) : [];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  const fallbackFolders = model
    ? candidates.map((candidate) => path.dirname(candidate))
    : listModelCandidates('placeholder.gguf').map((candidate) =>
        path.dirname(candidate),
      );
  return findAnyModelFile(fallbackFolders);
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
      summary: { type: 'string' },
      hypotheses: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'evidenceIds'],
          properties: {
            text: { type: 'string' },
            evidenceIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
          },
        },
      },
      evidenceHighlights: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'why'],
          properties: {
            id: { type: 'string' },
            why: { type: 'string' },
          },
        },
      },
      recommendedClips: {
        type: 'array',
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
            title: { type: 'string' },
            centerId: { type: 'string' },
            preSeconds: { type: 'number' },
            postSeconds: { type: 'number' },
            reason: { type: 'string' },
            evidenceIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
            },
          },
        },
      },
    },
  },
  null,
  2,
);

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
    '--no-display-prompt',
    '-no-cnv',
    '--log-verbosity',
    '0',
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

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
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      fsPromises.unlink(promptPath).catch(() => undefined);
      fsPromises.unlink(schemaPath).catch(() => undefined);
      if (code === 0) {
        resolve({ text: stdout.trim() });
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
