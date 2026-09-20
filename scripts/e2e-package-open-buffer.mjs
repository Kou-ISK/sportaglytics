import assert from 'node:assert/strict';

/** Exercise the real sandbox preload before any renderer callback is installed. */
export const assertBufferedPackageOpen = async (app) => {
  const probeUrl = 'data:text/html,<title>Package open delivery probe</title>';
  const [page, id] = await Promise.all([
    app.waitForEvent('window', {
      predicate: async (candidate) => {
        await candidate.waitForURL(probeUrl);
        return true;
      },
    }),
    app.evaluate(async ({ app, BrowserWindow }, url) => {
      const preload = `${app.getAppPath()}/build/electron/src/preload.js`;
      const probe = new BrowserWindow({
        show: false,
        webPreferences: {
          preload,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
        },
      });
      probe.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      await probe.loadURL(url);
      // Deliberately send before the test (standing in for React) subscribes.
      probe.webContents.send('open-package-directory', '/fixture.stpkg');
      return probe.webContents.id;
    }, probeUrl),
  ]);
  try {
    await page.waitForFunction(() => Boolean(window.electronAPI));
    await page.evaluate(() => {
      window.__receivedPackagePaths = [];
      window.__unsubscribePackageOpen =
        window.electronAPI.onPackageDirectoryOpen((path) =>
          window.__receivedPackagePaths.push(path),
        );
    });
    await page.waitForFunction(
      () => window.__receivedPackagePaths.length === 1,
    );
    assert.deepEqual(await page.evaluate(() => window.__receivedPackagePaths), [
      '/fixture.stpkg',
    ]);
    await page.evaluate(() => {
      window.__unsubscribePackageOpen();
      window.electronAPI.onPackageDirectoryOpen((path) =>
        window.__receivedPackagePaths.push(path),
      );
    });
    await app.evaluate(({ webContents }, contentsId) => {
      webContents
        .fromId(contentsId)
        .send('open-package-directory', '/next.stpkg');
    }, id);
    await page.waitForFunction(() => window.__receivedPackagePaths.length >= 2);
    assert.deepEqual(await page.evaluate(() => window.__receivedPackagePaths), [
      '/fixture.stpkg',
      '/next.stpkg',
    ]);
    console.log('Pre-subscription package open delivery and no replay passed');
  } finally {
    await app.evaluate(({ BrowserWindow, webContents }, contentsId) => {
      const contents = webContents.fromId(contentsId);
      if (contents) BrowserWindow.fromWebContents(contents)?.destroy();
    }, id);
  }
};
