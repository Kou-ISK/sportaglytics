export interface LocalLlmGeneratePayload {
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

export interface LocalLlmGenerateResult {
  text: string;
  stderr?: string;
  binaryPath?: string;
  modelPath?: string;
  durationMs?: number;
}

export interface LocalLlmModelInfo {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt?: number;
}

const noop = (): void => undefined;

const getLlamaApi = ():
  | NonNullable<Window['electronAPI']>['llama']
  | undefined => {
  return globalThis.window.electronAPI?.llama;
};

export const generateLocalLlm = async (
  payload: LocalLlmGeneratePayload,
): Promise<LocalLlmGenerateResult> => {
  const llamaApi = getLlamaApi();
  if (!llamaApi?.generate) {
    throw new Error('llama.cpp APIが利用できません。');
  }

  return await llamaApi.generate(payload);
};

export const cancelLocalLlmRequest = async (
  requestId: string,
): Promise<boolean> => {
  const llamaApi = getLlamaApi();
  if (!llamaApi?.cancel) {
    return false;
  }

  try {
    return await llamaApi.cancel(requestId);
  } catch (error: unknown) {
    console.debug('[llmGateway] cancel failed', error);
    return false;
  }
};

export const canListLocalLlmModels = (): boolean => {
  return Boolean(getLlamaApi()?.listModels);
};

export const listLocalLlmModels = async (): Promise<LocalLlmModelInfo[]> => {
  const llamaApi = getLlamaApi();
  if (!llamaApi?.listModels) {
    return [];
  }

  try {
    return await llamaApi.listModels();
  } catch (error: unknown) {
    console.debug('[llmGateway] listModels failed', error);
    return [];
  }
};

export const canSubscribeLocalLlmProgress = (): boolean => {
  return Boolean(getLlamaApi()?.onProgress);
};

export const subscribeLocalLlmProgress = (
  callback: (payload: unknown) => void,
): (() => void) => {
  const llamaApi = getLlamaApi();
  if (!llamaApi?.onProgress) {
    return noop;
  }

  try {
    llamaApi.onProgress(callback);
    return () => {
      llamaApi.offProgress?.(callback);
    };
  } catch (error: unknown) {
    console.debug('[llmGateway] subscribe progress failed', error);
    return noop;
  }
};
