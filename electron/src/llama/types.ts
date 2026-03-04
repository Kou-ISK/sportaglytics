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
