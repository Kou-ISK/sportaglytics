import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-board-'));
const bundle = path.join(work, 'tactics.stpl');
await fs.mkdir(bundle);
const source = path.join(work, 'pitch.mp4');
execFileSync(ffmpegPath, [
  '-v',
  'error',
  '-f',
  'lavfi',
  '-i',
  'color=c=0x244B3C:s=640x360:r=30:d=5',
  '-c:v',
  fixtureH264Encoder,
  '-pix_fmt',
  'yuv420p',
  '-y',
  source,
]);
const documentPath = path.join(bundle, 'playlist.json');
await fs.writeFile(
  documentPath,
  JSON.stringify({
    id: 'board-e2e',
    name: 'Tactical board',
    type: 'reference',
    createdAt: 1,
    updatedAt: 1,
    items: [
      {
        id: 'clip-one',
        timelineItemId: null,
        actionName: 'Team A',
        startTime: 0,
        endTime: 5,
        addedAt: 1,
        videoSource: source,
      },
    ],
  }),
);
const app = await electron.launch(
  getElectronLaunchOptions(path.join(work, 'profile')),
);
let diagnostics = '';
app.process().stderr.on('data', (data) => {
  diagnostics = (diagnostics + data.toString()).slice(-5000);
});
try {
  const main = await app.firstWindow();
  console.log('Application ready');
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  console.log('Opening playlist');
  const [page] = await Promise.all([
    app.waitForEvent('window'),
    main.evaluate(
      (folder) => window.electronAPI.playlist.loadPlaylistFile(folder),
      bundle,
    ),
  ]);
  page.setDefaultTimeout(15000);
  // Neither recognition code, models nor footage may be fetched from a server.
  const remote = [];
  await page.route(/^https?:\/\//, (route) => {
    remote.push(route.request().url());
    return route.abort();
  });
  await (
    await app.browserWindow(page)
  ).evaluate((window) => window.setContentSize(1200, 900));
  await page.getByTestId('organizer-clip-clip-one').waitFor();
  await page.getByRole('button', { name: 'Paint', exact: true }).click();
  await page.getByLabel('Paint クリップ').getByRole('button').first().click();
  await page.getByRole('tab', { name: 'ピッチ' }).click();
  await page.getByRole('button', { name: '4点で較正' }).click();
  await page.getByRole('button', { name: '22m〜中央', exact: true }).click();
  await page.getByRole('button', { name: '較正を保存', exact: true }).click();
  await page.getByRole('button', { name: '戦術盤を開く' }).click();
  const dialog = page.getByRole('dialog', { name: /戦術盤/ });
  await dialog.waitFor();
  console.log('Board open; running bundled model');
  await dialog.getByRole('button', { name: '映像から配置候補を認識' }).click();
  await dialog
    .getByText(/ピッチ内の候補がありません。|映像の認識に失敗しました。/)
    .waitFor({ timeout: 120000 });
  assert.equal(
    await dialog
      .getByText('映像の認識に失敗しました。', { exact: false })
      .count(),
    0,
    'Bundled recognition must complete successfully',
  );
  assert.equal(
    remote.filter((url) => url !== 'https://www.youtube.com/iframe_api').length,
    0,
    `Recognition must work with all HTTP requests blocked: ${JSON.stringify(remote)}`,
  );
  const field = dialog.getByLabel('戦術盤のピッチ');
  const clickPitch = async (x, y) => {
    const screen = await field.evaluate(
      (svg, p) => {
        const result = new DOMPoint(p.x, p.y).matrixTransform(
          svg.getScreenCTM(),
        );
        return { x: result.x, y: result.y };
      },
      { x, y },
    );
    await page.mouse.click(screen.x, screen.y);
  };
  await dialog
    .getByLabel('戦術盤のツール')
    .getByRole('button', { name: 'チームA', exact: true })
    .click();
  await clickPitch(20, 40);
  await clickPitch(40, 45);
  await dialog
    .getByLabel('戦術盤のツール')
    .getByRole('button', { name: 'ボール', exact: true })
    .click();
  await clickPitch(25, 42);
  await dialog.getByRole('button', { name: 'チームA 1', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Backspace');
  assert.equal(
    await dialog
      .getByRole('button', { name: 'チームA 1', exact: true })
      .count(),
    0,
  );
  await dialog.getByRole('button', { name: '戦術盤を元に戻す' }).click();
  await dialog
    .getByRole('button', { name: 'チームA 1', exact: true })
    .waitFor();
  await dialog
    .getByLabel('戦術盤のツール')
    .getByRole('button', { name: '矢印', exact: true })
    .click();
  await clickPitch(25, 42);
  await page.keyboard.press('Escape');
  assert.equal(
    await dialog.isVisible(),
    true,
    'Escape must cancel the unfinished arrow, not the board',
  );
  await clickPitch(25, 42);
  await clickPitch(38, 45);
  const png = path.join(work, 'board.png');
  await app.evaluate(({ dialog }, output) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath: output });
  }, png);
  await dialog.getByRole('button', { name: 'PNG画像を書き出す' }).click();
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await fs.stat(png).catch(() => null)) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal((await fs.readFile(png)).subarray(1, 4).toString(), 'PNG');
  const pixels = execFileSync(
    ffmpegPath,
    ['-v', 'error', '-i', png, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    { maxBuffer: 8 * 1024 * 1024 },
  );
  const imageWidth = Math.round((1600 * 80) / 110);
  const offset =
    (Math.round((70 / 110) * 1600) * imageWidth +
      Math.round((35 / 80) * imageWidth)) *
    3;
  assert.deepEqual(
    [...pixels.subarray(offset, offset + 3)],
    [36, 75, 60],
    'PNG must contain the actual pitch surface',
  );

  const screenshots = process.env.E2E_SCREENSHOT_DIR;
  if (screenshots) {
    await fs.mkdir(screenshots, { recursive: true });
    await page.screenshot({
      path: path.join(screenshots, 'tactical-board.png'),
      animations: 'disabled',
    });
  }
  await dialog.getByRole('button', { name: '戦術盤を保存' }).click();
  await page.getByLabel('Paint 描画キャンバス').first().focus();
  await page.keyboard.press(`${primaryModifier}+S`);
  let saved;
  for (let i = 0; i < 100; i++) {
    try {
      saved = JSON.parse(await fs.readFile(documentPath, 'utf8'));
    } catch {
      /* Await the asynchronous save. */
    }
    if (saved?.items[0]?.annotation?.tacticalBoard?.primary) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(
    saved.items.length,
    1,
    'Deleting a board marker must not delete the clip',
  );
  assert.equal(
    saved.items[0].annotation.tacticalBoard.primary.markers.length,
    3,
  );
  assert.equal(
    saved.items[0].annotation.tacticalBoard.primary.arrows.length,
    1,
  );
  assert.deepEqual(saved.items[0].annotation.pitchCalibration.primary.region, {
    x: 0,
    y: 22,
    width: 70,
    length: 28,
  });
  await page.reload();
  await page.getByRole('button', { name: 'Paint', exact: true }).click();
  await page.getByLabel('Paint クリップ').getByRole('button').first().click();
  await page.getByRole('tab', { name: 'ピッチ' }).click();
  await page.getByRole('button', { name: '戦術盤を開く' }).click();
  await page.getByRole('button', { name: 'チームA 1', exact: true }).waitFor();
  await page.getByRole('button', { name: '戦術矢印1', exact: true }).waitFor();
  console.log(
    'Tactical board: local model, partial calibration, safe delete/undo, PNG and reload passed',
  );
} catch (error) {
  console.error(error);
  console.error(diagnostics);
  throw error;
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.rm(work, { recursive: true, force: true });
}
