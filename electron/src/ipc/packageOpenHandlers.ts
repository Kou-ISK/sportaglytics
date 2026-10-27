import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { app } from 'electron';
import type { WebContentsDidStartNavigationEventParams } from 'electron';
import { PackageMigrationIndex } from './packageMigrationIndex';
import {
  choosePackageContent,
  showPackageRecovery,
} from './packageOpenDialogs';
import { isPackageCaptureActive } from '../liveCapture/captureRegistry';
import {
  getPackageSessionForPackagePath,
  claimPackageOpenReservation,
  releasePackageOpenReservation,
} from '../packageSessionRegistry';
import { refreshAppMenu } from '../menuBar';
import { registerPackageLocation } from '../mediaReferences/packageLocationRegistry';
import { preparePackageForOpen } from './legacyPackageMigrationService';
import { isNonEmptyString } from './ipcPayloadGuards';
import { isPackageOpenRequestId } from '../../../src/types/package/openProgress';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';
import { PackageOpenOperations } from './packageOpenOperations';

const operations = new PackageOpenOperations();
export const registerPackageOpenHandlers = (): void => {
  const migrationIndex = new PackageMigrationIndex(
    path.join(app.getPath('userData'), 'package-migrations.json'),
  );
  registerHandleWithAliases(
    'package:cancel-open',
    [],
    (event, requestId: unknown) => {
      const window = getValidatedEventSenderWindow(event);
      if (!window || !isPackageOpenRequestId(requestId))
        throw new Error('Invalid package cancellation');
      return operations.cancel(window.id, requestId);
    },
  );
  registerHandleWithAliases(
    'package:prepare-open',
    [],
    async (event, packagePath: unknown, requestId: unknown) => {
      const window = getValidatedEventSenderWindow(event);
      if (!window) {
        throw new Error('Invalid package open preparation sender');
      }
      if (!isNonEmptyString(packagePath)) {
        throw new Error('Invalid package path');
      }
      if (requestId !== undefined && !isPackageOpenRequestId(requestId))
        throw new Error('Invalid package open request');
      const id = requestId ?? randomUUID();
      const contents = window.webContents;
      const operation = operations.begin(window.id, id, (state) => {
        if (!window.isDestroyed() && !contents.isDestroyed())
          contents.send('package:open-progress', state);
      });
      const closed = (): void => {
        operations.abandon(window.id, id);
      };
      const navigated = (
        details: WebContentsDidStartNavigationEventParams,
      ): void => {
        if (details.isMainFrame && !details.isSameDocument) closed();
      };
      window.once('closed', closed);
      contents.on('render-process-gone', closed);
      contents.on('did-start-navigation', navigated);
      let delivered = false;
      try {
        claimPackageOpenReservation(window, packagePath, id);
        const result = await preparePackageForOpen(packagePath, {
          index: migrationIndex,
          historyRead: operation,
          choose: async (choice) => {
            operation.signal.throwIfAborted();
            const selected = await choosePackageContent(window, choice);
            operation.signal.throwIfAborted();
            return selected;
          },
          assertAvailable: (candidate) => {
            operation.signal.throwIfAborted();
            const session = getPackageSessionForPackagePath(candidate);
            if (
              isPackageCaptureActive(candidate) ||
              (session &&
                (session.mainWindow !== window || session.packageBound))
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
        operation.signal.throwIfAborted();
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
        operation.signal.throwIfAborted();
        delivered = true;
        return result;
      } finally {
        try {
          window.removeListener('closed', closed);
          contents.removeListener('render-process-gone', closed);
          contents.removeListener('did-start-navigation', navigated);
          if (!delivered)
            releasePackageOpenReservation(window, packagePath, id);
        } finally {
          operation.finish();
        }
      }
    },
  );
};
