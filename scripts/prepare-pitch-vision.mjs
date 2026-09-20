import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { downloadVerified } from './download-verified.mjs';

// Runtime never downloads executable code or uploads video. Pin both npm and model bytes.
const destination = resolve('public/pitch-vision');
await mkdir(destination, { recursive: true });
await downloadVerified(
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/int8/1/efficientdet_lite2.tflite',
  resolve(destination, 'efficientdet-lite2.tflite'),
  'b3f50554cb0ea559e90328845f7d9ba4d13c8bff372914d24e06bc8bb72fa896',
);
await cp(
  resolve('node_modules/@mediapipe/tasks-vision/wasm'),
  resolve(destination, 'wasm'),
  { recursive: true },
);
await cp(resolve('resources/pitch-vision'), resolve(destination, 'licenses'), {
  recursive: true,
});
