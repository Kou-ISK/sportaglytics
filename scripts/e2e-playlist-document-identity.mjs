import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { expect } from 'playwright/test';
import { holdDocumentRead } from './e2e-playlist-load-delivery.mjs';

const inspectDocument = (app, id) =>
  app.evaluate(({ app, BrowserWindow }, id) => {
    const path = process.getBuiltinModule('path');
    const require = process
      .getBuiltinModule('module')
      .createRequire(path.join(app.getAppPath(), 'build/electron/src/main.js'));
    const {
      getWindowInfoBySender,
    } = require('./playlistWindow/windowManager.js');
    const window = BrowserWindow.fromId(id);
    const info = window && getWindowInfoBySender(window.webContents);
    return info ? { filePath: info.filePath, isDirty: info.isDirty } : null;
  }, id);

const requestLoad = (app, id, filePath) =>
  app.evaluate(
    ({ BrowserWindow }, input) => {
      BrowserWindow.fromId(input.id).webContents.send(
        'playlist:external-open',
        input.filePath,
      );
    },
    { id, filePath },
  );

// Main logs this only after the real read and media resolution have finished.
// Observe the owned process stream; do not replace the IPC handler or loader.
const observeLoadCompletion = (app, filePath) => {
  let output = '';
  let timer;
  let receive;
  const stream = app.process().stdout;
  assert.ok(
    stream,
    'Owned Electron stdout is required for the load-completion probe',
  );
  const promise = new Promise((resolve, reject) => {
    receive = (chunk) => {
      output = (output + chunk.toString()).slice(-32768);
      if (output.includes(`[Playlist] Loaded from: ${filePath}`)) {
        clearTimeout(timer);
        stream.off('data', receive);
        resolve();
      }
    };
    stream.on('data', receive);
    timer = setTimeout(() => {
      stream.off('data', receive);
      reject(new Error('Held Playlist load did not complete'));
    }, 5000);
  });
  return {
    promise,
    cancel: () => {
      clearTimeout(timer);
      stream.off('data', receive);
    },
  };
};

