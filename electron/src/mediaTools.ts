import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';

type MediaToolName = 'ffmpeg' | 'ffprobe';

const toolNameToEnvKey = {
  ffmpeg: 'SPORTAGLYTICS_FFMPEG_PATH',
  ffprobe: 'SPORTAGLYTICS_FFPROBE_PATH',
} as const;

const normalizeArch = (arch: NodeJS.Architecture): 'arm64' | 'x64' => {
  if (arch === 'arm64' || arch === 'x64') return arch;
  throw new Error(`Unsupported media tool architecture: ${arch}`);
};

const getExecutableName = (toolName: MediaToolName): string =>
  process.platform === 'win32' ? `${toolName}.exe` : toolName;

const findOnPath = (tool: MediaToolName): string | null => {
  const executable = getExecutableName(tool);
  for (const directory of (process.env.PATH ?? '').split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, executable);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};

const collectCandidatePaths = (toolName: MediaToolName): string[] => {
  const executableName = getExecutableName(toolName);
  const roots = [
    process.cwd(),
    path.resolve(process.cwd(), 'build'),
    path.resolve(process.cwd(), 'dist'),
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'resources'),
    path.resolve(process.cwd(), 'node_modules', '.bin'),
    path.resolve(process.cwd(), '..'),
    path.resolve(process.cwd(), '..', '..'),
  ];

  const candidates: string[] = [];
  for (const root of roots) {
    candidates.push(path.join(root, executableName));
    candidates.push(path.join(root, 'bin', executableName));
    candidates.push(path.join(root, 'tools', executableName));
    candidates.push(path.join(root, 'media-tools', executableName));
    candidates.push(
      path.join(root, 'resources', 'media-tools', executableName),
    );
    candidates.push(path.join(root, 'build', 'media-tools', executableName));
    candidates.push(path.join(root, 'dist', 'media-tools', executableName));
    candidates.push(path.join(root, toolName, executableName));
  }

  return candidates;
};

const getDevelopmentToolPath = (tool: MediaToolName): string => {
  const envKey = toolNameToEnvKey[tool];
  const environmentPath = process.env[envKey]?.trim();
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

  const resolved = collectCandidatePaths(tool).find((candidate) =>
    fs.existsSync(candidate),
  );
  if (resolved) return resolved;

  const systemPath = findOnPath(tool);
  if (systemPath) return systemPath;

  throw new Error(
    `${tool} が見つかりません。pnpm run media:build を実行してください。`,
  );
};

export const getMediaToolPath = (tool: MediaToolName): string => {
  if (!app.isPackaged) return getDevelopmentToolPath(tool);

  const executable = getExecutableName(tool);
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

export type H264EncoderBackend = 'videotoolbox' | 'libx264';

export interface H264EncoderConfiguration {
  backend: H264EncoderBackend;
  args: readonly string[];
}

/**
 * Resolve the encoder to match the media toolchain available on the target.
 *
 * The packaged macOS FFmpeg is deliberately built without external codec
 * libraries (including libx264), so VideoToolbox is the only supported H.264
 * encoder there. Keeping libx264 for non-macOS development environments
 * preserves the existing local workflow until another verified toolchain is
 * introduced for those platforms.
 */
export const resolveH264Encoder = (
  platform: NodeJS.Platform = process.platform,
): H264EncoderConfiguration => {
  if (platform === 'darwin') {
    return {
      backend: 'videotoolbox',
      // VideoToolbox does not use libx264's preset/crf options. Use a stable
      // bitrate policy and an MP4-compatible pixel format instead.
      args: [
        '-c:v',
        'h264_videotoolbox',
        '-b:v',
        '5M',
        '-profile:v',
        'main',
        '-pix_fmt',
        'yuv420p',
      ],
    };
  }

  return {
    backend: 'libx264',
    args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20'],
  };
};

export const H264_ENCODER_ARGS: readonly string[] =
  resolveH264Encoder().args;
