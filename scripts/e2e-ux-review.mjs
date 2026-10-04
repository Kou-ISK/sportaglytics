import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-ux-'));
const packagePath = path.join(work, 'Synthetic-review.stpkg');
const profile = path.join(work, 'profile');
await fs.mkdir(path.join(packagePath, '.metadata'), { recursive: true });
await fs.mkdir(path.join(packagePath, 'videos'));
execFileSync(ffmpegPath, [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=320x180:rate=24:duration=60',
  '-threads',
  '2',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  '-y',
  path.join(packagePath, 'videos/synthetic.mp4'),
]);
const names = Array.from({ length: 24 }, (_, i) =>
  i === 23
    ? 'Blue / ラインブレイク：長いアクション名で幅と検索を確認する'
    : `Red / ${['Attack', 'Defense', 'Tackle', 'Kick', 'Scrum', 'Lineout'][i % 6]} ${Math.floor(i / 6 + 1)}`,
);
const document = {
  version: 2,
  rows: names.map((name, i) => ({
    id: `row-${i}`,
    name,
    color: i % 2 ? '#2277aa' : '#bb5533',
  })),
  instances: Array.from({ length: 240 }, (_, i) => ({
    id: `instance-${i}`,
    actionName: names[i % 24],
    startTime: (i % 10) * 5 + 1,
    endTime: (i % 10) * 5 + 3,
    memo: i === 239 ? '終盤の幅を使った攻撃。'.repeat(25) : `合成ノート ${i}`,
    labels: [{ group: '結果', name: i % 2 ? '成功' : '継続' }],
    color: i % 2 ? '#2277aa' : '#bb5533',
  })),
};
await fs.writeFile(
  path.join(packagePath, 'timeline.json'),
  JSON.stringify(document),
);
await fs.writeFile(
  path.join(packagePath, '.metadata/config.json'),
  JSON.stringify({
    team1Name: 'Red',
    team2Name: 'Blue',
    primaryAngleId: 'angle-1',
    angles: [
      {
        id: 'angle-1',
        name: 'Synthetic camera',
        sourceKind: 'local',
        relativePath: 'videos/synthetic.mp4',
        clips: [
          {
            id: 'clip-1',
            sourceKind: 'local',
            relativePath: 'videos/synthetic.mp4',
            gapBeforeSeconds: 0,
            timelineStartSeconds: 0,
            durationSeconds: 60,
          },
        ],
      },
    ],
  }),
);
let app;
const stopApp = async () => {
  // Only this harness's isolated process is destroyed; discard its synthetic Playlist.
  await app
    ?.evaluate(({ BrowserWindow }) => {
      for (const window of BrowserWindow.getAllWindows()) window.destroy();
    })
    .catch(() => {});
  await app?.close().catch(() => {});
};
const clickReviewAction = async (page, name) => {
  await page.getByRole('button', { name: '場面の操作', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
};
const screenshot = async (page, name) => {
  if (!process.env.E2E_SCREENSHOT_DIR) return;
  await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({
    path: path.join(process.env.E2E_SCREENSHOT_DIR, `${name}.png`),
  });
};
const route = async (hash) => {
  for (let n = 0; n < 100; n++) {
    const page = app
      .windows()
      .find((candidate) => new URL(candidate.url()).hash === hash);
    if (page) return page;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Window missing: ${hash}`);
};
const clickMenu = async (label, page) => {
  const id = await (
    await app.browserWindow(page)
  ).evaluate((window) => window.id);
  await app.evaluate(
    ({ Menu, BrowserWindow }, { label, id }) => {
      const find = (items) => {
        for (const item of items) {
          if (item.label === label) return item;
          const nested = item.submenu && find(item.submenu.items);
          if (nested) return nested;
        }
      };
      const item = find(Menu.getApplicationMenu().items);
      if (!item) throw new Error(`Menu item missing: ${label}`);
      item.click(item, BrowserWindow.fromId(id));
    },
    { label, id },
  );
};
const waitForSavedNote = async () => {
  for (let n = 0; n < 100; n++) {
    let saved;
    try {
      saved = JSON.parse(
        await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
      );
    } catch (error) {
      // A poll can observe writeFile's brief truncation before its complete JSON arrives.
      if (!(error instanceof SyntaxError)) throw error;
    }
    if (
      saved?.instances.find((item) => item.id === 'instance-239')?.memo ===
      '確認済み・終盤'
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Edited note was not saved');
};
try {
  app = await electron.launch(getElectronLaunchOptions(profile));
  let main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  await main
    .getByRole('button', { name: '新しいパッケージを作成', exact: true })
    .click();
  await main.getByRole('dialog').waitFor();
  await main.keyboard.press('Escape');
  await main.getByRole('dialog').waitFor({ state: 'hidden' });
  // Native dialog adapters are deterministic. Finder/Explorer itself is outside this test.
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] });
  });
  await main
    .getByRole('button', { name: 'パッケージを開く', exact: true })
    .click();
  await main
    .getByRole('button', { name: '新しいパッケージを作成', exact: true })
    .waitFor();
  await app.evaluate(
    ({ app: nativeApp }, file) =>
      nativeApp.emit('open-file', { preventDefault() {} }, file),
    packagePath,
  );
  let timeline = await route('#/timeline');
  await timeline
    .getByRole('button', { name: '場面を検索', exact: true })
    .waitFor();
  await main.waitForFunction(
    () => document.querySelector('video')?.readyState >= 2,
  );
  const initialBounds = await timeline
    .getByRole('region', { name: 'タイムライン', exact: true })
    .boundingBox();
  await screenshot(timeline, 'ux-review-closed');
  const beforeSearch = JSON.parse(
    await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
  );
  await timeline.keyboard.press(`${primaryModifier}+f`);
  const search = timeline.getByRole('textbox', {
    name: '行名・ラベル・ノートを検索',
  });
  await search.fill('終盤');
  await search.evaluate((input) => {
    for (const key of ['Enter', 'Escape'])
      input.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          isComposing: true,
          bubbles: true,
          cancelable: true,
        }),
      );
  });
  assert.equal(await search.inputValue(), '終盤');
  assert.notEqual(
    await timeline
      .getByTestId('timeline-instance-instance-239')
      .getAttribute('aria-pressed'),
    'true',
  );
  const start = performance.now();
  await timeline.keyboard.press('Enter');
  await main.waitForFunction(
    () => Math.abs(document.querySelector('video').currentTime - 46) < 0.05,
  );
  const searchMs = Math.round(performance.now() - start);
  await timeline.getByRole('status').filter({ hasText: '1 / 240' }).waitFor();
  const targetClip = timeline.getByTestId('timeline-instance-instance-239');
  await timeline.waitForFunction(() => {
    const item = document.querySelector(
      '[data-timeline-item-id="instance-239"]',
    );
    const pane = document.querySelector(
      '[role="region"][aria-label="タイムライン"]',
    );
    if (!item || !pane) return false;
    const lane = item.getBoundingClientRect(),
      viewport = pane.getBoundingClientRect();
    return lane.y >= viewport.y && lane.bottom <= viewport.bottom;
  });
  const lane = await targetClip.boundingBox();
  const viewport = await timeline
    .getByRole('region', { name: 'タイムライン', exact: true })
    .boundingBox();
  assert.ok(
    lane.y >= viewport.y &&
      lane.y + lane.height <= viewport.y + viewport.height,
  );
  const detail = timeline.getByRole('region', { name: '選択した場面の詳細' });
  assert.ok((await detail.innerText()).includes(document.instances[239].memo));
  assert.equal(
    await timeline
      .getByTestId('timeline-instance-instance-239')
      .getAttribute('aria-pressed'),
    'true',
  );
  await screenshot(timeline, 'ux-review-search');
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    ),
    beforeSearch,
    'Search and selection must not change the saved document',
  );
  await search.fill('該当しない語');
  await timeline
    .getByText('一致する場面がありません', { exact: true })
    .waitFor();
  assert.equal(
    await timeline
      .getByRole('button', { name: '場面の操作', exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(await targetClip.getAttribute('aria-pressed'), 'true');
  await screenshot(timeline, 'ux-review-no-match');
  await timeline.keyboard.press('Escape');
  assert.equal(await search.inputValue(), '');
  await timeline
    .getByRole('button', { name: '詳細へ移動', exact: true })
    .click();
  assert.equal(
    await detail.evaluate((element) => element === document.activeElement),
    true,
  );
  assert.ok(
    (
      await timeline
        .getByRole('list', { name: '場面検索の結果' })
        .getByRole('button')
        .first()
        .getAttribute('aria-description')
    ).includes('結果:'),
  );
  await timeline.getByRole('button', { name: '次の40件', exact: true }).click();
  await timeline.getByRole('button', { name: '前の40件', exact: true }).click();
  await search.focus();
  await timeline.keyboard.press('Escape');
  assert.equal(
    await timeline
      .getByRole('button', { name: '場面を検索', exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  const closedBounds = await timeline
    .getByRole('region', { name: 'タイムライン', exact: true })
    .boundingBox();
  assert.equal(
    Math.round(initialBounds.height),
    Math.round(closedBounds.height),
  );
  // Selected clips must not intercept ordinary keyboard focus movement.
  await timeline.getByTestId('timeline-instance-instance-239').focus();
  await timeline.keyboard.press('Tab');
  assert.notEqual(
    await timeline.evaluate(() =>
      document.activeElement?.getAttribute('data-timeline-item-id'),
    ),
    'instance-239',
  );
  await timeline.keyboard.press(`${primaryModifier}+f`);
  await search.fill('終盤');
  await timeline.keyboard.press('Enter');
  await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.setSize(720, 460));
  await screenshot(timeline, 'ux-review-compact');
  assert.equal(
    await timeline
      .getByRole('region', { name: 'タイムライン', exact: true })
      .isVisible(),
    true,
  );
  assert.equal(
    await timeline.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.setSize(720, 300));
  const reviewPane = timeline.getByRole('complementary', {
    name: '場面を検索',
    exact: true,
  });
  assert.equal(
    await reviewPane.evaluate((element) => getComputedStyle(element).overflowY),
    'hidden',
  );

  await screenshot(timeline, 'ux-review-min-height');
  const closeBounds = await timeline
    .getByRole('button', { name: '場面検索を閉じる' })
    .boundingBox();
  const inputBounds = await search.boundingBox();
  const paneBounds = await reviewPane.boundingBox();
  assert.ok(closeBounds.y >= paneBounds.y && inputBounds.y >= paneBounds.y);
  assert.ok(
    inputBounds.y + inputBounds.height <= paneBounds.y + paneBounds.height,
  );
  await clickReviewAction(timeline, 'Timelineで表示');
  await timeline.waitForFunction(
    () => document.activeElement?.getAttribute('aria-expanded') === 'false',
  );
  assert.equal(
    await timeline
      .getByRole('button', { name: '場面を検索', exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  assert.equal(
    await timeline
      .getByRole('region', { name: 'タイムライン', exact: true })
      .isVisible(),
    true,
  );
  await (
    await app.browserWindow(timeline)
  ).evaluate((window) => window.setSize(1280, 420));
  await timeline.keyboard.press(`${primaryModifier}+f`);
  await search.fill('終盤');
  await timeline.keyboard.press('Enter');
  await clickReviewAction(timeline, '編集');
  await timeline
    .getByRole('dialog')
    .getByRole('textbox', { name: 'ノート', exact: true })
    .fill('Escで破棄する変更');
  await timeline.keyboard.press('Escape');
  await timeline.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.equal(await search.inputValue(), '終盤');
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    ),
    beforeSearch,
  );
  await clickReviewAction(timeline, '編集');
  await timeline
    .getByRole('dialog')
    .getByRole('textbox', { name: 'ノート', exact: true })
    .fill('未保存の変更');
  await timeline
    .getByRole('button', { name: 'キャンセル', exact: true })
    .click();
  assert.ok((await detail.innerText()).includes(document.instances[239].memo));
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    ),
    beforeSearch,
  );
  await clickReviewAction(timeline, '編集');
  await timeline
    .getByRole('dialog')
    .getByRole('textbox', { name: 'ノート', exact: true })
    .fill('確認済み・終盤');
  await timeline.getByRole('button', { name: '保存', exact: true }).click();
  await waitForSavedNote();
  const editedDocument = {
    ...document,
    instances: document.instances.map((item) =>
      item.id === 'instance-239' ? { ...item, memo: '確認済み・終盤' } : item,
    ),
  };
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    ),
    editedDocument,
  );
  console.log('Edited note saved');
  await detail.getByText('確認済み・終盤', { exact: true }).waitFor();
  await clickReviewAction(timeline, 'Playlistに追加');
  const playlist = await route('#/playlist');
  await playlist
    .getByTestId(/^organizer-clip-/)
    .first()
    .click();
  await playlist.getByRole('textbox', { name: 'クリップのノート' }).waitFor();
  assert.equal(
    await playlist
      .getByRole('textbox', { name: 'クリップのノート' })
      .inputValue(),
    '確認済み・終盤',
  );
  console.log('Playlist handoff verified');
  await screenshot(playlist, 'ux-review-playlist');
  await clickMenu('分析を開く', timeline);
  const analysis = await route('#/analysis');
  await analysis
    .getByRole('tab', { name: 'クロス集計', exact: true })
    .click();
  await analysis
    .getByText('対象データ数: 240 / 240', { exact: true })
    .waitFor();
  // Real renderer reload discards its listener while the owner document remains
  // unchanged. It must recover the same 240 scenes through the ready handshake.
  await analysis.reload();
  await analysis
    .getByRole('tab', { name: 'クロス集計', exact: true })
    .click();
  await analysis
    .getByText('対象データ数: 240 / 240', { exact: true })
    .waitFor();
  const analysisSnapshot = await analysis.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const api = window.electronAPI.analysis;
        const timeout = setTimeout(() => {
          api.offSync(receive);
          reject(new Error('Analysis ready sync missing'));
        }, 10000);
        const receive = (payload) => {
          clearTimeout(timeout);
          api.offSync(receive);
          resolve(payload);
        };
        api.onSync(receive);
        api.requestSync();
      }),
  );
  assert.equal(analysisSnapshot.timeline.length, 240);
  assert.equal(
    analysisSnapshot.timeline.find((item) => item.id === 'instance-239').memo,
    '確認済み・終盤',
  );
  await screenshot(analysis, 'ux-review-analysis');
  console.log('Analysis menu initial sync verified');
  await stopApp();
  app = await electron.launch(getElectronLaunchOptions(profile));
  main = await app.firstWindow();
  await main.getByText('Synthetic-review.stpkg', { exact: true }).click();
  timeline = await route('#/timeline');
  await timeline
    .getByRole('button', { name: '場面を検索', exact: true })
    .waitFor();
  await timeline.keyboard.press(`${primaryModifier}+f`);
  await timeline.getByRole('textbox').fill('確認済み');
  await timeline.keyboard.press('Enter');
  await timeline
    .getByRole('region', { name: '選択した場面の詳細' })
    .getByText('確認済み・終盤', { exact: true })
    .waitFor();
  await main.waitForFunction(() => {
    const video = document.querySelector('video');
    return (
      video?.readyState >= 2 && video.currentSrc.endsWith('/synthetic.mp4')
    );
  });
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
    ),
    editedDocument,
  );
  const savedConfig = JSON.parse(
    await fs.readFile(path.join(packagePath, '.metadata/config.json'), 'utf8'),
  );
  assert.equal(savedConfig.angles[0].relativePath, 'videos/synthetic.mp4');
  assert.equal(
    savedConfig.angles[0].clips[0].relativePath,
    'videos/synthetic.mp4',
  );
  await stopApp();
  const heldPackage = `${packagePath}.held`;
  await fs.rename(packagePath, heldPackage);
  app = await electron.launch(getElectronLaunchOptions(profile));
  main = await app.firstWindow();
  await main.getByText('Synthetic-review.stpkg', { exact: true }).click();
  await main
    .getByRole('alert')
    .filter({
      hasText: 'パッケージを開けませんでした',
    })
    .waitFor();
  await fs.rename(heldPackage, packagePath);
  await main.getByRole('button', { name: 'もう一度開く', exact: true }).click();
  timeline = await route('#/timeline');
  await timeline
    .getByRole('button', { name: '場面を検索', exact: true })
    .waitFor();
  await main.waitForFunction(
    () => document.querySelector('video')?.readyState >= 2,
  );
  await stopApp();
  await fs.writeFile(
    path.join(packagePath, 'timeline.json'),
    JSON.stringify({ version: 2, rows: document.rows, instances: [] }),
  );
  app = await electron.launch(getElectronLaunchOptions(profile));
  main = await app.firstWindow();
  await main.getByText('Synthetic-review.stpkg', { exact: true }).click();
  timeline = await route('#/timeline');
  await timeline
    .getByRole('button', { name: '場面を検索', exact: true })
    .waitFor();
  await timeline.keyboard.press(`${primaryModifier}+f`);
  await timeline.getByText('まだタグがありません', { exact: true }).waitFor();
  await screenshot(timeline, 'ux-review-empty');
  console.log(
    JSON.stringify({
      result: 'passed',
      clips: 240,
      searchToVideoMs: searchMs,
      closedTimelineHeight: Math.round(closedBounds.height),
      checks: [
        'wizard cancel',
        'file-dialog adapter cancel',
        'native package open',
        'search and 46s video seek',
        'full note',
        'no mutation',
        'no match and clear',
        'pagination',
        'Tab escape',
        'compact close',
        'minimum-height dock access',
        'edit cancel and save',
        'Playlist handoff',
        'analysis menu initial sync',
        'recent reopen',
        'composition guard and saved document/video path preservation',
        'missing package and retry after restoration',
        'empty tags and Coding guidance',
        'matched-only detail without document selection change',
        'detail skip and accessible result descriptions',
        'sticky controls and Timeline reveal',
        'dialog Escape preserves review query',
      ],
    }),
  );
} catch (error) {
  console.error(error);
  throw error;
} finally {
  await stopApp();
  await fs.rm(work, { recursive: true, force: true });
}
