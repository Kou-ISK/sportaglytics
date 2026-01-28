export type LLMProviderType = 'llama.cpp';

export interface LLMProviderConfig {
  type: LLMProviderType;
  baseUrl: string;
  model: string;
  temperature?: number;
  timeoutMs?: number;
}

export interface LLMProviderRequest {
  prompt: string;
}

export interface LLMProvider {
  type: LLMProviderType;
  generate: (request: LLMProviderRequest) => Promise<string>;
}

class LocalLLMProvider implements LLMProvider {
  type: LLMProviderType;
  private model: string;
  private temperature: number;
  private timeoutMs: number;

  constructor(config: LLMProviderConfig) {
    this.type = config.type;
    this.model = config.model;
    this.temperature = config.temperature ?? 0.2;
    this.timeoutMs = config.timeoutMs ?? 180000;
  }

  async generate(request: LLMProviderRequest): Promise<string> {
    return this.callLlamaCpp(request.prompt);
  }

  private async callLlamaCpp(prompt: string): Promise<string> {
    const llamaApi = globalThis.window?.electronAPI?.llama;
    if (!llamaApi?.generate) {
      throw new Error('llama.cpp APIが利用できません。');
    }
    const result = await llamaApi.generate({
      prompt,
      model: this.model,
      temperature: this.temperature,
      maxTokens: 512,
      timeoutMs: this.timeoutMs,
    });
    if (!result?.text) {
      throw new Error('llama.cppの応答が空です。');
    }
    return result.text;
  }
}

export const createLLMProvider = (config: LLMProviderConfig): LLMProvider => {
  return new LocalLLMProvider(config);
};
