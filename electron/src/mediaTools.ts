import * as fs from 'node:fs';
import * as path from 'node:path';

const toolNameToEnvKey = {
  ffmpeg: 'SPORTAGLYTICS_FFMPEG_PATH',
  ffprobe: 'SPORTAGLYTICS_FFPROBE_PATH',
} as const;

const getExecutableName = (toolName: 'ffmpeg' | 'ffprobe'): string =>
  process.platform === 'win32' ? `${toolName}.exe` : toolName;

const collectCandidatePaths = (toolName: 'ffmpeg' | 'ffprobe'): string[] => {
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

export const resolveMediaToolPath = (
  toolName: 'ffmpeg' | 'ffprobe',
): string => {
  const envKey = toolNameToEnvKey[toolName];
  const explicitValue = process.env[envKey]?.trim();
  if (explicitValue) {
    return explicitValue;
  }

  const resolved = collectCandidatePaths(toolName).find((candidate) =>
    fs.existsSync(candidate),
  );
  return resolved ?? getExecutableName(toolName);
};

export const getFfmpegPath = (): string => resolveMediaToolPath('ffmpeg');
export const getFfprobePath = (): string => resolveMediaToolPath('ffprobe');
