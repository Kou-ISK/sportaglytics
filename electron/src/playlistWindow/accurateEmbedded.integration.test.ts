import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect, it, vi } from 'vitest';
import type { Playlist } from '../../../src/types/playlist/core';

// This optional test uses only generated synthetic video and an explicitly
// supplied local ffmpeg with libx264; it does not exercise VideoToolbox.
vi.mock('../mediaTools', () => ({
  H264_ENCODER_ARGS: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20'],
  getFfprobePath: () => process.env.PLAYLIST_TEST_FFPROBE ?? 'ffprobe',
}));
import { savePlaylistToPath, loadPlaylistFromPath } from './storage';
import {
  captureAcceptedEmbeddedDocument,
  reusableEmbeddedAssets,
} from './acceptedEmbeddedAssets';

const ffmpeg = process.env.PLAYLIST_TEST_FFMPEG;
const ffprobe = process.env.PLAYLIST_TEST_FFPROBE;
const hash = (bytes: Buffer): string =>
  createHash('sha256').update(bytes).digest('hex');
const toneMagnitude = (samples: Buffer, frequency: number): number => {
  let real = 0,
    imaginary = 0;
  const count = samples.length / 4;
  for (let index = 0; index < count; index++) {
    const sample = samples.readFloatLE(index * 4);
    const angle = (2 * Math.PI * frequency * index) / 8000;
    real += sample * Math.cos(angle);
    imaginary += sample * Math.sin(angle);
  }
  return Math.hypot(real, imaginary) / count;
};
it.skipIf(!ffmpeg || !ffprobe)(
  'retains a non-keyframe interval and both synthetic audio tracks across save and save as',
  async () => {
    if (!ffmpeg || !ffprobe) throw Error('Missing synthetic test tools');
    const root = await mkdtemp(path.join(tmpdir(), 'playlist-accurate-'));
    try {
      const source = path.join(root, 'source.mp4');
      execFileSync(ffmpeg, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=96x64:rate=30',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=880:sample_rate=48000',
        '-t',
        '6',
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-map',
        '2:a:0',
        '-c:v',
        'libx264',
        '-g',
        '60',
        '-keyint_min',
        '60',
        '-sc_threshold',
        '0',
        '-c:a',
        'aac',
        '-disposition:a:0',
        '0',
        '-disposition:a:1',
        'default',
        '-y',
        source,
      ]);
      const originalHash = hash(await readFile(source));
      const playlist: Playlist = {
        id: 'synthetic',
        name: 'Synthetic',
        type: 'embedded',
        createdAt: 0,
        updatedAt: 0,
        items: [
          {
            id: 'item',
            timelineItemId: null,
            actionName: 'Synthetic',
            startTime: 0.314723,
            endTime: 5.266263,
            addedAt: 0,
            videoSource: source,
            annotation: {
              freezeAt: 0,
              freezeDuration: 1,
              objects: [
                {
                  id: 'mark',
                  type: 'pen',
                  color: '#fff',
                  strokeWidth: 1,
                  startX: 1,
                  startY: 1,
                  timestamp: 2,
                },
              ],
            },
          },
        ],
      };
      const event = {
        sender: { isDestroyed: () => true },
      } as unknown as Electron.IpcMainInvokeEvent;
      const packagePath = path.join(root, 'saved.stpl');
      await savePlaylistToPath(packagePath, playlist, event, ffmpeg);
      const saved = await loadPlaylistFromPath(packagePath);
      const video = saved.items[0].videoSource;
      if (!video) throw Error('Missing saved video');
      expect(saved.items[0].startTime).toBe(0);
      expect(saved.items[0].annotation?.objects[0].timestamp).toBeCloseTo(
        2 - 0.314723,
        8,
      );
      const probe = JSON.parse(
        execFileSync(
          ffprobe,
          [
            '-v',
            'error',
            '-show_entries',
            'stream=codec_type,start_time,duration:stream_disposition=default',
            '-of',
            'json',
            video,
          ],
          { encoding: 'utf8' },
        ),
      ) as {
        streams: Array<{
          codec_type: string;
          start_time: string;
          duration: string;
          disposition?: { default: number };
        }>;
      };
      const audioStreams = probe.streams.filter(
        (stream) => stream.codec_type === 'audio',
      );
      expect(audioStreams).toHaveLength(2);
      expect(audioStreams.map((stream) => stream.disposition?.default)).toEqual(
        [0, 1],
      );
      for (const [index, expected, other] of [
        [0, 440, 880],
        [1, 880, 440],
      ] as const) {
        const samples = execFileSync(ffmpeg, [
          '-v',
          'error',
          '-ss',
          '0.5',
          '-i',
          video,
          '-map',
          `0:a:${index}`,
          '-t',
          '0.5',
          '-ac',
          '1',
          '-ar',
          '8000',
          '-f',
          'f32le',
          'pipe:1',
        ]);
        expect(toneMagnitude(samples, expected)).toBeGreaterThan(
          toneMagnitude(samples, other) * 10,
        );
      }
      const image = probe.streams.find(
        (stream) => stream.codec_type === 'video',
      );
      expect(Number(image?.start_time)).toBeLessThan(0.1);
      expect(Number(image?.duration)).toBeGreaterThan(4.85);
      const frameStats = path.join(root, 'ssim.txt');
      const compare = spawnSync(
        ffmpeg,
        [
          '-hide_banner',
          '-i',
          source,
          '-i',
          video,
          '-lavfi',
          `[0:v]trim=start=0.314723:end=5.266263,setpts=PTS-STARTPTS[a];[1:v]setpts=PTS-STARTPTS[b];[a][b]ssim=stats_file=${frameStats}`,
          '-an',
          '-f',
          'null',
          '-',
        ],
        { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] },
      );
      expect(compare.status).toBe(0);
      const similarity = compare.stderr.match(/All:([\d.]+)/);
      expect(similarity).not.toBeNull();
      expect(Number(similarity?.[1])).toBeGreaterThan(0.9);
      const frames = (await readFile(frameStats, 'utf8')).trim().split('\n');
      expect(frames.length).toBeGreaterThanOrEqual(147);
      for (const frame of [frames[0], frames.at(-1)]) {
        const score = frame?.match(/All:([\d.]+)/);
        expect(score).not.toBeNull();
        expect(Number(score?.[1])).toBeGreaterThan(0.8);
      }
      const storedHash = hash(await readFile(video));
      const accepted = await captureAcceptedEmbeddedDocument(
        packagePath,
        saved,
      );
      const reusable = reusableEmbeddedAssets(accepted, saved);
      await savePlaylistToPath(
        packagePath,
        saved,
        event,
        ffmpeg,
        undefined,
        undefined,
        reusable,
      );
      expect(hash(await readFile(video))).toBe(storedHash);
      const copyPath = path.join(root, 'copy.stpl');
      await savePlaylistToPath(
        copyPath,
        saved,
        event,
        ffmpeg,
        undefined,
        undefined,
        reusable,
      );
      const copy = await loadPlaylistFromPath(copyPath);
      expect(hash(await readFile(copy.items[0].videoSource ?? ''))).toBe(
        storedHash,
      );
      expect(copy.items[0].annotation?.objects[0].timestamp).toBeCloseTo(
        2 - 0.314723,
        8,
      );
      const manifest = await readFile(path.join(packagePath, 'playlist.json'));
      await expect(
        savePlaylistToPath(
          packagePath,
          playlist,
          event,
          path.join(root, 'missing-ffmpeg'),
        ),
      ).rejects.toThrow();
      expect(await readFile(path.join(packagePath, 'playlist.json'))).toEqual(
        manifest,
      );
      expect(hash(await readFile(video))).toBe(storedHash);
      expect(hash(await readFile(source))).toBe(originalHash);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  30000,
);

