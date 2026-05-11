import { app } from 'electron';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import {
  listLlamaModels as discoverLlamaModels,
  resolveLlamaBinaryPath,
  resolveModelPath,
} from './llama/modelDiscovery';
import { JSON_SCHEMA } from './llama/outputNormalizer';
import { runLlamaProcess } from './llama/processRunner';
import { cancelRegisteredLlamaRequest } from './llama/requestRegistry';
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

const writeTempFile = async (content: string, suffix: string): Promise<string> => {
  const tempDir = app.getPath('temp');
  const filename = `sportaglytics-llama-${Date.now()}-${suffix}`;
  const filePath = path.join(tempDir, filename);
  await fsPromises.writeFile(filePath, content, 'utf-8');
  return filePath;
};

const toCleanup = (paths: string[]) => {
  return () => {
    for (const filePath of paths) {
      fsPromises.unlink(filePath).catch(() => undefined);
    }
  };
};

const normalizeRequestOptions = (request: LlamaGenerateRequest) => {
  return {
    temperature: typeof request.temperature === 'number' ? request.temperature : 0.2,
    topP: typeof request.topP === 'number' ? request.topP : 0.85,
    topK: typeof request.topK === 'number' ? request.topK : 40,
    repeatPenalty:
      typeof request.repeatPenalty === 'number' ? request.repeatPenalty : 1.1,
    maxTokens: typeof request.maxTokens === 'number' ? request.maxTokens : 512,
    timeoutMs: request.timeoutMs ?? 300000,
    requestId: request.requestId?.trim() || undefined,
  };
};

export const cancelLlamaRequest = (requestId: string): boolean => {
  return cancelRegisteredLlamaRequest(requestId);
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

  const promptPath = await writeTempFile(request.prompt, 'prompt.txt');
  const schemaPath = await writeTempFile(JSON_SCHEMA, 'schema.json');
  const normalized = normalizeRequestOptions(request);

  return runLlamaProcess({
    binaryPath,
    modelPath,
    promptPath,
    schemaPath,
    maxTokens: normalized.maxTokens,
    temperature: normalized.temperature,
    topP: normalized.topP,
    topK: normalized.topK,
    repeatPenalty: normalized.repeatPenalty,
    timeoutMs: normalized.timeoutMs,
    requestId: normalized.requestId,
    onProgress: options?.onProgress,
    cleanup: toCleanup([promptPath, schemaPath]),
  });
};
