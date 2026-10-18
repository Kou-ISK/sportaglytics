import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';

const root = await mkdtemp(join(tmpdir(), 'sportaglytics-window-trust-'));
const fixture = join(root, 'public-synthetic.txt');
const foreign = join(root, 'foreign.html');
await writeFile(fixture, 'synthetic original');
await writeFile(foreign, '<!doctype html><title>Foreign document</title>');
const app = await electron.launch(
  getElectronLaunchOptions(join(root, 'profile'), process.argv.slice(2)),
);
try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.electronAPI));
  const url = page.url();
  assert.ok(url.startsWith('file:'));
  assert.equal(
    await page.evaluate(
      (file) => window.electronAPI.readTextFile(file),
      fixture,
    ),
    'synthetic original',
  );
  assert.equal(
    await page.evaluate(
      (file) => window.electronAPI.writeTextFile(file, 'trusted edit'),
      fixture,
    ),
    true,
  );
  assert.equal(await readFile(fixture, 'utf8'), 'trusted edit');

  const owner = await app.browserWindow(page);
  await owner.evaluate((window) => {
    globalThis.__blockedNavigations = [];
    window.webContents.on('will-navigate', (event, target) => {
      globalThis.__blockedNavigations.push({
        target,
        blocked: event.defaultPrevented,
      });
    });
  });
  for (const target of [
    pathToFileURL(foreign).href,
    'https://example.invalid/',
  ]) {
    await page.evaluate((next) => {
      window.location.href = next;
    }, target);
    await page.waitForTimeout(100);
    assert.equal(page.url(), url);
    const observed = await app.evaluate(() => globalThis.__blockedNavigations);
    assert.ok(
      observed.some((entry) => entry.target === target && entry.blocked),
    );
  }
  const count = app.windows().length;
  await page.evaluate(() => window.open('https://example.invalid/'));
  await page.waitForTimeout(100);
  assert.equal(app.windows().length, count);

  // A Main-initiated loadURL intentionally bypasses will-navigate. IPC must
  // still reject the document, even when it has the real sandbox preload.
  const probeId = await app.evaluate(
    async ({ app, BrowserWindow }, foreignUrl) => {
      const { createRequire } = process.getBuiltinModule('module');
      const require = createRequire(`${app.getAppPath()}/package.json`);
      const {
        applyWindowSecurity,
      } = require('./build/electron/src/windowSecurity.js');
      const probe = new BrowserWindow({
        show: false,
        webPreferences: {
          preload: `${app.getAppPath()}/build/electron/src/preload.js`,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
          // Test-only: deliver the real preload to child frames to prove that
          // Main rejects their IPC even if a future window enables this option.
          nodeIntegrationInSubFrames: true,
        },
      });
      applyWindowSecurity(probe);
      await probe.loadURL(foreignUrl);
      return probe.id;
    },
    pathToFileURL(foreign).href,
  );
  const probe = app
    .windows()
    .find((candidate) => candidate.url() === pathToFileURL(foreign).href);
  assert.ok(probe);
  assert.equal(
    await probe.evaluate(
      (file) => window.electronAPI.readTextFile(file),
      fixture,
    ),
    null,
  );
  assert.equal(
    await probe.evaluate(
      (file) => window.electronAPI.writeTextFile(file, 'foreign edit'),
      fixture,
    ),
    false,
  );
  assert.equal(
    await probe.evaluate(() =>
      window.electronAPI.saveSettings({ themeMode: 'light' }),
    ),
    false,
  );
  assert.equal(await readFile(fixture, 'utf8'), 'trusted edit');

  await app.evaluate(
    async ({ BrowserWindow }, { id, url }) => {
      await BrowserWindow.fromId(id).loadURL(url);
    },
    { id: probeId, url },
  );
  await probe.waitForFunction(() => Boolean(window.electronAPI));
  assert.equal(
    await probe.evaluate(
      (file) => window.electronAPI.readTextFile(file),
      fixture,
    ),
    'trusted edit',
  );
  await probe.evaluate((source) => {
    const frame = document.createElement('iframe');
    frame.src = source;
    document.body.append(frame);
  }, url);
  const child = probe.frames().find((frame) => frame !== probe.mainFrame());
  assert.ok(child);
  await child.waitForFunction(() => Boolean(window.electronAPI));
  assert.equal(
    await child.evaluate(
      (file) => window.electronAPI.readTextFile(file),
      fixture,
    ),
    null,
  );
  assert.equal(
    await child.evaluate(
      (file) => window.electronAPI.writeTextFile(file, 'child edit'),
      fixture,
    ),
    false,
  );
  assert.equal(await readFile(fixture, 'utf8'), 'trusted edit');

  await page.evaluate(() => window.electronAPI.openSettingsWindow());
  await page.waitForTimeout(100);
  const settings = app
    .windows()
    .find((candidate) => candidate.url().endsWith('#/settings'));
  assert.ok(settings);
  await settings.waitForFunction(() => Boolean(window.electronAPI));
  assert.ok(await settings.evaluate(() => window.electronAPI.loadSettings()));
  await app.evaluate(async ({ app }) => {
    const { createRequire } = process.getBuiltinModule('module');
    createRequire(`${app.getAppPath()}/package.json`)(
      './build/electron/src/helpWindow.js',
    ).openHelpWindow();
  });
  await page.waitForTimeout(100);
  const help = app
    .windows()
    .find((candidate) => candidate.url().startsWith('data:text/html'));
  assert.ok(help);
  assert.match(await help.locator('body').innerText(), /パッケージ/);
  assert.equal(
    await help.evaluate(() => typeof window.electronAPI),
    'undefined',
  );
  console.log(
    'Window trust: app/settings IPC, foreign document and same-document child rejection, navigation/window.open denial, generated help passed',
  );
} finally {
  await app.close();
  await rm(root, { recursive: true, force: true });
}
