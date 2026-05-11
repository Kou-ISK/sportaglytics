import { cancelLocalLlmRequest, generateLocalLlm } from './llmGateway';

type LLMProviderType = 'llama.cpp';

interface LLMProviderConfig {
  type: LLMProviderType;
  baseUrl: string;
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  repeatPenalty?: number;
  timeoutMs?: number;
}

interface LLMProviderRequest {
  prompt: string;
  requestId?: string;
  signal?: AbortSignal;
}

interface LLMProviderDebugInfo {
  stderr?: string;
  binaryPath?: string;
  modelPath?: string;
  durationMs?: number;
}

interface LLMProviderResult {
  text: string;
  debug?: LLMProviderDebugInfo;
}

interface LLMProvider {
  type: LLMProviderType;
  generate: (request: LLMProviderRequest) => Promise<LLMProviderResult>;
}

class LocalLLMProvider implements LLMProvider {
  type: LLMProviderType;
  private model: string;
  private temperature: number;
  private topP: number;
  private topK: number;
  private repeatPenalty: number;
  private timeoutMs: number;

  constructor(config: LLMProviderConfig) {
    this.type = config.type;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.2;
    this.topP = config.topP ?? 0.85;
    this.topK = config.topK ?? 40;
    this.repeatPenalty = config.repeatPenalty ?? 1.1;
    this.timeoutMs = config.timeoutMs ?? 180000;
  }

  async generate(request: LLMProviderRequest): Promise<LLMProviderResult> {
    return this.callLlamaCpp(request.prompt, request.requestId, request.signal);
  }

  private async callLlamaCpp(
    prompt: string,
    requestId?: string,
    signal?: AbortSignal,
  ): Promise<LLMProviderResult> {
    if (signal?.aborted) {
      throw new Error('生成がキャンセルされました。');
    }
    const abortHandler = () => {
      if (requestId) {
        void cancelLocalLlmRequest(requestId);
      }
    };
    if (signal) {
      signal.addEventListener('abort', abortHandler, { once: true });
    }
    let result: {
      text?: string;
      stderr?: string;
      binaryPath?: string;
      modelPath?: string;
      durationMs?: number;
    } | null = null;
    try {
      result = await generateLocalLlm({
        prompt,
        model: this.model,
        temperature: this.temperature,
        topP: this.topP,
        topK: this.topK,
        repeatPenalty: this.repeatPenalty,
        maxTokens: 768,
        timeoutMs: this.timeoutMs,
        requestId,
      });
    } finally {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    }
    if (!result?.text) {
      throw new Error('llama.cppの応答が空です。');
    }
    return {
      text: result.text,
      debug: {
        stderr: result.stderr,
        binaryPath: result.binaryPath,
        modelPath: result.modelPath,
        durationMs: result.durationMs,
      },
    };
  }
}

export const createLLMProvider = (config: LLMProviderConfig): LLMProvider => {
  return new LocalLLMProvider(config);
};
