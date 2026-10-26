import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron as electron } from 'playwright';
import {
  getElectronLaunchOptions,
  observeElectronErrors,
} from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

// Only synthetic files and private profiles are used. The application's IPC
// handlers, atomic writer, renderer persistence and native close events remain.
const root = await fs.realpath(
  await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-close-')),
);
const video = path.join(root, 'synthetic.mp4');
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=blue:s=320x180:r=24:d=8',
  '-threads',
  '2',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  '-y',
  video,
]);
const base = {
  version: 2,
  rows: [{ id: 'row', name: 'Synthetic row', color: '#4D8DFF' }],
  instances: [
    {
      id: 'scene',
      actionName: 'Synthetic row',
      startTime: 1,
      endTime: 3,
      memo: 'Original synthetic memo',
      labels: [],
    },
  ],
};
const makePackage = async (name) => {
  const folder = path.join(root, `${name}.stpkg`);
  await fs.mkdir(path.join(folder, '.metadata'), { recursive: true });
  await fs.mkdir(path.join(folder, 'videos'));
  await fs.copyFile(video, path.join(folder, 'videos/synthetic.mp4'));
  await fs.writeFile(path.join(folder, 'timeline.json'), JSON.stringify(base));
  await fs.writeFile(
    path.join(folder, '.metadata/config.json'),
    JSON.stringify({
      packageFormatVersion: 1,
      team1Name: 'Coral',
      team2Name: 'Falcon',
      primaryAngleId: 'main',
      angles: [
        {
          id: 'main',
          name: 'Synthetic camera',
          sourceKind: 'local',
          relativePath: 'videos/synthetic.mp4',
          clips: [
            {
              id: 'clip',
              sourceKind: 'local',
              relativePath: 'videos/synthetic.mp4',
              gapBeforeSeconds: 0,
              timelineStartSeconds: 0,
              durationSeconds: 8,
            },
          ],
        },
      ],
    }),
  );
  return { folder, timeline: path.join(folder, 'timeline.json') };
};
const poll = async (predicate, message) => {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (await predicate()) return;
    await delay(50);
  }
  throw new Error(message);
};
let app;
const processes = new WeakMap();
let profileSequence = 0;
const launch = async () => {
  app = await electron.launch({
    ...getElectronLaunchOptions(
      path.join(root, `profile-${++profileSequence}`),
    ),
    timeout: 60000,
  });
  processes.set(app, app.process());
  observeElectronErrors(app);
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await main.waitForFunction(() => !!window.electronAPI?.timelinePersistence);
  return main;
};
const openPackage = async (fixture, existingMain) => {
  const before = new Set(app.windows());
  await app.evaluate(({ app: nativeApp }, folder) => {
    nativeApp.emit('open-file', { preventDefault() {} }, folder);
  }, fixture.folder);
  let timeline;
  await poll(() => {
    timeline = app
      .windows()
      .find(
        (page) =>
          !before.has(page) && new URL(page.url()).hash === '#/timeline',
      );
    return !!timeline;
  }, 'Native Timeline did not open');
  await timeline
    .getByRole('button', { name: 'Synthetic row 行', exact: true })
    .waitFor();
  let main = existingMain;
  if (!main) {
    await poll(() => {
      main = app
        .windows()
        .find(
          (page) =>
            !before.has(page) && ['', '#/'].includes(new URL(page.url()).hash),
        );
      return !!main;
    }, 'Native main window did not open');
  }
  const handle = await app.browserWindow(main);
  const id = await handle.evaluate((window) => window.id);
  await handle.dispose();
  return { main, timeline, id };
};
const observeMemo = async (
  timeline,
  memo,
  command = { type: 'update-memo', id: 'scene', memo },
) =>
  timeline.evaluate(
    ({ memo, command }) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          off();
          reject(
            new Error(
              'Timeline did not acknowledge the synthetic edit within 15 seconds',
            ),
          );
        }, 15_000);
        const off = window.electronAPI.timelineWindow.onSync((snapshot) => {
          if (
            snapshot.timeline.find((item) => item.id === 'scene')?.memo !== memo
          )
            return;
          off();
          clearTimeout(timer);
          resolve(Date.now());
        });
        window.electronAPI.timelineWindow.sendCommand(command);
      }),
    { memo, command },
  );
