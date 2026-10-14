import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Run for both built tools and the installed copy; explicitly exclude GPU MFTs.
const directory = resolve(process.argv[2] ?? '.cache/media-tools/win32-x64');
const ffmpeg = join(directory, 'ffmpeg.exe');
const ffprobe = join(directory, 'ffprobe.exe');
const exec = (tool, args) =>
  execFileSync(tool, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout: 60000,
    maxBuffer: 1024 * 1024,
  });
const encoders = exec(ffmpeg, ['-hide_banner', '-encoders']);
assert.match(encoders, /\bh264_mf\b/);
assert.doesNotMatch(encoders, /\blibopenh264\b|\blibx264\b/);
const configuration = exec(ffmpeg, ['-hide_banner', '-buildconf']);
assert.match(configuration, /--enable-mediafoundation/);
assert.doesNotMatch(configuration, /--enable-(?:libopenh264|gpl|nonfree)\b/);
const work = await mkdtemp(join(tmpdir(), 'sportaglytics-h264-mf-'));
try {
  for (const [size, rate, secondaryRate] of [
    ['1280x720', 30],
    ['1920x1080', 30],
    ['3840x1080', 30],
    ['160x90', 25, 30],
    ['160x90', 60, 60],
  ]) {
    const outputRate = Math.max(rate, secondaryRate ?? rate);
    const name = `${size}-${rate}-${secondaryRate ?? 'single'}`;
    const output = join(work, `${name}.mp4`);
    exec(ffmpeg, [
      '-hide_banner',
      '-v',
      'error',
      '-nostdin',
      '-f',
      'lavfi',
      '-i',
      `testsrc2=s=${size}:r=${rate}:d=2`,
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=48000:duration=2',
      ...(secondaryRate
        ? [
            '-f',
            'lavfi',
            '-i',
            `testsrc2=s=${size}:r=${secondaryRate}:d=2`,
            '-filter_complex',
            `[0:v]fps=${outputRate}/1[a];[2:v]fps=${outputRate}/1[b];[a][b]hstack=inputs=2,setsar=1[v]`,
            '-map',
            '[v]',
            '-map',
            '1:a',
          ]
        : []),
      '-c:v',
      'h264_mf',
      '-hw_encoding',
      '0',
      '-b:v',
      '5M',
      '-profile:v',
      '77',
      '-pix_fmt',
      'nv12',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      output,
    ]);
    const media = JSON.parse(
      exec(ffprobe, [
        '-v',
        'error',
        '-count_frames',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        output,
      ]),
    );
    const video = media.streams.find((stream) => stream.codec_type === 'video');
    const audio = media.streams.find((stream) => stream.codec_type === 'audio');
    assert.equal(video.codec_name, 'h264');
    assert.equal(video.profile, 'Main');
    assert.equal(video.pix_fmt, 'yuv420p'); // NV12 input is still H.264 4:2:0 output.
    assert.equal(Number(video.nb_read_frames), outputRate * 2);
    assert.equal(video.avg_frame_rate, `${outputRate}/1`);
    assert.equal(audio.codec_name, 'aac');
    assert.ok(
      Math.abs(Number(video.start_time) - Number(audio.start_time)) < 0.05,
    );
    assert.ok(Math.abs(Number(video.duration) - Number(audio.duration)) < 0.05);
    assert.ok(Math.abs(Number(media.format.duration) - 2) < 0.1);
    console.log(
      `Media Foundation CPU MP4: ${name}, ${outputRate * 2} decoded frames, AAC clock aligned`,
    );
  }
} finally {
  await rm(work, { recursive: true, force: true });
}
