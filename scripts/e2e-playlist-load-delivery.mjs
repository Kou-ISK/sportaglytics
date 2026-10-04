import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect } from 'playwright/test';

/** Hold only this synthetic document's disk result, never the production writer. */
const holdDocumentRead = async (app, target, skipReads) => {
  await app.evaluate(
    async (_electron, options) => {
      const fileSystem = process.getBuiltinModule('fs/promises');
      const readFile = fileSystem.readFile;
      let remaining = options.skipReads;
      const probe = {
        started: false,
        release: () => {},
        restore: () => {
          fileSystem.readFile = readFile;
        },
      };
      globalThis.__savedPlaylistRead = probe;
      fileSystem.readFile = async function (file, ...args) {
        if (String(file) !== options.target || remaining-- > 0)
          return readFile.call(this, file, ...args);
        fileSystem.readFile = readFile;
        const snapshot = await readFile.call(this, file, ...args);
        probe.started = true;
        return new Promise((resolve) => {
          probe.release = () => resolve(snapshot);
        });
      };
    },
    { target, skipReads },
  );
};

const verifyHeldAddition = async (app, main, page, clip) => {
  await expect
    .poll(() => app.evaluate(() => globalThis.__savedPlaylistRead?.started), {
      timeout: 5000,
    })
    .toBe(true);
  // A second observer acknowledges delivery without replacing the real receiver.
  await page.evaluate((id) => {
    globalThis.__savedPlaylistAdd = (item) => {
      if (item.id === id) globalThis.__savedPlaylistReceived = id;
    };
    window.electronAPI.playlist.onAddItem(globalThis.__savedPlaylistAdd);
  }, clip.id);
  try {
    await main.evaluate(
      (item) => window.electronAPI.playlist.addItemToAllWindows(item),
      clip,
    );
    await page.waitForFunction(
      (id) => globalThis.__savedPlaylistReceived === id,
      clip.id,
    );
    await app.evaluate(() => globalThis.__savedPlaylistRead.release());
    await page.getByTestId('organizer-clip-saved-on-disk').waitFor();
    await page.getByTestId(`organizer-clip-${clip.id}`).waitFor();
    assert.equal(await page.getByTestId(/^organizer-clip-/).count(), 2);
    await page.getByTestId('organizer-clip-saved-on-disk').click();
    assert.equal(
      await page
        .getByRole('textbox', { name: 'クリップのノート' })
        .inputValue(),
      '保存済みのノート',
    );
    await page.getByTestId(`organizer-clip-${clip.id}`).click();
    assert.equal(
      await page
        .getByRole('textbox', { name: 'クリップのノート' })
        .inputValue(),
      clip.note,
    );
  } finally {
    await page.evaluate(() => {
      window.electronAPI.playlist.offAddItem(globalThis.__savedPlaylistAdd);
      delete globalThis.__savedPlaylistAdd;
      delete globalThis.__savedPlaylistReceived;
    });
  }
};

export const verifySavedPlaylistLoadDelivery = async (
  app,
  main,
  work,
  videoSource,
) => {
  const folder = path.join(work, 'Saved-delivery.stpl');
  const target = path.join(folder, 'playlist.json');
  const saved = {
    id: 'saved-on-disk',
    timelineItemId: null,
    actionName: 'Saved clip',
    startTime: 0,
    endTime: 5,
    addedAt: 1,
    videoSource,
    note: '保存済みのノート',
  };
  await fs.mkdir(folder);
  await fs.writeFile(
    target,
    JSON.stringify({
      id: 'saved-delivery',
      name: 'Saved delivery',
      type: 'reference',
      items: [saved],
      createdAt: 1,
      updatedAt: 1,
    }),
  );
  let page;
  try {
    // Main reads once before creating the window; hold its renderer's second read.
    await holdDocumentRead(app, target, 1);
    [page] = await Promise.all([
      app.waitForEvent('window'),
      main.evaluate(
        (filePath) => window.electronAPI.playlist.loadPlaylistFile(filePath),
        folder,
      ),
    ]);
    const queued = {
      ...saved,
      id: 'queued-during-load',
      actionName: 'Queued clip',
      note: 'ロード中に届いたノート',
    };
    await verifyHeldAddition(app, main, page, queued);
    console.log('Saved Playlist load plus acknowledged queued addition passed');

    // The same saved document is hydrated again after a real renderer reload.
    await holdDocumentRead(app, target, 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await verifyHeldAddition(app, main, page, {
      ...queued,
      id: 'queued-during-reload',
    });
    console.log(
      'Saved Playlist reload plus acknowledged queued addition passed',
    );
  } finally {
    await app.evaluate(() => {
      globalThis.__savedPlaylistRead?.release();
      globalThis.__savedPlaylistRead?.restore();
      delete globalThis.__savedPlaylistRead;
    });
  }
};