it.skipIf(!ffmpeg || !ffprobe)(
  'preserves only synthetic audio tracks overlapping the cut',
  async () => {
    if (!ffmpeg || !ffprobe) throw Error('Missing synthetic test tools');
    const root = await mkdtemp(path.join(tmpdir(), 'playlist-audio-range-'));
    try {
      const source = path.join(root, 'source.mp4');
      execFileSync(ffmpeg, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc2=size=96x64:rate=30',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:sample_rate=48000:duration=1',
        '-itsoffset',
        '4',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=880:sample_rate=48000:duration=1',
        '-t',
        '6',
        '-map',
        '0:v:0',
        '-map',
        '1:a:0',
        '-map',
        '2:a:0',
        '-c:v',
        'libx264',
        '-g',
        '60',
        '-c:a',
        'aac',
        '-y',
        source,
      ]);
      const event = {
        sender: { isDestroyed: () => true },
      } as unknown as Electron.IpcMainInvokeEvent;
      const base: Playlist = {
        id: 'synthetic',
        name: 'Synthetic',
        type: 'embedded',
        createdAt: 0,
        updatedAt: 0,
        items: [
          {
            id: 'item',
            timelineItemId: null,
            actionName: 'Synthetic',
            startTime: 1.5,
            endTime: 3.5,
            addedAt: 0,
            videoSource: source,
          },
        ],
      };
      for (const [name, start, end, count] of [
        ['silent', 1.5, 3.5, 0],
        ['partial', 0.5, 2.5, 1],
      ] as const) {
        const target = path.join(root, `${name}.stpl`);
        await savePlaylistToPath(
          target,
          {
            ...base,
            items: [{ ...base.items[0], startTime: start, endTime: end }],
          },
          event,
          ffmpeg,
        );
        const saved = await loadPlaylistFromPath(target);
        const output = saved.items[0].videoSource;
        if (!output) throw Error('Missing saved video');
        const probe = JSON.parse(
          execFileSync(
            ffprobe,
            [
              '-v',
              'error',
              '-show_entries',
              'stream=codec_type',
              '-of',
              'json',
              output,
            ],
            { encoding: 'utf8' },
          ),
        ) as { streams: Array<{ codec_type: string }> };
        expect(
          probe.streams.filter((stream) => stream.codec_type === 'audio'),
        ).toHaveLength(count);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
  30000,
);
