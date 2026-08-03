import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';

const require = createRequire(import.meta.url);
const electronPath = require('electron');
const { getFfmpegPath, getFfprobePath } = require('../electron/src/mediaTools.ts');
const ffmpegPath = getFfmpegPath();
const ffprobePath = getFfprobePath();
const repositoryPath = path.resolve(import.meta.dirname, '..');
const workPath = await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-e2e-'));
const profilePath = path.join(workPath, 'profile');
const packagePath = path.join(workPath, 'e2e-sync.stpkg');
const fixturePaths = ['a.mp4', 'b.mp4', 'c.mp4'].map((name, index) => {
  const outputPath = path.join(workPath, name);
  execFileSync(ffmpegPath, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    `color=c=${['red', 'blue', 'green'][index]}:s=160x90:d=0.5`,
    '-pix_fmt',
    'yuv420p',
    '-y',
    outputPath,
  ]);
  return outputPath;
});
const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, ...electronEnvironment } =
  process.env;

const launch = async (extraArgs = []) =>
  electron.launch({
    executablePath: electronPath,
    args: [repositoryPath, `--user-data-dir=${profilePath}`, ...extraArgs],
    env: {
      ...electronEnvironment,
      NODE_ENV: 'test',
    },
  });

const listMediaFiles = async (directoryPath) => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      return entry.isDirectory() ? listMediaFiles(entryPath) : [entryPath];
    }),
  );
  return nested
    .flat()
    .filter((filePath) => /\.(?:mp4|mov|m4v|webm)$/i.test(filePath));
};

