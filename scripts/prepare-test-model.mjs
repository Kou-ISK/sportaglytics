import { resolve } from 'node:path';
import { downloadVerified } from './download-verified.mjs';

// Tiny public llama.cpp test model, used only by CI. Never ship model weights.
await downloadVerified(
  'https://huggingface.co/ggml-org/models/resolve/499bc8821c6b12b4e53c5bffcb21ec206f212d81/tinyllamas/stories15M-q4_0.gguf',
  resolve('.cache/testing/stories15M.gguf'),
  '66967fbece6dbe97886593fdbb73589584927e29119ec31f08090732d1861739',
);
