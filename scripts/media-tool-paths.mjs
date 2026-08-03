import { existsSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

const findTool = (tool, environmentName) => {
  const configured = process.env[environmentName];
  if (configured && existsSync(configured)) return configured;

  const cached = resolve(
    '.cache',
    'media-tools',
    `${process.platform}-${process.arch}`,
    tool,
  );
  if (existsSync(cached)) return cached;

  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, tool);
    if (directory && existsSync(candidate)) return candidate;
  }
  throw new Error(`${tool} not found; run pnpm run media:build`);
};

export const ffmpegPath = findTool('ffmpeg', 'SPORTAGLYTICS_FFMPEG_PATH');
export const ffprobePath = findTool('ffprobe', 'SPORTAGLYTICS_FFPROBE_PATH');
