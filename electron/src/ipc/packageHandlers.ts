import {
  choosePackageContent,
  showPackageRecovery,
} from './packageOpenDialogs';
import { isPackageCaptureActive } from '../liveCapture/captureRegistry';
import { getPackageSessionForPackagePath } from '../packageSessionRegistry';
import path from 'node:path';
import { PackageMigrationIndex } from './packageMigrationIndex';
import { app } from 'electron';
import { refreshAppMenu } from '../menuBar';
import { readMediaFrameWindow } from './mediaFrameService';
import { registerPackageLocation } from '../mediaReferences/packageLocationRegistry';
import { readMediaTimeline } from './mediaTimelineSource';
import { createPackage } from './packageCreationService';
import { applyClipTimeline } from './packageClipTimelineService';
import { preparePackageForOpen } from './legacyPackageMigrationService';
import {
  isNonEmptyString,
  isPackageAnglePayloadArray,
  isPlainObject,
} from './ipcPayloadGuards';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';
import {
  importSportscodePackage,
  isSportscodeImportRequest,
  readSportscodeXmlSource,
} from './sportscodeImportService';

let isRegistered = false;

export const registerPackageHandlers = (): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;
  const migrationIndex = new PackageMigrationIndex(
    path.join(app.getPath('userData'), 'package-migrations.json'),
  );

  registerHandleWithAliases(
    'sportscode:read-xml',
    [],
    async (event, source: unknown) => {
      if (!getValidatedEventSenderWindow(event) || !isNonEmptyString(source))
        throw new Error('Invalid Sportscode XML sender or source');
      return readSportscodeXmlSource(source);
    },
  );
  registerHandleWithAliases(
    'sportscode:import-package',
    [],
    async (event, request: unknown) => {
      if (
        !getValidatedEventSenderWindow(event) ||
        !isSportscodeImportRequest(request)
      )
        throw new Error('Invalid Sportscode import sender or payload');
      return importSportscodePackage(request);
    },
  );

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
    async (event, packagePath: unknown) => {
      const window = getValidatedEventSenderWindow(event);
      if (!window) {
        throw new Error('Invalid package open preparation sender');
      }
      if (!isNonEmptyString(packagePath)) {
        throw new Error('Invalid package path');
      }
      const result = await preparePackageForOpen(packagePath, {
        index: migrationIndex,
        choose: (choice) => choosePackageContent(window, choice),
        assertAvailable: (candidate) => {
          const session = getPackageSessionForPackagePath(candidate);
          if (
            isPackageCaptureActive(candidate) ||
            (session && (session.mainWindow !== window || session.packageBound))
          )
            throw new Error('PACKAGE_UPDATE_BUSY');
        },
      }).catch(async (error: unknown) => {
        if (
          error instanceof Error &&
          error.message.includes('PACKAGE_UPDATE_RECOVERY_REQUIRED')
        )
          await showPackageRecovery(window, packagePath);
        throw error;
      });
      if (result.backupPath)
        result.warning =
          '同じ場所で更新しました。更新前の内容は「ファイル」→「更新前のバックアップ…」から確認・復元できます。';
      if (result.status === 'ready') {
        await registerPackageLocation(result.packagePath);
        try {
          app.addRecentDocument(result.packagePath);
          refreshAppMenu();
        } catch (error) {
          console.warn('Package recent-document update failed', error);
        }
      }
      return result;
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
};