let electronApp = await launch();
try {
  await electronApp.evaluate(({ dialog }, outputPath) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [outputPath],
    });
  }, workPath);

  let page = await electronApp.firstWindow();
  await page.evaluate(() => {
    localStorage.setItem('sportaglytics-onboarding-completed', 'true');
  });
  await page.reload();

  const localPackage = await page.evaluate(
    async ({ outputPath, sources }) => {
      const api = window.electronAPI;
      const created = await api.createPackage(
        outputPath,
        'local-sync',
        [
          {
            id: 'angle-a',
            name: 'Angle A',
            clips: [
              {
                id: 'clip-a',
                sourceKind: 'local',
                source: sources[0],
                gapBeforeSeconds: 0,
              },
              {
                id: 'clip-b',
                sourceKind: 'local',
                source: sources[1],
                gapBeforeSeconds: 0,
              },
            ],
          },
          {
            id: 'angle-c',
            name: 'Angle C',
            clips: [
              {
                id: 'clip-c',
                sourceKind: 'local',
                source: sources[2],
                gapBeforeSeconds: 0,
              },
            ],
          },
        ],
        { team1Name: 'Red', team2Name: 'Blue' },
      );
      return api.applyClipTimeline(created.metaDataConfigFilePath, [
        { clipId: 'clip-a', timelineStartSeconds: 0 },
        { clipId: 'clip-b', timelineStartSeconds: 2 },
        { clipId: 'clip-c', timelineStartSeconds: 0 },
      ]);
    },
    { outputPath: workPath, sources: fixturePaths },
  );
  const localConfig = JSON.parse(
    await fs.readFile(
      path.join(workPath, 'local-sync.stpkg', '.metadata', 'config.json'),
      'utf8',
    ),
  );
  assert.ok(
    Math.abs(localConfig.angles[0].clips[1].gapBeforeSeconds - 1.5) < 0.05,
    'clip B must have a derived black gap',
  );
  const packageMediaFiles = await listMediaFiles(
    path.join(workPath, 'local-sync.stpkg', 'videos'),
  );
  assert.equal(
    packageMediaFiles.length,
    3,
    'the package must retain only the three immutable source clips',
  );
  assert.ok(
    packageMediaFiles.every((filePath) =>
      filePath.includes(`${path.sep}videos${path.sep}sources${path.sep}`),
    ),
    'no angle-level playback file may be rendered for a timeline gap',
  );
  assert.equal(
    localPackage.angles[0].absolutePath,
    packageMediaFiles.find((filePath) => filePath.endsWith('01-a.mp4')),
    'the angle fallback path must point at its first immutable source clip',
  );
  const mediaStatsBeforeRejectedApply = await Promise.all(
    packageMediaFiles.map(async (filePath) => ({
      filePath,
      size: (await fs.stat(filePath)).size,
      mtimeMs: (await fs.stat(filePath)).mtimeMs,
    })),
  );
  const stableConfigPath = path.join(
    workPath,
    'local-sync.stpkg',
    '.metadata',
    'config.json',
  );
  const configBeforeRejectedApply = await fs.readFile(stableConfigPath, 'utf8');
  const rejectedMessage = await page.evaluate(async (configPath) => {
    try {
      await window.electronAPI.applyClipTimeline(configPath, [
        { clipId: 'clip-a', timelineStartSeconds: 0 },
        { clipId: 'clip-b', timelineStartSeconds: 0.25 },
        { clipId: 'clip-c', timelineStartSeconds: 0 },
      ]);
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  }, stableConfigPath);
  assert.match(rejectedMessage, /CLIP_TIMELINE_OVERLAP/);
  assert.equal(
    await fs.readFile(stableConfigPath, 'utf8'),
    configBeforeRejectedApply,
    'a rejected overlap must not replace config',
  );
  assert.deepEqual(
    await Promise.all(
      packageMediaFiles.map(async (filePath) => ({
        filePath,
        size: (await fs.stat(filePath)).size,
        mtimeMs: (await fs.stat(filePath)).mtimeMs,
      })),
    ),
    mediaStatsBeforeRejectedApply,
    'timeline placement must not rewrite any playback media',
  );
  console.log('Local package persistence passed');

  await page.getByText('新規パッケージ', { exact: true }).click();
  await page.getByLabel('パッケージ').fill('e2e-sync');
  await page.getByLabel('Team 1').fill('Red');
  await page.getByLabel('Team 2').fill('Blue');
  await page.getByRole('button', { name: '次へ' }).click();

  assert.equal(
    await page.getByText('同期を調整…').count(),
    0,
    'creation wizard must not expose sync placement',
  );
  assert.equal(
    await page
      .getByRole('button', {
        name: 'このアングルに映像を追加',
      })
      .count(),
    1,
  );

  const addYoutube = async (url) => {
    await page
      .getByRole('button', { name: 'このアングルに映像を追加' })
      .click();
    await page.getByRole('menuitem', { name: /YouTube/ }).click();
    await page.getByRole('textbox', { name: 'YouTube URL' }).fill(url);
    await page.getByRole('button', { name: '追加' }).click();
  };
  await addYoutube('https://www.youtube.com/watch?v=M7lc1UVf-VE');
  await addYoutube('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  await page.getByRole('button', { name: 'パッケージを作成…' }).click();
  await page.getByText('タイムラインが空です。', { exact: false }).waitFor({
    timeout: 30_000,
  });
  await page.keyboard.press('Meta+Shift+T');
  await page.getByText('クリップ単位シンク').waitFor();
  assert.equal(
    await page.getByRole('combobox').count(),
    2,
    'reference and target clip selectors must be visible',
  );
  await electronApp.evaluate(({ session }) => {
    session.defaultSession.setDisplayMediaRequestHandler((_request, callback) =>
      callback({}),
    );
  });
  await page.getByRole('button', { name: '音声で微調整' }).click();
  await page
    .getByText('音声を解析できませんでした。手動配置は維持されています。')
    .waitFor();
  await page.getByRole('button', { name: 'キャンセル' }).click();

  const config = JSON.parse(
    await fs.readFile(
      path.join(packagePath, '.metadata', 'config.json'),
      'utf8',
    ),
  );
  assert.equal(config.angles[0].clips.length, 2);
  assert.equal(config.angles[0].clips[0].timelineStartSeconds, 0);
  config.angles[0].clips[0].durationSeconds = 1;
  config.angles[0].clips[1].timelineStartSeconds = 2;
  config.angles[0].clips[1].durationSeconds = 1;
  config.angles[0].clips[1].gapBeforeSeconds = 1;
  await fs.writeFile(
    path.join(packagePath, '.metadata', 'config.json'),
    JSON.stringify(config, null, 2),
  );
  console.log('YouTube package creation passed');

  await electronApp.close();
  console.log('Launching local virtual timeline');
  electronApp = await launch([path.join(workPath, 'local-sync.stpkg')]);
  page = await electronApp.firstWindow();
  await page.getByText('タイムラインが空です。', { exact: false }).waitFor({
    timeout: 30_000,
  });
  await page.locator('#video_0').waitFor({ timeout: 30_000 });
  const codingPanelWindowPromise = electronApp.waitForEvent('window', {
    timeout: 10_000,
  });
  await page.evaluate(() => window.electronAPI.codingPanelWindow.openWindow());
  const codingPanelPage = await codingPanelWindowPromise;
  await codingPanelPage.getByRole('button', { name: 'コード' }).waitFor({
    timeout: 10_000,
  });
  const hotkeyStartedAt = Date.now();
  await codingPanelPage.keyboard.press('Space');
  await page
    .getByRole('button', { name: '一時停止' })
    .waitFor({ timeout: 750 });
  assert.ok(
    Date.now() - hotkeyStartedAt < 750,
    'a focused code window hotkey must control playback without IPC lag',
  );
  await page.waitForTimeout(850);
  assert.equal(
    await page.locator('#video_0').count(),
    0,
    'the primary angle must render black during its virtual gap',
  );
  await page.waitForTimeout(1_400);
  await page.locator('#video_0').waitFor({ timeout: 5_000 });
  const exportPath = path.join(workPath, 'export');
  await fs.mkdir(exportPath);
  const exportResult = await page.evaluate(
    async ({ sourcePath, outputDir }) =>
      window.electronAPI.exportClipsWithOverlay?.({
        sourcePath,
        mode: 'single',
        exportMode: 'perInstance',
        angleOption: 'single',
        outputDir,
        outputFileName: 'virtual-gap',
        clips: [
          {
            id: 'virtual-gap',
            actionName: 'virtual-gap',
            startTime: 0,
            endTime: 2.5,
          },
        ],
        overlay: {
          enabled: false,
          showActionName: false,
          showActionIndex: false,
          showLabels: false,
          showMemo: false,
        },
      }),
    { sourcePath: localPackage.angles[0].absolutePath, outputDir: exportPath },
  );
  assert.equal(exportResult?.success, true, exportResult?.error);
  const exportedFiles = await listMediaFiles(exportPath);
  assert.equal(exportedFiles.length, 1);
  const exportedDuration = Number(
    execFileSync(ffprobePath, [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=nw=1:nk=1',
      exportedFiles[0],
    ])
      .toString()
      .trim(),
  );
  assert.ok(
    exportedDuration >= 2.45 && exportedDuration < 2.7,
    'export may transiently materialize the virtual gap',
  );
  assert.equal(
    (await listMediaFiles(path.join(workPath, 'local-sync.stpkg', 'videos')))
      .length,
    3,
    'transient export must not add playback media to the package',
  );
  console.log('Local virtual gap playback passed');

  await electronApp.close();
  console.log('Launching persisted YouTube timeline');
  electronApp = await launch([packagePath]);
  page = await electronApp.firstWindow();
  await page.getByText('タイムラインが空です。', { exact: false }).waitFor({
    timeout: 30_000,
  });
  await page.locator('iframe[src*="M7lc1UVf-VE"]').waitFor({
    timeout: 30_000,
  });
  await page.keyboard.press('Space');
  await page.locator('iframe[src*="dQw4w9WgXcQ"]').waitFor({
    timeout: 10_000,
  });
  await page.keyboard.press('Meta+Shift+T');
  await page.getByText('クリップ単位シンク').waitFor();
  assert.equal(await page.getByRole('combobox').count(), 2);

  console.log(`Electron E2E passed: ${packagePath}`);
} finally {
  await electronApp.close().catch(() => undefined);
  await fs.rm(workPath, { recursive: true, force: true });
}
