import type { MetaData, VideoAngleConfig } from '../../../../../../types/MetaData';

type LoadedAngle = {
  id: string;
  name: string;
  relativePath: string;
  absolutePath: string;
  role?: 'primary' | 'secondary';
};

const normalizeAngleName = (value: unknown, index: number) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return `Angle ${index + 1}`;
};

const asConfigObject = (config: unknown): Partial<MetaData> & Record<string, unknown> => {
  if (config && typeof config === 'object') {
    return config as Partial<MetaData> & Record<string, unknown>;
  }
  return {};
};

const normalizeRelativePath = (angle: unknown): string | undefined => {
  if (
    angle &&
    typeof angle === 'object' &&
    'relativePath' in angle &&
    typeof (angle as { relativePath?: unknown }).relativePath === 'string'
  ) {
    return (angle as { relativePath: string }).relativePath;
  }

  if (
    angle &&
    typeof angle === 'object' &&
    'path' in angle &&
    typeof (angle as { path?: unknown }).path === 'string'
  ) {
    return (angle as { path: string }).path;
  }

  return undefined;
};

export const resolveAnglesFromConfig = (
  config: unknown,
  packagePath: string,
): {
  angles: LoadedAngle[];
  primaryAngle?: LoadedAngle;
  secondaryAngle?: LoadedAngle;
} => {
  const configObj = asConfigObject(config);
  const anglesRaw = Array.isArray(configObj.angles) ? configObj.angles : [];

  const normalizedAngles: LoadedAngle[] = anglesRaw
    .map((angle, index) => {
      const relativePath = normalizeRelativePath(angle);
      if (!relativePath) return null;
      return {
        id: String(
          (angle as VideoAngleConfig)?.id ||
            (angle as { id?: unknown }).id ||
            (angle as { name?: unknown }).name ||
            `angle-${index + 1}`,
        ),
        name: normalizeAngleName(
          (angle as VideoAngleConfig)?.name ||
            (angle as { name?: unknown }).name,
          index,
        ),
        relativePath,
        absolutePath: `${packagePath}/${relativePath}`,
        role:
          (angle as VideoAngleConfig)?.role === 'primary' ||
          (angle as VideoAngleConfig)?.role === 'secondary'
            ? (angle as VideoAngleConfig).role
            : undefined,
      };
    })
    .filter(Boolean) as LoadedAngle[];

  const primaryAngle =
    normalizedAngles.find((angle) => angle.id === configObj.primaryAngleId) ||
    normalizedAngles.find((angle) => angle.role === 'primary') ||
    normalizedAngles[0];

  const secondaryAngle =
    normalizedAngles.find(
      (angle) =>
        angle.id === configObj.secondaryAngleId &&
        primaryAngle &&
        angle.id !== primaryAngle.id,
    ) ||
    normalizedAngles.find(
      (angle) =>
        angle.role === 'secondary' &&
        primaryAngle &&
        angle.id !== primaryAngle.id,
    );

  return { angles: normalizedAngles, primaryAngle, secondaryAngle };
};

export const buildVideoListFromConfig = (
  config: unknown,
  packagePath: string,
): {
  videoList: string[];
  angles: LoadedAngle[];
} => {
  const configObj = asConfigObject(config);
  const { angles, primaryAngle, secondaryAngle } = resolveAnglesFromConfig(
    config,
    packagePath,
  );

  const tightRelative =
    typeof configObj.tightViewPath === 'string' ? configObj.tightViewPath : '';
  const wideRelative =
    typeof configObj.wideViewPath === 'string' ? configObj.wideViewPath : '';

  const fallbackAngles: LoadedAngle[] =
    angles.length === 0 && tightRelative
      ? [
          {
            id: 'tight',
            name: 'Angle 1',
            relativePath: tightRelative,
            absolutePath: `${packagePath}/${tightRelative}`,
          },
          ...(wideRelative
            ? [
                {
                  id: 'wide',
                  name: 'Angle 2',
                  relativePath: wideRelative,
                  absolutePath: `${packagePath}/${wideRelative}`,
                },
              ]
            : []),
        ]
      : [];

  const resolvedAngles = angles.length ? angles : fallbackAngles;

  const effectivePrimary =
    angles.length > 0
      ? primaryAngle || angles[0]
      : fallbackAngles[0] || undefined;

  const effectiveSecondary =
    angles.length > 0
      ? secondaryAngle ||
        angles.find(
          (angle) => angle.id !== effectivePrimary?.id && angle.role === 'secondary',
        ) ||
        angles.find((angle) => angle.id !== effectivePrimary?.id)
      : fallbackAngles[1];

  const videoList = [
    effectivePrimary?.absolutePath,
    effectiveSecondary?.absolutePath,
  ].filter(Boolean) as string[];

  return { videoList, angles: resolvedAngles };
};
