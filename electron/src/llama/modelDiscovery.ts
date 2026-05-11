import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type { LlamaModelInfo } from './types';

const resolveBinaryNameCandidates = (): string[] => {
  if (process.platform === 'win32') {
    return ['llama-completion.exe', 'llama-cli.exe', 'llama.exe', 'main.exe'];
  }
  return ['llama-completion', 'llama-cli', 'llama', 'main'];
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

export const resolveLlamaBinaryPath = (): string | null => {
  const envPath = process.env.SPORTAGLYTICS_LLAMA_PATH || process.env.LLAMA_CPP_PATH;
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

export const listLlamaModels = (): LlamaModelInfo[] => {
  return collectModelsSync();
};

export const resolveModelPath = (model: string): string | null => {
  const normalized = model?.trim();
  const isAuto = !normalized || normalized.toLowerCase() === 'auto';

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
