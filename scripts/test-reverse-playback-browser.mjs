import { build } from 'esbuild';
import { chromium } from 'playwright';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
const directory = await mkdtemp(join(tmpdir(), 'held-reverse-'));
let browser, server;
try {
  await promisify(execFile)('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=320x180:rate=60:duration=40',
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-g',
    '60',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    join(directory, 'video.mp4'),
  ]);
  await build({
    entryPoints: ['scripts/testing/reverse-playback-browser.tsx'],
    bundle: true,
    outfile: join(directory, 'app.js'),
    define: { 'process.env.NODE_ENV': '"production"' },
    jsx: 'automatic',
  });
  const video = await readFile(join(directory, 'video.mp4'));
  const app = await readFile(join(directory, 'app.js'));
  server = createServer((req, res) => {
    if (req.url.startsWith('/video.mp4')) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? '');
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2]
        ? Math.min(Number(match[2]), video.length - 1)
        : video.length - 1;
      res.writeHead(match ? 206 : 200, {
        'content-type': 'video/mp4',
        'accept-ranges': 'bytes',
        'content-length': end - start + 1,
        ...(match
          ? { 'content-range': `bytes ${start}-${end}/${video.length}` }
          : {}),
      });
      res.end(video.subarray(start, end + 1));
    } else if (req.url === '/app.js') {
      res.writeHead(200, { 'content-type': 'text/javascript' });
      res.end(app);
    } else {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<div id="root"></div><script src="/app.js"></script>');
    }
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const results = [];
  for (const mode of process.env.REVERSE_MODE
    ? [process.env.REVERSE_MODE]
    : ['main', 'playlist']) {
    const page = await browser.newPage();
    page.on('pageerror', (e) => console.error(e));
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'platform', { value: 'MacIntel' }),
    ); // Keyboard mapping only; browser/decoder remain Linux.
    await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);
    await page.waitForFunction(() =>
      window.reverseTest
        ?.get()
        .state()
        .every((v) => v.ready >= 2),
    );
    for (const [rate, seconds, distance] of [
      [0.5, 6, 3],
      [2, 4, 8],
      [4, 2, 8],
      [6, 2, 12],
    ]) {
      await page.evaluate(() => window.reverseTest.get().seek(30));
      await page.waitForFunction(() =>
        window.reverseTest
          .get()
          .state()
          .every((v) => !v.seeking && v.ready >= 2),
      );
      const initialPTS = mode === 'playlist' ? 18 : 30;
      await page.waitForFunction((pts) => {
        const frames = window.reverseTest
          .trace()
          .frames.filter((f) => f.angle === 0);
        return Math.abs((frames.at(-1)?.pts ?? -1) - pts) < 0.02;
      }, initialPTS);
      const started = await page.evaluate(() => {
        window.reverseTest.reset();
        return performance.now();
      });
      const modifier =
        rate === 2 ? 'Shift' : rate === 4 ? 'Alt' : rate === 6 ? 'Meta' : null;
      if (modifier) await page.keyboard.down(modifier);
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(seconds * 1000);
      const released = await page.evaluate(() => performance.now());
      await page.keyboard.up('ArrowLeft');
      if (modifier) await page.keyboard.up(modifier);
      await page
        .waitForFunction(
          ({ target }) =>
            window.reverseTest.get().reverse.isReverseSettled() &&
            Math.abs(window.reverseTest.get().time - target) < 0.7 &&
            window.reverseTest
              .get()
              .state()
              .every((v) => !v.seeking),
          { target: 30 - distance },
          { timeout: 7000 },
        )
        .catch(async (error) => {
          console.log(
            JSON.stringify(
              await page.evaluate(() => ({
                time: window.reverseTest.get().time,
                state: window.reverseTest.get().state(),
                errors: window.reverseTest.trace().errors,
                frames: window.reverseTest.trace().frames.slice(-8),
              })),
            ),
          );
          throw error;
        });
      const data = await page.evaluate(() => ({
        ...window.reverseTest.trace(),
        time: window.reverseTest.get().time,
        at: performance.now(),
      }));
      assert.deepEqual(data.errors, []);
      const frames = data.frames.filter(
        (f) =>
          f.angle === 0 &&
          f.at >= started &&
          f.at <= released &&
          f.pts < initialPTS - 0.001,
      );
      const distinct = frames.filter(
        (f, i) => i === 0 || f.pts !== frames[i - 1].pts,
      );
      assert(
        distinct.length >= 5,
        `${mode} ${rate}: insufficient distinct images`,
      );
      assert(
        distinct.every((f, i) => i === 0 || f.pts < distinct[i - 1].pts),
        `${mode} ${rate}: non-reverse PTS`,
      );
      const gaps = distinct.map(
        (f, i) => f.at - (i ? distinct[i - 1].at : started),
      );
      assert(
        Math.max(...gaps, released - distinct.at(-1).at) < 1000,
        `${mode} ${rate}: stalled presentation`,
      );
      const result = {
        mode,
        rate,
        heldMs: released - started,
        finalTime: data.time,
        expectedTime: 30 - distance,
        distinctPTS: distinct.length,
        firstImageMs: distinct[0].at - started,
        maxDrawGapMs: Math.max(...gaps, released - distinct.at(-1).at),
        releaseSettledMs: data.at - released,
        seeks: data.seekCount,
      };
      results.push(result);
      console.log(JSON.stringify(result));
    }
    if (mode === 'playlist') {
      await page.evaluate(() => window.reverseTest.get().seek(13));
      await page.waitForFunction(() =>
        window.reverseTest
          .get()
          .state()
          .every((v) => !v.seeking && v.ready >= 2),
      );
      await page.evaluate(() => {
        window.reverseTest.reset();
        window.reverseTest.get().reverse.startReversePlayback(6);
      });
      await page.waitForTimeout(2200);
      await page.evaluate(() =>
        window.reverseTest.get().reverse.stopReversePlayback(),
      );
      await page.waitForFunction(
        () => Math.abs(window.reverseTest.get().time - 2) < 0.05,
        null,
        { timeout: 7000 },
      );
      const data = await page.evaluate(() => ({
        ...window.reverseTest.trace(),
        time: window.reverseTest.get().time,
        state: window.reverseTest.get().state(),
      }));
      assert.deepEqual(data.errors, []);
      assert.equal(data.time, 2);
      assert(Math.abs(data.state[1].time - data.state[0].time - 0.7) < 0.03);
      console.log(
        'playlist clip/gap crossing, lower bound and 0.7s angle offset passed',
      );
    }
    await page.close();
  }
  if (process.env.REVERSE_RESULTS)
    await writeFile(
      resolve(process.env.REVERSE_RESULTS),
      JSON.stringify(results, null, 2),
    );
} finally {
  await browser?.close();
  await new Promise((ok) => (server ? server.close(ok) : ok()));
  await rm(directory, { recursive: true, force: true });
}
