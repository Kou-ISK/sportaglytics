import type { ObjectDetector } from '@mediapipe/tasks-vision';
import type { PitchDetection } from './pitchRecognition';
import { suppressPitchDuplicates } from './pitchRecognition';

/** An explicitly requested still-frame analysis. All runtime assets ship inside the application. */
const recognizeFrame = async (
  frame: HTMLCanvasElement,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<PitchDetection[]> => {
  const { ObjectDetector, FilesetResolver } =
    await import('@mediapipe/tasks-vision');
  signal.throwIfAborted();
  const root = new URL('./pitch-vision/', document.baseURI).href;
  let detector: ObjectDetector | undefined;
  let wasmUrl: string | undefined;
  try {
    const fileset = await FilesetResolver.forVisionTasks(`${root}wasm`);
    // This SDK's file:// XHR fallback inverts Promise callbacks. A local Blob
    // keeps Electron security enabled and uses the supported fetch/WASM path.
    const wasm = await fetch(fileset.wasmBinaryPath, { signal });
    if (!wasm.ok) throw new Error('同梱の認識エンジンを読み込めませんでした。');
    wasmUrl = URL.createObjectURL(
      new Blob([await wasm.arrayBuffer()], { type: 'application/wasm' }),
    );
    const model = await fetch(`${root}efficientdet-lite2.tflite`, { signal });
    if (!model.ok) throw new Error('同梱の認識モデルを読み込めませんでした。');
    const modelAssetBuffer = new Uint8Array(await model.arrayBuffer());
    signal.throwIfAborted();
    detector = await ObjectDetector.createFromOptions(
      { ...fileset, wasmBinaryPath: wasmUrl },
      {
        baseOptions: {
          modelAssetBuffer,
          delegate: 'CPU',
        },
        runningMode: 'IMAGE',
        scoreThreshold: 0.35,
        categoryAllowlist: ['person', 'sports ball'],
        maxResults: 64,
      },
    );
    signal.throwIfAborted();
    // Overlapping crops retain small, distant players that a single downscaled frame loses.
    const crops = [
      { x: 0, y: 0, width: 1, height: 1 },
      ...[0, 0.4].flatMap((y) =>
        [0, 0.4].map((x) => ({ x, y, width: 0.6, height: 0.6 })),
      ),
    ];
    const tile = document.createElement('canvas');
    const detections: PitchDetection[] = [];
    for (const [index, crop] of crops.entries()) {
      signal.throwIfAborted();
      tile.width = Math.round(frame.width * crop.width);
      tile.height = Math.round(frame.height * crop.height);
      const context = tile.getContext('2d');
      if (!context) throw new Error('映像フレームを読み込めませんでした。');
      context.drawImage(
        frame,
        frame.width * crop.x,
        frame.height * crop.y,
        tile.width,
        tile.height,
        0,
        0,
        tile.width,
        tile.height,
      );
      for (const detection of detector.detect(tile).detections) {
        const box = detection.boundingBox,
          category = detection.categories[0];
        if (!box || !category) continue;
        // A cropped body is not a reliable foot position; overlapping tiles
        // and the whole-frame pass can supply an intact detection instead.
        if (
          index > 0 &&
          (box.originX <= 2 ||
            box.originY <= 2 ||
            box.originX + box.width >= tile.width - 2 ||
            box.originY + box.height >= tile.height - 2)
        )
          continue;
        detections.push({
          x: crop.x + box.originX / frame.width,
          y: crop.y + box.originY / frame.height,
          width: box.width / frame.width,
          height: box.height / frame.height,
          score: category.score,
          kind: category.categoryName === 'sports ball' ? 'ball' : 'neutral',
        });
      }
      onProgress((index + 1) / crops.length);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    signal.throwIfAborted();
    return suppressPitchDuplicates(detections);
  } finally {
    detector?.close();
    if (wasmUrl) URL.revokeObjectURL(wasmUrl);
  }
};

// MediaPipe script/module initialization uses shared browser globals. Serialize
// cancelled/restarted sessions until the previous detector has been closed.
let recognitionQueue: Promise<void> = Promise.resolve();
export const recognizePitchFrame = (
  frame: HTMLCanvasElement,
  signal: AbortSignal,
  onProgress: (progress: number) => void,
): Promise<PitchDetection[]> => {
  const task = recognitionQueue.then(() => {
    signal.throwIfAborted();
    return recognizeFrame(frame, signal, onProgress);
  });
  recognitionQueue = task.then(
    () => {},
    () => {},
  );
  return task;
};

export const capturePitchFrame = (
  video: HTMLVideoElement | null,
): HTMLCanvasElement => {
  if (!video || video.readyState < 2 || !video.videoWidth || video.seeking)
    throw new Error('映像を停止し、読み込みが完了してから再試行してください。');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1920 / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('映像フレームを読み込めませんでした。');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
};
