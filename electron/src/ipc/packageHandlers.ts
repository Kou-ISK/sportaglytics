import { createPackage } from './packageCreationService';
import { convertConfigToRelativePath } from './packageConfigMigrationService';
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
