import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

type MediaToolName = 'ffmpeg' | 'ffprobe';

const normalizeArch = (arch: NodeJS.Architecture): 'arm64' | 'x64' => {
  if (arch === 'arm64' || arch === 'x64') return arch;
  throw new Error(`Unsupported media tool architecture: ${arch}`);
};

const findOnPath = (tool: MediaToolName): string | null => {
  const executable = process.platform === 'win32' ? `${tool}.exe` : tool;
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const getDevelopmentToolPath = (tool: MediaToolName): string => {
  const environmentPath =
    tool === 'ffmpeg'
      ? process.env.SPORTAGLYTICS_FFMPEG_PATH
      : process.env.SPORTAGLYTICS_FFPROBE_PATH;
  if (environmentPath && fs.existsSync(environmentPath)) {
    return environmentPath;
  }

  const cachedPath = path.resolve(
    process.cwd(),
    '.cache',
    'media-tools',
    `${process.platform}-${normalizeArch(process.arch)}`,
    tool,
  );
  if (fs.existsSync(cachedPath)) return cachedPath;

  const systemPath = findOnPath(tool);
  if (systemPath) return systemPath;

  throw new Error(
    `${tool} が見つかりません。pnpm run media:build を実行してください。`,
  );
};

export const getMediaToolPath = (tool: MediaToolName): string => {
  if (!app.isPackaged) return getDevelopmentToolPath(tool);

  const executable = process.platform === 'win32' ? `${tool}.exe` : tool;
  const packagedPath = path.join(
    process.resourcesPath,
    'media-tools',
    executable,
  );
  if (!fs.existsSync(packagedPath)) {
    throw new Error(`Packaged ${tool} binary not found`);
  }
  return packagedPath;
};

export const getFfmpegPath = (): string => getMediaToolPath('ffmpeg');

export const getFfprobePath = (): string => getMediaToolPath('ffprobe');

export const H264_ENCODER_ARGS: readonly string[] = [
  '-c:v',
  'h264_videotoolbox',
  '-b:v',
  '8M',
  '-allow_sw',
  '1',
];