const readMemo = async (fixture) =>
  JSON.parse(await fs.readFile(fixture.timeline, 'utf8')).instances[0].memo;

const installFaultBoundary = async (fixtures) => {
  await app.evaluate(
    ({ dialog }, paths) => {
      const fs = process.getBuiltinModule('fs/promises');
      const path = process.getBuiltinModule('path');
      const targets = new Map(
        paths.map((file) => [
          path.resolve(file),
          {
            attempts: 0,
            stagedWrites: 0,
            commits: 0,
            fail: false,
            hold: false,
            held: false,
          },
        ]),
      );
      globalThis.closeTestTargets = targets;
      globalThis.closeTestDialogs = 0;
      const show = dialog.showMessageBox.bind(dialog);
      dialog.showMessageBox = async (...args) => {
        const options = args.at(-1);
        if (
          options.title === '処理の完了を確認できないため終了を中止しました'
        ) {
          globalThis.closeTestDialogs++;
          return { response: 0, checkboxChecked: false };
        }
        return show(...args);
      };
      const rename = fs.rename.bind(fs);
      const open = fs.open.bind(fs);
      fs.open = async (file, ...args) => {
        const resolved = path.resolve(String(file));
        for (const [targetPath, state] of targets) {
          if (
            path.dirname(resolved) === path.dirname(targetPath) &&
            path
              .basename(resolved)
              .startsWith(`.${path.basename(targetPath)}.`) &&
            resolved.endsWith('.writing')
          )
            state.stagedWrites++;
        }
        return open(file, ...args);
      };
      fs.rename = async (from, to) => {
        const target = targets.get(path.resolve(String(to)));
        if (target) {
          target.attempts++;
          if (target.hold) {
            target.hold = false;
            target.held = true;
            await new Promise((resolve) => {
              target.release = resolve;
            });
            target.held = false;
          }
          if (target.fail)
            throw Object.assign(new Error('Synthetic close EACCES'), {
              code: 'EACCES',
            });
        }
        const result = await rename(from, to);
        if (target) target.commits++;
        return result;
      };
    },
    fixtures.map((fixture) => fixture.timeline),
  );
};
const targetState = (fixture) =>
  app.evaluate((_electron, file) => {
    const state = globalThis.closeTestTargets.get(file);
    return {
      attempts: state.attempts,
      commits: state.commits,
      held: state.held,
    };
  }, fixture.timeline);
const setFault = (fixture, patch) =>
  app.evaluate(
    (_electron, { file, patch }) => {
      Object.assign(globalThis.closeTestTargets.get(file), patch);
    },
    { file: fixture.timeline, patch },
  );
