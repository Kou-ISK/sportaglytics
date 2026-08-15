import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const { ffmpegPath } = await import('./media-tool-paths.mjs');
const repositoryPath = path.resolve(import.meta.dirname, '..');
const workPath = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-timeline-rows-e2e-'),
);
const profilePath = path.join(workPath, 'profile');
const packagePath = path.join(workPath, 'timeline-rows.stpkg');
const fixturePaths = ['angle-1.mp4', 'angle-2.mp4'].map((name, index) => {
  const outputPath = path.join(workPath, name);
  execFileSync(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${index === 0 ? 'red' : 'blue'}:s=320x180:d=3`,
    '-c:v',
    'h264_videotoolbox',
    '-pix_fmt',
    'yuv420p',
    '-y',
    outputPath,
  ]);
  return outputPath;
});
const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...electronEnvironment } =
  process.env;

const launch = (args = []) =>
  electron.launch({
    executablePath: electronPath,
    args: [repositoryPath, `--user-data-dir=${profilePath}`, ...args],
    env: { ...electronEnvironment, NODE_ENV: 'test' },
  });

const waitForTimeline = async (predicate, timeoutMs = 5000) => {
  const timelinePath = path.join(packagePath, 'timeline.json');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const document = JSON.parse(await fs.readFile(timelinePath, 'utf8'));
    if (predicate(document)) return document;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return JSON.parse(await fs.readFile(timelinePath, 'utf8'));
};

await Promise.all(
  fixturePaths.map(async (fixturePath, index) => {
    const angleDirectory = path.join(
      packagePath,
      'videos',
      'sources',
      `angle-${index + 1}`,
    );
    await fs.mkdir(angleDirectory, { recursive: true });
    await fs.copyFile(
      fixturePath,
      path.join(angleDirectory, `01-angle-${index + 1}.mp4`),
    );
  }),
);
await fs.mkdir(path.join(packagePath, '.metadata'), { recursive: true });
await fs.writeFile(
  path.join(packagePath, '.metadata', 'config.json'),
  JSON.stringify({
    team1Name: 'Red',
    team2Name: 'Blue',
    tightViewPath: 'videos/sources/angle-1/01-angle-1.mp4',
    wideViewPath: 'videos/sources/angle-2/01-angle-2.mp4',
    primaryAngleId: 'angle-1',
    secondaryAngleId: 'angle-2',
    angles: [0, 1].map((index) => ({
      id: `angle-${index + 1}`,
      name: `Angle ${index + 1}`,
      sourceKind: 'local',
      relativePath: `videos/sources/angle-${index + 1}/01-angle-${index + 1}.mp4`,
      clips: [
        {
          id: `clip-${index + 1}`,
          sourceKind: 'local',
          relativePath: `videos/sources/angle-${index + 1}/01-angle-${index + 1}.mp4`,
          gapBeforeSeconds: 0,
          timelineStartSeconds: 0,
          durationSeconds: 3,
        },
      ],
    })),
  }),
);
await fs.writeFile(
  path.join(packagePath, 'timeline.json'),
  JSON.stringify({
    version: 2,
    rows: [{ id: 'row-attack', name: 'Attack', color: '#ff5500' }],
    instances: [
      {
        id: 'instance-1',
        actionName: 'Attack',
        startTime: 0.5,
        endTime: 1.5,
        memo: '',
        color: '#0000ff',
      },
    ],
  }),
);
console.log('Package fixture created');

const electronApp = await launch();
try {
  const mainPage = await electronApp.firstWindow();
  await mainPage.evaluate(() => {
    localStorage.setItem('sportaglytics-onboarding-completed', 'true');
  });
  await mainPage.reload();
  const timelineWindowPromise = electronApp.waitForEvent('window', {
    timeout: 30_000,
  });
  await electronApp.evaluate(({ BrowserWindow }, selectedPackagePath) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send(
      'open-package-directory',
      selectedPackagePath,
    );
  }, packagePath);
  const page = await timelineWindowPromise;
  await page.waitForLoadState('domcontentloaded');
  assert.equal(new URL(page.url()).hash, '#/timeline');
  await page.getByRole('button', { name: 'Attack 行', exact: true }).waitFor({
    timeout: 30_000,
  });
  await mainPage.locator('#video_0').waitFor({ timeout: 30_000 });
  await mainPage.waitForFunction(
    () => {
      const video = document.querySelector('#video_0_html5_api');
      return (
        video instanceof HTMLVideoElement &&
        Number.isFinite(video.duration) &&
        video.duration > 0
      );
    },
    undefined,
    { timeout: 30_000 },
  );
  assert.equal(
    await mainPage.locator('[data-testid^="timeline-lane-"]').count(),
    0,
    'timeline must not remain embedded in the video window',
  );
  await page.bringToFront();
  await page.keyboard.press('Space');
  await mainPage.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return video instanceof HTMLVideoElement && !video.paused;
  });
  await page.keyboard.press('Space');
  await mainPage.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return video instanceof HTMLVideoElement && video.paused;
  });
  console.log('Detached timeline and cross-window playback hotkey passed');

  await page.keyboard.press('Space');
  await mainPage.waitForFunction(() => {
    const video = document.querySelector('#video_0_html5_api');
    return video instanceof HTMLVideoElement && video.currentTime > 1;
  });
  await page.keyboard.press('Space');
  const timeBeforeReverse = await mainPage
    .locator('#video_0_html5_api')
    .evaluate((video) => video.currentTime);
  await page.keyboard.down('Shift');
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(350);
  await page.keyboard.up('ArrowLeft');
  await page.keyboard.up('Shift');
  await mainPage.waitForFunction((before) => {
    const video = document.querySelector('#video_0_html5_api');
    return (
      video instanceof HTMLVideoElement && video.currentTime < before - 0.25
    );
  }, timeBeforeReverse);
  const reverseResult = await mainPage
    .locator('#video_0_html5_api')
    .evaluate((video) => ({
      currentTime: video.currentTime,
      paused: video.paused,
    }));
  assert.equal(
    reverseResult.paused,
    true,
    'reverse playback must stop on keyup',
  );
  console.log('Detached timeline continuous reverse hotkey passed');

  const assertPlayersVisible = async (width, height) => {
    await electronApp.evaluate(
      ({ BrowserWindow }, size) => {
        BrowserWindow.getAllWindows()[0]?.setSize(size.width, size.height);
      },
      { width, height },
    );
    await mainPage.waitForTimeout(250);
    const boxes = await mainPage
      .locator('#video_0, #video_1')
      .evaluateAll((videos) =>
        videos.map((video) => {
          const rect = video.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            visible:
              rect.bottom > 0 &&
              rect.right > 0 &&
              rect.top < window.innerHeight &&
              rect.left < window.innerWidth,
          };
        }),
      );
    assert.equal(boxes.length, 2);
    if (!boxes.every((box) => box.visible)) {
      const ancestors = await mainPage.locator('#video_0').evaluate((video) => {
        const result = [];
        let element = video;
        for (let index = 0; element && index < 6; index += 1) {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          result.push({
            tag: element.tagName,
            id: element.id,
            className: element.className,
            display: style.display,
            position: style.position,
            gridTemplateColumns: style.gridTemplateColumns,
            width: rect.width,
            height: rect.height,
          });
          element = element.parentElement;
        }
        return result;
      });
      console.log('Player ancestor layout', JSON.stringify(ancestors));
    }
    assert.ok(
      boxes.every((box) => box.width > 100 && box.height > 60 && box.visible),
      `players must remain visible at ${width}x${height}: ${JSON.stringify(boxes)}`,
    );
    const timelineBox = await page
      .getByTestId('timeline-lane-Attack')
      .boundingBox();
    assert.ok(timelineBox && timelineBox.height > 20);
  };

  await assertPlayersVisible(1200, 760);
  await assertPlayersVisible(820, 520);
  await assertPlayersVisible(640, 420);
  await assertPlayersVisible(1200, 760);
  console.log('Responsive player checks passed');

  const initialColor = await page
    .getByTestId('timeline-instance-instance-1')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.equal(
    initialColor,
    'rgb(255, 85, 0)',
    'row color must override item color',
  );
  console.log('Row-owned color check passed');

  await page.getByRole('button', { name: '行を追加' }).click();
  const newRowButton = page.getByRole('button', {
    name: '新しい行 行',
    exact: true,
  });
  await newRowButton.click();
  await page.keyboard.press('Enter');
  await page.getByLabel('行の名前').fill('Defence');
  await page.getByLabel('行の色').fill('#00aa00');
  await page.getByRole('button', { name: '保存' }).click();
  await page.getByRole('button', { name: 'Defence 行', exact: true }).waitFor();
  console.log('Row creation and editing passed');

  await page.evaluate(() => {
    const item = document.querySelector(
      '[data-testid="timeline-instance-instance-1"]',
    );
    const lane = document.querySelector(
      '[data-testid="timeline-lane-Defence"]',
    );
    if (!(item instanceof HTMLElement) || !(lane instanceof HTMLElement)) {
      throw new Error('Timeline drag targets are missing');
    }
    const dataTransfer = new DataTransfer();
    item.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer }),
    );
    lane.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, dataTransfer }),
    );
    lane.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer }));
  });
  await page.waitForTimeout(500);
  const movedColor = await page
    .getByTestId('timeline-instance-instance-1')
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  assert.equal(movedColor, 'rgb(0, 170, 0)');
  console.log('Row move passed');

  await page.getByTestId('timeline-instance-instance-1').click();
  await page.keyboard.press('Meta+c');
  const attackHeader = page.getByRole('button', {
    name: 'Attack 行',
    exact: true,
  });
  await attackHeader.click();
  assert.equal(await attackHeader.getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Meta+v');
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid^="timeline-instance-"]')
        .length === 2,
  );
  await page.waitForTimeout(400);
  const pastedDocument = JSON.parse(
    await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
  );
  assert.equal(pastedDocument.instances.length, 2);
  assert.match(pastedDocument.instances[1].id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
  assert.equal(pastedDocument.instances[1].actionName, 'Attack');
  assert.equal(pastedDocument.instances[1].color, '#ff5500');
  assert.equal(pastedDocument.instances[1].startTime, 0.5);
  assert.equal(pastedDocument.instances[1].endTime, 1.5);
  console.log('Row selection and Command+V paste passed');

  await page.evaluate(() => {
    const item = document.querySelector(
      '[data-testid="timeline-instance-instance-1"]',
    );
    const lane = document.querySelector('[data-testid="timeline-lane-Attack"]');
    if (!(item instanceof HTMLElement) || !(lane instanceof HTMLElement)) {
      throw new Error('Timeline copy drag targets are missing');
    }
    const dataTransfer = new DataTransfer();
    item.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer }),
    );
    lane.dispatchEvent(
      new DragEvent('dragover', {
        bubbles: true,
        dataTransfer,
        altKey: true,
      }),
    );
    lane.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        dataTransfer,
        altKey: true,
      }),
    );
  });
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid^="timeline-instance-"]')
        .length === 3,
  );
  await page.waitForTimeout(400);
  const optionCopiedDocument = JSON.parse(
    await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
  );
  assert.equal(optionCopiedDocument.instances.length, 3);
  assert.equal(optionCopiedDocument.instances[2].actionName, 'Attack');
  assert.equal(optionCopiedDocument.instances[2].color, '#ff5500');
  console.log('Option-drag row copy passed');

  await page.evaluate(() => {
    const source = document.querySelector(
      '[data-testid="timeline-row-header-row-attack"]',
    );
    const target = document.querySelector('[aria-label="Defence 行"]');
    if (!(source instanceof HTMLElement) || !(target instanceof HTMLElement)) {
      throw new Error('Timeline row drag targets are missing');
    }
    const dataTransfer = new DataTransfer();
    source.dispatchEvent(
      new DragEvent('dragstart', { bubbles: true, dataTransfer }),
    );
    target.dispatchEvent(
      new DragEvent('dragover', { bubbles: true, dataTransfer }),
    );
    target.dispatchEvent(
      new DragEvent('drop', { bubbles: true, dataTransfer }),
    );
  });
  await page.waitForTimeout(400);
  const reorderedDocument = JSON.parse(
    await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
  );
  assert.deepEqual(
    reorderedDocument.rows.map((row) => row.name),
    ['Defence', 'Attack'],
  );
  console.log('Row drag reorder passed');

  await page.getByRole('button', { name: '行を追加' }).click();
  const emptyRowHeader = page.getByRole('button', {
    name: '新しい行 行',
    exact: true,
  });
  await emptyRowHeader.click();
  await page.keyboard.press('Delete');
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await emptyRowHeader.waitFor({ state: 'detached' });
  console.log('Selected row deletion passed');

  const startHandle = page
    .getByTestId('timeline-instance-instance-1')
    .getByLabel('開始位置を調整');
  await startHandle.evaluate((handle) => {
    const rect = handle.getBoundingClientRect();
    handle.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        altKey: true,
        clientX: rect.left + 2,
        clientY: rect.top + 5,
      }),
    );
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        altKey: true,
        clientX: rect.left + 50,
        clientY: rect.top + 5,
      }),
    );
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const optionOnlyDocument = JSON.parse(
    await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
  );
  assert.equal(
    optionOnlyDocument.instances[0].startTime,
    0.5,
    'Option alone must not resize an instance',
  );

  await startHandle.evaluate((handle) => {
    const rect = handle.getBoundingClientRect();
    handle.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        altKey: true,
        metaKey: true,
        clientX: rect.left + 2,
        clientY: rect.top + 5,
      }),
    );
    document.dispatchEvent(
      new MouseEvent('mousemove', {
        bubbles: true,
        altKey: true,
        metaKey: true,
        clientX: rect.left + 50,
        clientY: rect.top + 5,
      }),
    );
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  });
  await page.waitForTimeout(400);
  const modifierResizeDocument = JSON.parse(
    await fs.readFile(path.join(packagePath, 'timeline.json'), 'utf8'),
  );
  assert.notEqual(
    modifierResizeDocument.instances[0].startTime,
    0.5,
    'Option + Command must resize an instance',
  );
  console.log('Timeline edge modifier checks passed');

  const playhead = page.getByTestId('timeline-playhead-Defence');
  await page.keyboard.down('Alt');
  await page.keyboard.down('Meta');
  await page.waitForFunction(() => {
    const handle = document.querySelector(
      '[data-testid="timeline-playhead-Defence"]',
    );
    return (
      handle instanceof HTMLElement &&
      getComputedStyle(handle).cursor === 'col-resize'
    );
  });
  const playheadBox = await playhead.boundingBox();
  const laneBox = await playhead.evaluate((handle) => {
    const lane = handle.parentElement;
    if (!lane) throw new Error('Timeline playhead lane is missing');
    const rect = lane.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  assert.ok(playheadBox, 'Timeline playhead must be visible');
  const hitTarget = await page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      return {
        testId: element?.getAttribute('data-testid') ?? '',
        tagName: element?.tagName ?? '',
      };
    },
    {
      x: playheadBox.x + playheadBox.width / 2,
      y: playheadBox.y + playheadBox.height / 2,
    },
  );
  assert.equal(
    hitTarget.testId,
    'timeline-playhead-Defence',
    `Timeline playhead must be the active pointer target, received ${JSON.stringify(hitTarget)}`,
  );
  const playheadRatio = (playheadBox.x - laneBox.x) / laneBox.width;
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const playheadCenterX = playheadBox.x + playheadBox.width / 2;
  const visibleLaneMinX = Math.max(laneBox.x + 12, 12);
  const visibleLaneMaxX = Math.min(
    laneBox.x + laneBox.width - 12,
    viewportWidth - 12,
  );
  const targetX =
    playheadCenterX + 120 <= visibleLaneMaxX
      ? playheadCenterX + 120
      : Math.max(visibleLaneMinX, playheadCenterX - 120);
  await page.mouse.move(
    playheadCenterX,
    playheadBox.y + playheadBox.height / 2,
  );
  await page.mouse.down();
  await page.getByTestId('timeline-create-preview').waitFor();
  await page.mouse.move(targetX, laneBox.y + 8, { steps: 4 });
  await page.evaluate(
    ({ x, y }) => {
      document.dispatchEvent(
        new MouseEvent('mousemove', {
          bubbles: true,
          buttons: 1,
          altKey: true,
          metaKey: true,
          clientX: x,
          clientY: y,
        }),
      );
    },
    { x: targetX, y: laneBox.y + 8 },
  );
  await page.waitForFunction(() => {
    const preview = document.querySelector(
      '[data-testid="timeline-create-preview"]',
    );
    return preview instanceof HTMLElement && preview.offsetWidth > 2;
  });
  const previewBox = await page
    .getByTestId('timeline-create-preview')
    .boundingBox();
  assert.ok(
    previewBox && previewBox.width > 2,
    `Timeline preview must span a range (playhead=${playheadRatio}, targetX=${targetX}, width=${previewBox?.width ?? 0})`,
  );
  await page.mouse.up();
  await page.keyboard.up('Meta');
  await page.keyboard.up('Alt');
  const document = await waitForTimeline(
    (timelineDocument) => timelineDocument.instances.length === 4,
  );
  console.log('Manual instance drag passed');
  assert.equal(document.version, 2);
  assert.deepEqual(
    document.rows.map((row) => row.name),
    ['Defence', 'Attack'],
  );
  assert.equal(document.instances[0].actionName, 'Defence');
  assert.equal(document.instances[0].color, '#00aa00');
  assert.equal(
    document.instances.length,
    4,
    'manual drag must create an instance',
  );
  assert.equal(document.instances[1].color, '#ff5500');
  assert.equal(document.instances[2].color, '#ff5500');
  assert.equal(document.instances[3].color, '#00aa00');

  const screenshotDirectory = process.env.E2E_SCREENSHOT_DIR;
  if (screenshotDirectory) {
    await fs.mkdir(screenshotDirectory, { recursive: true });
    await page.screenshot({
      path: path.join(screenshotDirectory, 'timeline-rows-resized.png'),
    });
  }
  console.log('Timeline rows and responsive layout E2E passed');
} finally {
  await electronApp.close().catch(() => undefined);
  await fs.rm(workPath, { recursive: true, force: true });
}
