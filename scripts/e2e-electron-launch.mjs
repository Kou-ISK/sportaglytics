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
      // Opt in only inside an isolated Linux cloud test container with Xvfb.
      // Production BrowserWindow sandbox settings are not changed by this.
      ...(process.platform === 'linux' && process.env.E2E_CLOUD_LINUX === '1'
        ? ['--no-sandbox', '--disable-gpu']
        : []),
      ...extraArgs,
    ],
    env: environment,
  };
};

// All callers use their own synthetic profiles and fixtures. Keep actual Main
// filesystem error codes visible when native regression checks fail.
export const observeElectronErrors = (app) => {
  let printed = 0;
  app.process()?.stderr.on('data', (chunk) => {
    const text = String(chunk);
    if (
      printed < 32000 &&
      /Failed to write|Error|EACCES|EPERM|EBUSY|PACKAGE_|rename/.test(text)
    ) {
      const bounded = text.slice(0, 32000 - printed);
      printed += bounded.length;
      console.error('Synthetic Electron Main:', bounded);
    }
  });
};