const requestClose = async ({
  id,
  fixture,
  waitMs = 0,
  acknowledgedAt = null,
  quit = false,
}) => {
  const evidence = path.join(root, `close-${id}-${Date.now()}.json`);
  await app.evaluate(
    ({ app: nativeApp, BrowserWindow }, data) => {
      setTimeout(() => {
        const fs = process.getBuiltinModule('fs');
        const state = globalThis.closeTestTargets?.get(data.file);
        fs.writeFileSync(
          data.evidence,
          JSON.stringify({
            requestedAt: Date.now(),
            acknowledgedAt: data.acknowledgedAt,
            elapsedMs:
              data.acknowledgedAt === null
                ? null
                : Date.now() - data.acknowledgedAt,
            attemptsBeforeClose: state?.attempts ?? null,
            stagedWritesBeforeClose: state?.stagedWrites ?? null,
          }),
        );
        if (data.quit) nativeApp.quit();
        else BrowserWindow.fromId(data.id)?.close();
      }, data.waitMs);
    },
    { id, file: fixture?.timeline, waitMs, acknowledgedAt, evidence, quit },
  );
  return evidence;
};
const waitExited = async (application) => {
  await poll(
    () => processes.get(application).exitCode !== null,
    'Application did not finish normal quit',
  );
};
const closeApplication = async () => {
  if (!app) return;
  const current = app;
  await app.evaluate(({ app: nativeApp }) => {
    setTimeout(() => nativeApp.quit(), 0);
  });
  await waitExited(current);
  app = null;
};
const finishWindowClose = async (opened, fixture, expected) => {
  await poll(
    () => opened.main.isClosed() && opened.timeline.isClosed(),
    'The owner and its Timeline did not finish native close',
  );
  // Check the close flush before a later Quit can save anything. macOS keeps
  // the application alive after its last window closes; other platforms quit.
  assert.equal(
    await readMemo(fixture),
    expected,
    'Native window close must persist the final memo before explicit Quit',
  );
  if (process.platform === 'darwin') {
    await poll(
      () =>
        app.evaluate(
          ({ BrowserWindow }) => BrowserWindow.getAllWindows().length === 0,
        ),
      'macOS window close must not leave an owner or auxiliary window behind',
    );
    assert.equal(processes.get(app).exitCode, null);
    await closeApplication();
  } else {
    await waitExited(app);
    app = null;
  }
};
const verifyFreshProcess = async (fixture, expected) => {
  const main = await launch();
  const opened = await openPackage(fixture, main);
  const restored = await opened.timeline.evaluate(
    () =>
      new Promise((resolve) => {
        const off = window.electronAPI.timelineWindow.onSync((snapshot) => {
          off();
          resolve(snapshot.timeline.find((item) => item.id === 'scene')?.memo);
        });
        window.electronAPI.timelineWindow.sendCommand({ type: 'request-sync' });
      }),
  );
  assert.equal(
    restored,
    expected,
    'A fresh Electron process must read the final saved memo',
  );
  await closeApplication();
};
const results = [];
try {
  for (const waitMs of [0, 100]) {
    const fixture = await makePackage(`Debounce ${waitMs}`);
    const main = await launch();
    const opened = await openPackage(fixture, main);
    await installFaultBoundary([fixture]);
    const expected = `Synthetic edit before close ${waitMs}`;
    const acknowledgedAt = await observeMemo(opened.timeline, expected);
    const evidencePath = await requestClose({
      ...opened,
      fixture,
      waitMs,
      acknowledgedAt,
    });
    await finishWindowClose(opened, fixture, expected);
    const evidence = JSON.parse(await fs.readFile(evidencePath, 'utf8'));
    assert.equal(
      evidence.attemptsBeforeClose,
      0,
      'Debounce scenario must close before the first filesystem commit attempt',
    );
    assert.equal(
      evidence.stagedWritesBeforeClose,
      0,
      'Debounce scenario must close before opening the first atomic temporary write',
    );
    assert.equal(await readMemo(fixture), expected);
    await verifyFreshProcess(fixture, expected);
    results.push({
      case: 'short-debounce-close',
      requestedDelayMs: waitMs,
      ...evidence,
      freshProcess: true,
    });
  }

  const queued = await makePackage('Queued undo');
  let main = await launch();
  let opened = await openPackage(queued, main);
  await installFaultBoundary([queued]);
  await setFault(queued, { hold: true });
  await observeMemo(opened.timeline, 'In-flight synthetic memo');
  await poll(
    async () => (await targetState(queued)).held,
    'The real atomic rename was not held',
  );
  const acknowledgedAt = await observeMemo(
    opened.timeline,
    base.instances[0].memo,
    { type: 'undo' },
  );
  const evidencePath = await requestClose({
    ...opened,
    fixture: queued,
    acknowledgedAt,
  });
  await poll(
    () =>
      fs.access(evidencePath).then(
        () => true,
        () => false,
      ),
    'Native close was not requested',
  );
  await delay(100);
  assert.equal(
    opened.main.isClosed(),
    false,
    'Close must wait for the in-flight write',
  );
  await opened.timeline.evaluate(() =>
    window.electronAPI.timelineWindow.sendCommand({
      type: 'update-memo',
      id: 'scene',
      memo: 'Must be ignored while close is awaiting its final write',
    }),
  );
  await app.evaluate(
    (_electron, file) => globalThis.closeTestTargets.get(file).release(),
    queued.timeline,
  );
  await finishWindowClose(opened, queued, base.instances[0].memo);
  assert.equal(
    await readMemo(queued),
    base.instances[0].memo,
    'Close must persist the latest Undo behind the older write',
  );
  await verifyFreshProcess(queued, base.instances[0].memo);
  results.push({
    case: 'in-flight-rename-with-latest-undo',
    freshProcess: true,
  });

  const failed = await makePackage('Failed close');
  main = await launch();
  opened = await openPackage(failed, main);
  await installFaultBoundary([failed]);
  await setFault(failed, { fail: true });
  await observeMemo(opened.timeline, 'Unsaved synthetic memo');
  await requestClose({ ...opened, fixture: failed });
  await poll(
    async () => (await app.evaluate(() => globalThis.closeTestDialogs)) === 1,
    'Save failure did not cancel close with a visible error',
  );
  assert.equal(opened.main.isClosed(), false);
  assert.equal(await readMemo(failed), base.instances[0].memo);
  await setFault(failed, { fail: false });
  const retryMemo = 'Edited after cancelled close';
  await observeMemo(opened.timeline, retryMemo);
  await requestClose({ ...opened, fixture: failed });
  await finishWindowClose(opened, failed, retryMemo);
  assert.equal(await readMemo(failed), retryMemo);
  await verifyFreshProcess(failed, retryMemo);
  results.push({
    case: 'write-failure-cancels-close-edit-and-retry',
    freshProcess: true,
  });

  const first = await makePackage('Quit first');
  const second = await makePackage('Quit second');
  main = await launch();
  const a = await openPackage(first, main);
  const b = await openPackage(second);
  await installFaultBoundary([first, second]);
  await setFault(second, { fail: true });
  await observeMemo(a.timeline, 'First pending quit');
  await observeMemo(b.timeline, 'Second pending quit');
  await requestClose({ ...a, fixture: first, quit: true });
  await poll(
    async () => (await app.evaluate(() => globalThis.closeTestDialogs)) === 1,
    'Failed multi-window quit was not cancelled',
  );
  assert.equal(
    a.main.isClosed(),
    false,
    'No prepared owner may close when another owner fails',
  );
  assert.equal(b.main.isClosed(), false);
  assert.equal(await readMemo(second), base.instances[0].memo);
  await setFault(second, { fail: false });
  await observeMemo(a.timeline, 'First edited after quit cancelled');
  await observeMemo(b.timeline, 'Second edited after quit cancelled');
  await requestClose({ ...a, fixture: first, quit: true });
  await waitExited(app);
  app = null;
  assert.equal(await readMemo(first), 'First edited after quit cancelled');
  assert.equal(await readMemo(second), 'Second edited after quit cancelled');
  await verifyFreshProcess(first, 'First edited after quit cancelled');
  await verifyFreshProcess(second, 'Second edited after quit cancelled');
  results.push({
    case: 'all-main-quit-failure-resume-and-success',
    freshProcess: true,
  });
  const playlistFirst = await makePackage('Playlist quit owner');
  const playlistSecond = await makePackage('Playlist quit other');
  main = await launch();
  const owner = await openPackage(playlistFirst, main);
  const playlistPath = path.join(root, 'Synthetic quit playlist.stpl');
  await fs.mkdir(playlistPath);
  const clip = {
    id: 'synthetic-clip',
    timelineItemId: null,
    actionName: 'Synthetic clip',
    startTime: 0,
    endTime: 2,
    addedAt: 1,
    videoSource: video,
    note: 'Synthetic',
  };
  await fs.writeFile(
    path.join(playlistPath, 'playlist.json'),
    JSON.stringify({
      id: 'synthetic-quit-playlist',
      name: 'Synthetic quit playlist',
      type: 'reference',
      createdAt: 1,
      updatedAt: 1,
      items: [clip],
    }),
  );
  const [playlist] = await Promise.all([
    app.waitForEvent('window'),
    owner.main.evaluate(
      (file) => window.electronAPI.playlist.loadPlaylistFile(file),
      playlistPath,
    ),
  ]);
  await playlist.getByTestId('organizer-clip-synthetic-clip').waitFor();
  await owner.main.evaluate(
    (item) => window.electronAPI.playlist.addItemToAllWindows(item),
    {
      ...clip,
      id: 'synthetic-added-clip',
      actionName: 'Added synthetic clip',
    },
  );
  await playlist.getByTestId('organizer-clip-synthetic-added-clip').waitFor();
  const other = await openPackage(playlistSecond);
  await installFaultBoundary([playlistFirst, playlistSecond]);
  await app.evaluate(({ dialog }) => {
    globalThis.closeTestPlaylistCancels = 0;
    const show = dialog.showMessageBox.bind(dialog);
    dialog.showMessageBox = async (...args) => {
      if (args.at(-1).title === '未保存の変更') {
        globalThis.closeTestPlaylistCancels++;
        return { response: 2, checkboxChecked: false };
      }
      return show(...args);
    };
  });
  await observeMemo(owner.timeline, 'Owner saved before Playlist cancelled');
  await observeMemo(other.timeline, 'Other saved before Playlist cancelled');
  await requestClose({ ...owner, fixture: playlistFirst, quit: true });
  await poll(
    async () =>
      (await app.evaluate(() => globalThis.closeTestPlaylistCancels)) > 0,
    'The existing dirty Playlist dialog did not cancel quit',
  );
  // Native platforms may already have closed some main windows before a later
  // Playlist cancels. Every survivor must resume; every closed owner was saved.
  await delay(300);
  const expected = new Map([
    [playlistFirst, 'Owner saved before Playlist cancelled'],
    [playlistSecond, 'Other saved before Playlist cancelled'],
  ]);
  let survivingOwners = 0;
  for (const [opened, fixture] of [
    [owner, playlistFirst],
    [other, playlistSecond],
  ]) {
    if (!opened.main.isClosed()) {
      survivingOwners++;
      const memo = 'Edited after native Playlist cancelled quit';
      await observeMemo(opened.timeline, memo);
      expected.set(fixture, memo);
    }
  }
  await playlist.bringToFront();
  await playlist.waitForFunction(() => document.hasFocus());
  await playlist.keyboard.press(
    process.platform === 'darwin' ? 'Meta+s' : 'Control+s',
  );
  await poll(async () => {
    const saved = JSON.parse(
      await fs.readFile(path.join(playlistPath, 'playlist.json'), 'utf8'),
    );
    return saved.items.some((item) => item.id === 'synthetic-added-clip');
  }, 'The real Playlist save did not retain its dirty added clip');
  await closeApplication();
  for (const [fixture, memo] of expected) {
    assert.equal(await readMemo(fixture), memo);
    await verifyFreshProcess(fixture, memo);
  }
  results.push({
    case: 'native-dirty-playlist-cancels-quit',
    survivingOwners,
    freshProcess: true,
  });
  console.log(
    JSON.stringify({ platform: process.platform, cases: results }, null, 2),
  );
  console.log('Timeline native close/quit persistence regression passed');
} finally {
  if (app && processes.get(app)?.exitCode === null) {
    // Failure cleanup only; never used to satisfy a close/quit assertion.
    await app.close().catch(() => undefined);
  }
  await fs.rm(root, { recursive: true, force: true });
}
