import { readMediaFrameWindow } from './mediaFrameService';
import { readMediaTimeline } from './mediaTimelineSource';
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
    'media:frame-window',
    [],
    async (event, source: unknown, time: unknown) => {
      if (!getValidatedEventSenderWindow(event))
        throw new Error('Invalid frame sender');
      if (
        typeof source !== 'string' ||
        source.length > 32768 ||
        typeof time !== 'number'
      )
        throw new Error('Invalid frame payload');
      return readMediaFrameWindow(source, time);
    },
  );

  registerHandleWithAliases(
    'media:resolve-timelines',
    [],
    async (event, sources: unknown) => {
      if (!getValidatedEventSenderWindow(event))
        throw new Error('Invalid media timeline sender');
      if (
        !Array.isArray(sources) ||
        sources.length > 8 ||
        !sources.every(
          (source) =>
            typeof source === 'string' &&
            source.length > 0 &&
            source.length <= 32768,
        )
      )
        throw new Error('Invalid media timeline payload');
      return Promise.all(
        sources.map((source) => readMediaTimeline(source, true)),
      );
    },
  );

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
    async (
      event,
      configPath: unknown,
      placements: unknown,
      angleOffsets: unknown,
    ) => {
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

      if (
        angleOffsets !== undefined &&
        (!Array.isArray(angleOffsets) ||
          angleOffsets.length < 1 ||
          angleOffsets.length > 8 ||
          angleOffsets[0] !== 0 ||
          !angleOffsets.every(
            (value) =>
              typeof value === 'number' &&
              Number.isFinite(value) &&
              Math.abs(value) <= 86_400,
          ))
      )
        throw new Error('Invalid angle offsets');
      return applyClipTimeline(configPath, placements, angleOffsets);
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
