import { createPackage } from './packageCreationService';
import { applyClipTimeline } from './packageClipTimelineService';
import { convertConfigToRelativePath } from './packageConfigMigrationService';
import { preparePackageForOpen } from './legacyPackageMigrationService';
import {
  isNonEmptyString,
  isPackageAnglePayloadArray,
  isPlainObject,
} from './ipcPayloadGuards';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

let isRegistered = false;

export const registerPackageHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  registerHandleWithAliases(
    'package:create',
    ['create-package'],
    async (
      event,
      directoryName: unknown,
      packageName: unknown,
      angles: unknown,
      metaDataConfig: unknown,
    ) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid package create sender');
      }
      if (
        !isNonEmptyString(directoryName) ||
        !isNonEmptyString(packageName) ||
        !isPackageAnglePayloadArray(angles) ||
        !isPlainObject(metaDataConfig)
      ) {
        throw new Error('Invalid package create payload');
      }

      return createPackage(directoryName, packageName, angles, metaDataConfig);
    },
  );

  registerHandleWithAliases(
    'package:prepare-open',
    [],
    async (event, packagePath: unknown, destinationPath?: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid package open preparation sender');
      }
      if (!isNonEmptyString(packagePath)) {
        throw new Error('Invalid package path');
      }
      if (destinationPath !== undefined && !isNonEmptyString(destinationPath)) {
        throw new Error('Invalid package migration destination');
      }
      return preparePackageForOpen(packagePath, destinationPath);
    },
  );

  registerHandleWithAliases(
    'package:apply-clip-timeline',
    [],
    async (event, configPath: unknown, placements: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid clip timeline sender');
      }
      if (
        !isNonEmptyString(configPath) ||
        !Array.isArray(placements) ||
        placements.length === 0 ||
        placements.length > 128 ||
        !placements.every(
          (placement) =>
            isPlainObject(placement) &&
            isNonEmptyString(placement.clipId) &&
            typeof placement.timelineStartSeconds === 'number' &&
            Number.isFinite(placement.timelineStartSeconds) &&
            placement.timelineStartSeconds >= 0 &&
            placement.timelineStartSeconds <= 86_400 &&
            (placement.durationSeconds === undefined ||
              (typeof placement.durationSeconds === 'number' &&
                Number.isFinite(placement.durationSeconds) &&
                placement.durationSeconds > 0 &&
                placement.durationSeconds <= 86_400 &&
                placement.timelineStartSeconds + placement.durationSeconds <=
                  86_400)),
        )
      ) {
        throw new Error('Invalid clip timeline payload');
      }

      return applyClipTimeline(configPath, placements);
    },
  );

  registerHandleWithAliases(
    'package:convert-config-to-relative-path',
    ['convert-config-to-relative-path'],
    async (event, packagePath: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid package conversion sender');
      }
      if (!isNonEmptyString(packagePath)) {
        return { success: false, error: 'Invalid package path' };
      }

      return convertConfigToRelativePath(packagePath);
    },
  );
};
