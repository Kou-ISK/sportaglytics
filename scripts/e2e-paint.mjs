import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';
import { fixtureH264Encoder, primaryModifier } from './e2e-platform.mjs';
import { ffmpegPath } from './media-tool-paths.mjs';

const workPath = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-paint-日本語 #50%-'),
);
const bundle = path.join(workPath, 'レビュー.stpl');
await fs.mkdir(bundle);
const source = path.join(bundle, '映像 #1.mp4');
execFileSync(
  ffmpegPath,
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=640x360:rate=30:duration=5',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=5',
    '-c:v',
    fixtureH264Encoder,
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    '-y',
    source,
  ],
  { windowsHide: true },
);
const documentPath = path.join(bundle, 'playlist.json');
await fs.writeFile(
  documentPath,
  JSON.stringify({
    id: 'paint-e2e',
    name: 'Paint Windows / Mac',
    type: 'reference',
    createdAt: 1,
    updatedAt: 1,
    items: [
      {
        id: 'clip-one',
        timelineItemId: 'timeline-one',
        actionName: '攻撃',
        startTime: 0,
        endTime: 5,
        addedAt: 1,
        videoSource: source,
      },
    ],
  }),
);
const app = await electron.launch(
  getElectronLaunchOptions(path.join(workPath, 'profile')),
);
app.process().stderr.on('data', (data) => process.stderr.write(data));
const readDocument = async () =>
  JSON.parse(await fs.readFile(documentPath, 'utf8'));
const waitForSaved = async (objectCount) => {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const document = await readDocument();
    if ((document.items[0]?.annotation?.objects?.length ?? 0) === objectCount) {
      assert.equal(
        document.items.length,
        1,
        'Paint editing must retain the clip',
      );
      return;
    }
    await new Promise((done) => setTimeout(done, 100));
  }
  throw new Error(`Paint save did not persist ${objectCount} objects`);
};
try {
  const main = await app.firstWindow();
  await main.evaluate(() =>
    localStorage.setItem('sportaglytics-onboarding-completed', 'true'),
  );
  await main.reload();
  const audio = await main.evaluate(
    (file) => window.electronAPI.extractAudioWavForSync(file),
    source,
  );
  assert.ok(
    audio && Buffer.from(audio, 'base64').subarray(0, 4).toString() === 'RIFF',
    'Bundled FFmpeg must extract audio for sync',
  );
  const [page, loaded] = await Promise.all([
    app.waitForEvent('window', { timeout: 10000 }),
    main.evaluate(
      (folder) => window.electronAPI.playlist.loadPlaylistFile(folder),
      bundle,
    ),
  ]);
  assert.equal(loaded?.playlist.items.length, 1, JSON.stringify(loaded));
  await page.getByTestId('organizer-clip-clip-one').waitFor();
  await page.getByRole('button', { name: 'Paint', exact: true }).click();
  await page.getByLabel('Paint クリップ').getByRole('button').first().click();
  const canvas = page.getByLabel('Paint 描画キャンバス').first();
  await canvas.waitFor();
  await page.getByRole('button', { name: '矢印', exact: true }).click();
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 100 && box.height > 100);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, {
    steps: 5,
  });
  await page.mouse.up();
  await canvas.focus();
  await page.keyboard.press(`${primaryModifier}+S`);
  await waitForSaved(1);
  await page.keyboard.press('Backspace');
  await page.keyboard.press(`${primaryModifier}+S`);
  await waitForSaved(0);
  await page.keyboard.press(`${primaryModifier}+Z`);
  await page.keyboard.press(`${primaryModifier}+S`);
  await waitForSaved(1);
  await page
    .getByRole('button', { name: 'Paintの編集パネルを折りたたむ' })
    .click();
  await page.getByRole('button', { name: 'Paintの編集パネルを開く' }).waitFor();

  if (process.env.E2E_LLAMA_MODEL) {
    const result = await main.evaluate(
      (model) =>
        window.electronAPI.llama.generate({
          model,
          prompt:
            'Return a JSON object with summary "test" and empty hypotheses, evidenceHighlights and recommendedClips arrays.',
          maxTokens: 2048,
          temperature: 0,
          timeoutMs: 120000,
          requestId: 'e2e-ai-generation',
        }),
      path.resolve(process.env.E2E_LLAMA_MODEL),
    );
    const answer = JSON.parse(result.text);
    assert.equal(typeof answer.summary, 'string');
    assert.ok(Array.isArray(answer.recommendedClips));
    console.log('Native AI generation through IPC passed');
  }
  if (process.env.E2E_SCREENSHOT_DIR) {
    await fs.mkdir(process.env.E2E_SCREENSHOT_DIR, { recursive: true });
    await page.screenshot({
      path: path.join(process.env.E2E_SCREENSHOT_DIR, 'paint-windows-mac.png'),
    });
  }
  console.log(
    'Paint drawing, Backspace, undo, save and local audio sync E2E passed',
  );
} finally {
  await app.close();
  await fs.rm(workPath, { recursive: true, force: true });
}
