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

export const focusElectronWindow = async (app, page) => {
  const window = await app.browserWindow(page);
  await window.evaluate((nativeWindow) => {
    nativeWindow.show();
    nativeWindow.focus();
    nativeWindow.webContents.focus();
  });
  // Native focus can change while an occluded Windows renderer is not painting.
  // Observe the actual DOM state without depending on requestAnimationFrame.
  await page.waitForFunction(() => document.hasFocus(), undefined, {
    polling: 100,
  });
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
