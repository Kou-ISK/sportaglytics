import { createPackage } from './packageCreationService';
import { convertConfigToRelativePath } from './packageConfigMigrationService';
import { registerHandleWithAliases } from './registerHandleWithAliases';

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
      _event,
      directoryName: string,
      packageName: string,
      angles: unknown,
      metaDataConfig: unknown,
    ) => {
      return createPackage(directoryName, packageName, angles, metaDataConfig);
    },
  );

  registerHandleWithAliases(
    'package:convert-config-to-relative-path',
    ['convert-config-to-relative-path'],
    async (_event, packagePath: string) => {
      return convertConfigToRelativePath(packagePath);
    },
  );
};