export const verifyPlaylistDocumentIdentity = async (
  app,
  main,
  work,
  videoSource,
  screenshot,
) => {
  const files = Object.fromEntries(
    ['A', 'B'].map((name) => [name, path.join(work, `Identity-${name}.stpl`)]),
  );
  for (const [name, folder] of Object.entries(files)) {
    await fs.mkdir(folder);
    await fs.writeFile(
      path.join(folder, 'playlist.json'),
      JSON.stringify({
        id: `identity-${name}`,
        name: `Identity ${name}`,
        type: 'reference',
        createdAt: 1,
        updatedAt: 1,
        items: [
          {
            id: `identity-${name}`,
            timelineItemId: null,
            actionName: `Clip ${name}`,
            startTime: 0,
            endTime: 5,
            addedAt: 1,
            videoSource,
            note: `Original ${name}`,
          },
        ],
      }),
    );
  }
  const [page] = await Promise.all([
    app.waitForEvent('window'),
    main.evaluate(
      (file) => window.electronAPI.playlist.loadPlaylistFile(file),
      files.A,
    ),
  ]);
  const handle = await app.browserWindow(page);
  const id = await handle.evaluate((window) => window.id);
  const note = page.getByRole('textbox', { name: 'クリップのノート' });
  const select = async (name) => {
    await page.getByTestId(`organizer-clip-identity-${name}`).click();
    await note.waitFor();
  };
  const bytes = (name) =>
    fs.readFile(path.join(files[name], 'playlist.json'), 'utf8');
  const editNote = async (value) => {
    await note.fill(value);
    // The note editor commits on blur; typing alone is only a local draft.
    await page
      .getByTestId('playlist-clip-inspector')
      .getByText('クリップ詳細', { exact: true })
      .click();
    await expect
      .poll(async () => (await inspectDocument(app, id))?.isDirty)
      .toBe(true);
  };
  const beginHeld = async (name) => {
    await holdDocumentRead(app, path.join(files[name], 'playlist.json'), 0);
    await requestLoad(app, id, files[name]);
    await expect
      .poll(() => app.evaluate(() => globalThis.__savedPlaylistRead?.started))
      .toBe(true);
  };
  const release = async (name) => {
    const observed = observeLoadCompletion(app, files[name]);
    try {
      await app.evaluate(() => globalThis.__savedPlaylistRead.release());
      await observed.promise;
    } finally {
      observed.cancel();
    }
  };
  const save = async (name, expectedNote) => {
    await page.keyboard.press(
      process.platform === 'darwin' ? 'Meta+s' : 'Control+s',
    );
    await expect
      .poll(async () => JSON.parse(await bytes(name)).items[0].note)
      .toBe(expectedNote);
    await expect
      .poll(() => inspectDocument(app, id))
      .toEqual({ filePath: files[name], isDirty: false });
  };
  try {
    await select('A');
    await expect
      .poll(() => inspectDocument(app, id))
      .toEqual({ filePath: files.A, isDirty: false });

    // Same-file edit after a snapshot was read must retain Main's Close guard.
    await beginHeld('A');
    await editNote('Edited while A loaded');
    await expect
      .poll(() => inspectDocument(app, id))
      .toEqual({ filePath: files.A, isDirty: true });
    await release('A');
    assert.equal(await note.inputValue(), 'Edited while A loaded');
    assert.deepEqual(await inspectDocument(app, id), {
      filePath: files.A,
      isDirty: true,
    });
    await app.evaluate(({ dialog }, id) => {
      const original = dialog.showMessageBox;
      globalThis.__identityClose = {
        count: 0,
        restore: () => {
          dialog.showMessageBox = original;
        },
      };
      dialog.showMessageBox = async (...args) => {
        if (args[0]?.id === id && args[1]?.title === '未保存の変更') {
          globalThis.__identityClose.count++;
          return { response: 2, checkboxChecked: false };
        }
        return original(...args);
      };
    }, id);
    await handle.evaluate((window) => window.close());
    await expect
      .poll(() => app.evaluate(() => globalThis.__identityClose.count))
      .toBe(1);
    assert.equal(page.isClosed(), false);
    await save('A', 'Edited while A loaded');
    console.log(
      'Playlist identity: stale same-file load retained dirty and native Close prompt',
    );

    // Rejected B must not redirect the subsequent real Save away from A.
    const originalB = await bytes('B');
    await beginHeld('B');
    await editNote('Edited A while B loaded');
    await release('B');
    assert.deepEqual(await inspectDocument(app, id), {
      filePath: files.A,
      isDirty: true,
    });
    assert.equal(await note.inputValue(), 'Edited A while B loaded');
    await save('A', 'Edited A while B loaded');
    assert.equal(await bytes('B'), originalB);
    console.log(
      'Playlist identity: rejected B preserved A save destination and B bytes',
    );

    // A starts first, B commits first, A completes last. Save must still target B.
    const savedA = await bytes('A');
    await beginHeld('A');
    await requestLoad(app, id, files.B);
    await select('B');
    await expect
      .poll(() => inspectDocument(app, id))
      .toEqual({ filePath: files.B, isDirty: false });
    await release('A');
    assert.deepEqual(await inspectDocument(app, id), {
      filePath: files.B,
      isDirty: false,
    });
    await editNote('Edited B after reverse completion');
    await save('B', 'Edited B after reverse completion');
    assert.equal(await bytes('A'), savedA);
    await screenshot(page, 'playlist-document-identity-b');
    console.log(
      'Playlist identity: reversed A/B completion retained B in Main/Renderer and actual Save',
    );
  } finally {
    await app.evaluate(() => {
      globalThis.__savedPlaylistRead?.release();
      globalThis.__savedPlaylistRead?.restore();
      delete globalThis.__savedPlaylistRead;
      globalThis.__identityClose?.restore();
      delete globalThis.__identityClose;
    });
    await handle.dispose();
  }
};
