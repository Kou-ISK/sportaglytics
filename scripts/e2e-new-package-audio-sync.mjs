import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
import { getTimelineWindow } from './e2e-angle-sync-workspace.mjs';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sportag-audio-pair-'));
const folder = path.join(root, 'Audio Pair.stpkg');
const config = path.join(folder, '.metadata', 'config.json');
const profile = path.join(root, 'profile');
const delay = 1.25;
const sampleRate = 16000;
const seconds = 32;
const sources = ['primary', 'secondary'].map(name => path.join(root, name + '.mp4'));

async function createMedia() {
  // Aperiodic amplitude and waveform give the correlator a unique match.
  const pcm = Buffer.alloc(sampleRate * seconds * 2);
  let seed = 42;
  let gain = 1;
  for (let i = 0; i < pcm.length / 2; i++) {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    if (i % 3200 === 0) gain = 0.05 + 0.9 * seed / 2 ** 32;
    pcm.writeInt16LE(Math.round((seed / 2 ** 31 - 1) * gain * 20000), i * 2);
  }
  for (const [index, source] of sources.entries()) {
    const audio = index === 0 ? pcm : Buffer.concat([Buffer.alloc(sampleRate * delay * 2), pcm]);
    // The output is intentionally shorter than the delayed source. A file
    // avoids EPIPE if FFmpeg reaches its output limit before draining input.
    const input = source + '.pcm';
    await fs.writeFile(input, audio);
    execFileSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-f', 's16le', '-ar', String(sampleRate), '-ac', '1', '-i', input,
      '-f', 'lavfi', '-i', 'color=c=blue:s=160x90:r=10', '-map', '1:v', '-map', '0:a',
      '-c:v', fixtureH264Encoder, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-t', String(seconds), source,
    ], {timeout: 60000});
  }
}

async function createFromWizard(app, page) {
  await app.evaluate(({ dialog }, { sources, root }) => {
    const files = [...sources];
    dialog.showOpenDialog = async (...args) => {
      const directory = args.at(-1)?.properties?.includes('openDirectory');
      return {canceled: false, filePaths: [directory ? root : files.shift()]};
    };
  }, { sources, root });
  await page.getByText('新しいパッケージを作成', {exact: true}).click();
  await page.getByRole('textbox', {name: 'パッケージ', exact: true}).fill('Audio Pair');
  await page.getByLabel('Team 1').fill('Red');
  await page.getByLabel('Team 2').fill('Blue');
  await page.getByRole('button', {name: '次へ'}).click();
  for (const [i, source] of sources.entries()) {
    if (i) await page.getByRole('button', {name: 'アングルを追加', exact: true}).click();
    await page.getByRole('button', {name: 'このアングルに映像を追加'}).click();
    await page.getByRole('menuitem', {name: /ローカル映像/}).click();
    await page.getByText(path.basename(source), {exact: true}).first().waitFor();
  }
  await page.getByRole('button', {name: 'パッケージを作成…'}).click();
  await page.locator('#video_1 video').waitFor();
}

async function verifyPlayers(page, globalTime) {
  await page.waitForFunction(({delay, globalTime}) => {
    const a = document.querySelector('#video_0 video');
    const b = document.querySelector('#video_1 video');
    return a && b && !a.seeking && !b.seeking && a.readyState >= 2 && b.readyState >= 2 &&
      (globalTime == null || Math.abs(a.currentTime - globalTime) < 0.12) &&
      Math.abs(b.currentTime - a.currentTime - delay) < 0.12;
  }, {delay, globalTime}, {timeout: 30000});
}

async function analyze(app, page) {
  const timeline = await getTimelineWindow(app);
  const handle = await app.browserWindow(timeline);
  try {
    await app.evaluate(({Menu}, owner) => {
      const command = Menu.getApplicationMenu()?.getMenuItemById('resync-package-audio');
      if (!command) throw new Error('Sync menu missing');
      command.click(command, owner, {});
    }, handle);
  } finally {
    await handle.dispose();
  }
  await page.getByText('音声同期完了', {exact: true}).waitFor({timeout: 30000});
  await verifyPlayers(page);
  await page.waitForFunction(async configPath => {
    const data = await window.electronAPI.readJsonFile(configPath);
    return data.syncData?.isAnalyzed && data.syncData.angleOffsets?.length === 2;
  }, config);
  const data = JSON.parse(await fs.readFile(config, 'utf8'));
  assert.ok(Math.abs(data.syncData.syncOffset - delay) < 0.06, JSON.stringify(data.syncData));
  assert.deepEqual(data.syncData.angleOffsets, [0, data.syncData.syncOffset]);
  return data.syncData.syncOffset;
}

async function mainPage(app) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const page = app.windows().find(p => p.url().startsWith('file:') && !new URL(p.url()).hash);
    if (page) return page;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Package window missing');
}

let app;
try {
  await createMedia();
  app = await electron.launch(getElectronLaunchOptions(profile));
  let page = await mainPage(app);
  await page.evaluate(() => localStorage.setItem('sportaglytics-onboarding-completed', 'true'));
  await page.reload();
  await createFromWizard(app, page);
  const fresh = await analyze(app, page);
  console.log('Fresh package offset (seconds):', fresh);
  await app.close();
  app = undefined;
  app = await electron.launch(getElectronLaunchOptions(profile, [folder]));
  page = await mainPage(app);
  await page.locator('#video_1 video').waitFor();
  const timeline = await getTimelineWindow(app);
  await timeline.getByTestId('timeline-ruler').waitFor();
  await timeline.evaluate(() => {
    window.electronAPI.timelineWindow.sendCommand({type: 'seek', time: 4});
  });
  await verifyPlayers(page, 4);
  const reopened = await analyze(app, page);
  assert.ok(Math.abs(fresh - reopened) < 0.02);
  console.log('Synthetic audio delay, fresh/reopened seconds:', delay, fresh, reopened);
} finally {
  await app?.close();
  await fs.rm(root, {recursive: true, force: true});
}
