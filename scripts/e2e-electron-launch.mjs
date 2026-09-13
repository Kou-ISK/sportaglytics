import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
export const getElectronLaunchOptions = (profilePath, extraArgs = []) => {
  const packagedPath = process.env.E2E_APP_PATH;
  const environment = { ...process.env, NODE_ENV: 'test' };
  delete environment.ELECTRON_RUN_AS_NODE;
  return {
    executablePath: packagedPath || require('electron'),
    args: [
      ...(packagedPath ? [] : [resolve(import.meta.dirname, '..')]),
      `--user-data-dir=${profilePath}`,
      ...extraArgs,
    ],
    env: environment,
  };
};
