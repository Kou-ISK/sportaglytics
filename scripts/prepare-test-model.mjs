import { resolve } from 'node:path';
import { downloadVerified } from './download-verified.mjs';

// Small official instruction model, used only by CI. Never ship model weights.
await downloadVerified(
  'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/9217f5db79a29953eb74d5343926648285ec7e67/qwen2.5-0.5b-instruct-q4_k_m.gguf',
  resolve('.cache/testing/qwen-test.gguf'),
  '74a4da8c9fdbcd15bd1f6d01d621410d31c6fc00986f5eb687824e7b93d7a9db',
);
