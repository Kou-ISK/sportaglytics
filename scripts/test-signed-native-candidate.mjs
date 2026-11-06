import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron } from 'playwright';
import { getElectronLaunchOptions } from './e2e-electron-launch.mjs';

const root = await mkdtemp(join(tmpdir(), 'sportag-signed-native-'));
let app;
try {
  execFileSync('python3', ['-m', 'zipfile', '-e', 'samples/synthetic-first-run.stpkg.zip', root]);
  const pkg = join(root, 'Synthetic-first-run.stpkg');
  const video = join(pkg, 'videos/synthetic.mp4');
  const ffmpeg = process.env.SPORTAGLYTICS_FFMPEG_PATH;
  const ffprobe = process.env.SPORTAGLYTICS_FFPROBE_PATH;
  assert.ok(ffmpeg && ffprobe);
  execFileSync(ffmpeg, [
    '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=60000/1001:duration=8.008',
    '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=8.008',
    '-f', 'lavfi', '-i', 'sine=frequency=660:sample_rate=48000:duration=8.008',
    '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=48000:duration=8.008',
    '-map', '0:v', '-map', '1:a', '-map', '2:a', '-map', '3:a',
    '-c:v', 'h264_videotoolbox', '-pix_fmt', 'yuv420p', '-video_track_timescale', '60000',
    '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-bsf:v', 'h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1:video_full_range_flag=0', '-movflags', '+write_colr',
    '-c:a', 'aac', '-ar', '48000', '-ac', '2',
    '-disposition:a:0', 'default', '-disposition:a:1', '0', '-disposition:a:2', '0', video,
  ], { stdio: 'inherit' });
  const metadata = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', video], { encoding: 'utf8' }));
  const [v, ...audio] = metadata.streams;
  assert.equal(audio.length, 3, 'synthetic fixture must have three audio streams');
  for (const [key, value] of Object.entries({ index: 0, id: '0x1', codec_type: 'video', codec_name: 'h264', width: 1920, height: 1080, pix_fmt: 'yuv420p', sample_aspect_ratio: '1:1', color_range: 'tv', color_space: 'bt709', color_transfer: 'bt709', color_primaries: 'bt709', avg_frame_rate: '60000/1001', r_frame_rate: '60000/1001', time_base: '1/60000', start_pts: 0 })) assert.equal(v[key], value, `fixture ${key}`);
  assert.equal((Number(v.duration_ts) * 2) % 1001, 0, 'fixture video end');
  for (const [index, track] of audio.entries()) {
    for (const [key, value] of Object.entries({ index: index + 1, id: `0x${index + 2}`, codec_type: 'audio', codec_name: 'aac', sample_rate: '48000', channels: 2, channel_layout: 'stereo', time_base: '1/48000', start_pts: 0, duration_ts: audio[0].duration_ts })) assert.equal(track[key], value, `fixture audio ${index} ${key}`);
  }
  const configPath = join(pkg, '.metadata/config.json');
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  config.angles[0].clips[0].durationSeconds = Number(v.duration_ts) / 60000;
  await writeFile(configPath, JSON.stringify(config));
  app = await _electron.launch(getElectronLaunchOptions(join(root, 'profile')));
  const main = await app.firstWindow();
  await main.evaluate(() => localStorage.setItem('sportaglytics-onboarding-completed', 'true'));
  await main.reload();
  await app.evaluate(({ dialog }, folder) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] }); }, pkg);
  await main.getByRole('button', { name: 'パッケージを開く', exact: true }).click();
  const canvas = main.getByLabel('ネイティブ再生映像');
  try { await canvas.waitFor({ state: 'visible', timeout: 60000 }); } catch (error) {
    const availability = await main.evaluate(() => window.electronAPI.nativePlayback.inspect());
    console.error('Native availability:', JSON.stringify({ available: availability.available, reason: availability.reason, presentation: availability.presentation }));
    throw error;
  }
  const timeline = app.windows().find((page) => new URL(page.url()).hash === '#/timeline');
  assert.ok(timeline, 'timeline must open');
  const position = timeline.getByRole('slider', { name: 'タイムラインの再生位置' });
  const clock = async () => Number(await position.getAttribute('aria-valuenow'));
  const before = await clock();
  const original = createHash('sha256').update(await canvas.screenshot()).digest('hex');
  await timeline.keyboard.press('Space');
  await main.waitForTimeout(2200);
  const next = await clock();
  const advanced = createHash('sha256').update(await canvas.screenshot()).digest('hex');
  assert.ok(next > before + 0.3, 'timeline must advance while native surface is visible');
  assert.notEqual(advanced, original, 'native canvas must display a different synthetic image');
  await timeline.keyboard.press('Space');
  await main.waitForTimeout(500);
  const stopped = await clock();
  await timeline.keyboard.down('Shift');
  await timeline.keyboard.down('ArrowLeft');
  await main.waitForTimeout(1000);
  await timeline.keyboard.up('ArrowLeft');
  await timeline.keyboard.up('Shift');
  await main.waitForTimeout(1000);
  const reversed = await clock();
  await main.waitForTimeout(500);
  const settled = await clock();
  assert.ok(reversed < stopped - 0.2, 'timeline must move backward while native surface is visible');
  assert.ok(Math.abs(settled - reversed) < 0.1, 'release must settle the timeline');
  console.log('Signed native qualified source: visible drawn canvas, changed image, forward and reverse timeline and release passed');
} finally {
  if (app) await app.close();
  await rm(root, { recursive: true, force: true });
}
