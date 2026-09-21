import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const root = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-playlist-open-'),
);
const movie = path.join(root, 'sample.mp4');
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=blue:s=320x180:r=25:d=2',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  movie,
]);
const files = ['first', 'second'].map((name) =>
  path.join(root, `${name}.stpl`),
);
for (const [index, file] of files.entries()) {
  await fs.mkdir(file);
  await fs.writeFile(
    path.join(file, 'playlist.json'),
    JSON.stringify({
      id: `playlist-${index}`,
      name: `Review ${index + 1}`,
      type: 'reference',
      createdAt: 1,
      updatedAt: 1,
      items: [
        {
          id: 'sample',
          timelineItemId: 'source',
          actionName: 'Review',
          startTime: 0,
          endTime: 2,
          addedAt: 1,
          videoSource: movie,
          memo: 'Saved note',
        },
      ],
    }),
  );
}
const invalid = path.join(root, 'invalid.stpl');
await fs.mkdir(invalid);
await fs.writeFile(path.join(invalid, 'playlist.json'), '{invalid');
const app = await electron.launch(
  getElectronLaunchOptions(path.join(root, 'profile')),
);
const clickOpen = async (page, file) => {
  const ownerId = await (
    await app.browserWindow(page)
  ).evaluate((window) => window.id);
  await app.evaluate(
    ({ Menu, BrowserWindow, dialog }, { ownerId, file }) => {
      dialog.showOpenDialog = async (...args) => {
        globalThis.__playlistPicker = {
          ownerId: args[0]?.id,
          options: args.at(-1),
        };
        return {
          canceled: file === null,
          filePaths: file === null ? [] : [file],
        };
      };
      const item =
        Menu.getApplicationMenu()?.getMenuItemById('open-playlist-file');
      if (!item) throw new Error('File > Open > Playlist menu is missing');
      item.click(undefined, BrowserWindow.fromId(ownerId));
    },
    { ownerId, file },
  );
  const picker = await app.evaluate(() => globalThis.__playlistPicker);
  assert.equal(picker.ownerId, ownerId);
  assert.ok(picker.options.properties.includes('openDirectory'));
};
const countWindows = () =>
  app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);

try {
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await main.getByText('新しいパッケージを作成', { exact: true }).waitFor();
  await app.evaluate(({ dialog }) => {
    globalThis.__playlistOpenErrors = [];
    dialog.showMessageBox = async (...args) => {
      const options = args.at(-1);
      if (options.type === 'error')
        globalThis.__playlistOpenErrors.push(options.title);
      return { response: 1, checkboxChecked: false };
    };
  });
  const initialCount = await countWindows();
  await clickOpen(main, null);
  assert.equal(await countWindows(), initialCount);

  const firstWindow = app.waitForEvent('window');
  await clickOpen(main, files[0]);
  const first = await firstWindow;
  await first.getByRole('button', { name: 'Sorter', exact: true }).click();
  const row = first.getByTestId('sorter-row-sample');
  await row.waitFor();
  await row.click();
  await first.waitForFunction(() =>
    [...document.querySelectorAll('video')].some(
      (video) => video.readyState >= 2,
    ),
  );
  await row.getByRole('cell').nth(5).dblclick();
  const note = row.getByRole('textbox');
  await note.fill('Unsaved review');
  await note.press('Enter');
  assert.match(await row.innerText(), /Unsaved review/);

  const secondWindow = app.waitForEvent('window');
  await clickOpen(first, files[1]);
  const second = await secondWindow;
  await second.getByRole('button', { name: 'Sorter', exact: true }).click();
  await second.getByTestId('sorter-row-sample').waitFor();
  assert.match(await row.innerText(), /Unsaved review/);
  assert.equal(
    JSON.parse(await fs.readFile(path.join(files[0], 'playlist.json'), 'utf8'))
      .items[0].memo,
    'Saved note',
  );
  assert.equal(await countWindows(), initialCount + 2);

  await clickOpen(second, files[0]);
  const focused = await (
    await app.browserWindow(first)
  ).evaluate((window) => window.isFocused());
  // File validation is asynchronous; wait for the existing window to regain focus.
  if (!focused) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (
        await (
          await app.browserWindow(first)
        ).evaluate((window) => window.isFocused())
      )
        break;
      await delay(100);
    }
  }
  assert.equal(
    await (
      await app.browserWindow(first)
    ).evaluate((window) => window.isFocused()),
    true,
  );
  assert.equal(await countWindows(), initialCount + 2);
  assert.match(await row.innerText(), /Unsaved review/);

  await clickOpen(first, invalid);
  const deadline = Date.now() + 10000;
  while (
    Date.now() < deadline &&
    !(await app.evaluate(() => globalThis.__playlistOpenErrors.length))
  )
    await delay(100);
  assert.deepEqual(await app.evaluate(() => globalThis.__playlistOpenErrors), [
    'プレイリストを開けませんでした',
  ]);
  assert.equal(await countWindows(), initialCount + 2);
  console.log(
    'File > Open > Playlist: cancellation, startup, playback, separate documents, unsaved edits, existing window and invalid package passed',
  );
  if (process.platform === 'darwin') {
    await app.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) {
        if (!window.isDestroyed()) window.destroy();
      }
    });
    const reopened = app.waitForEvent('window');
    await app.evaluate(({ Menu, dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
      Menu.getApplicationMenu().getMenuItemById('open-playlist-file').click();
    }, files[0]);
    const page = await reopened;
    await page.getByRole('button', { name: 'Sorter', exact: true }).click();
    await page.getByTestId('sorter-row-sample').waitFor();
    console.log(
      'macOS File > Open > Playlist also works with all document windows closed',
    );
  }
} finally {
  await app.close();
  await fs.rm(root, { recursive: true, force: true });
}
