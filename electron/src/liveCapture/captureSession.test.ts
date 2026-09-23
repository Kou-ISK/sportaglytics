import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  CaptureInput,
  CaptureSnapshot,
} from '../../../src/types/liveCapture';
import type { CompletedCaptureSegment } from './captureCommand';
import { CaptureSession } from './captureSession';
import {
  assertCaptureConfigEditable,
  isPackageCaptureActive,
} from './captureRegistry';

vi.mock('../mediaReferences/packageLocationRegistry', () => ({
  registerPackageLocation: vi.fn().mockResolvedValue(undefined),
}));
const processes = vi.hoisted(
  () =>
    [] as Array<{
      segments: CompletedCaptureSegment[];
      onExit: (expected: boolean) => void;
      stop: () => Promise<void>;
    }>,
);
vi.mock('./captureProcess', () => ({
  CaptureProcess: class {
    segments: CompletedCaptureSegment[] = [];
    constructor(
      readonly ffmpeg: string,
      readonly directory: string,
      readonly input: CaptureInput,
      _quality: string,
      readonly onExit: (expected: boolean) => void,
    ) {
      processes.push(this);
    }
    async collectSegments(): Promise<CompletedCaptureSegment[]> {
      return this.segments.splice(0);
    }
    async stop(): Promise<void> {
      this.onExit(true);
    }
  },
}));
let root = '';
let session: CaptureSession | undefined;
afterEach(async () => {
  await session?.stop();
  session = undefined;
  processes.length = 0;
  if (root) await fs.rm(root, { recursive: true, force: true });
});

const setup = async (
  publish: (snapshot: CaptureSnapshot) => void,
): Promise<CaptureSession> => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-unit-'));
  session = new CaptureSession(
    path.join(root, 'sample.stpkg'),
    {
      name: 'Live',
      quality: '720p',
      inputs: [
        {
          id: 'one',
          name: 'Angle 1',
          kind: 'network',
          url: 'rtsp://user:synthetic-secret@camera.example/live',
        },
      ],
    },
    'fixture-ffmpeg',
    publish,
  );
  await session.start();
  return session;
};
describe('capture durability and lifecycle', () => {
  it('preserves Timeline edits, excludes connection credentials, and finalizes independent clips', async () => {
    const capture = await setup(vi.fn());
    expect(isPackageCaptureActive(capture.packagePath)).toBe(true);
    expect(() =>
      assertCaptureConfigEditable(
        path.join(capture.packagePath, '.metadata/config.json'),
      ),
    ).toThrow('録画中');
    const document = {
      version: 2,
      rows: [],
      instances: [{ id: 'tag', startTime: 1, endTime: 3 }],
    };
    await fs.writeFile(
      path.join(capture.packagePath, 'timeline.json'),
      JSON.stringify(document),
    );
    processes[0].segments.push(
      { file: 'segment-000000.mp4', start: 0, end: 2 },
      { file: 'segment-000001.mp4', start: 2, end: 4 },
    );
    await Promise.all([capture.stop(), capture.stop()]);
    const config = await fs.readFile(
      path.join(capture.packagePath, '.metadata/config.json'),
      'utf8',
    );
    expect(config).not.toContain('synthetic-secret');
    expect(config).not.toContain('camera.example');
    expect(config).not.toContain(root);
    expect(JSON.parse(config).angles[0].clips).toHaveLength(2);
    expect(JSON.parse(config).liveCapture.phase).toBe('completed');
    expect(
      JSON.parse(
        await fs.readFile(
          path.join(capture.packagePath, 'timeline.json'),
          'utf8',
        ),
      ),
    ).toEqual(document);
    expect(isPackageCaptureActive(capture.packagePath)).toBe(false);
  });
  it('serializes reconnect with finalization and rejects retry after stop', async () => {
    const capture = await setup(vi.fn());
    processes[0].segments.push({
      file: 'segment-000000.mp4',
      start: 0,
      end: 2,
    });
    processes[0].onExit(false);
    await capture.retry('one');
    expect(processes).toHaveLength(2);
    processes[1].segments.push({
      file: 'segment-000000.mp4',
      start: 0,
      end: 2,
    });
    const retry = capture.retry('one');
    const stop = capture.stop();
    await expect(retry).rejects.toThrow('終了');
    await stop;
    expect(
      capture.snapshot.mediaAngles[0].clips.map(
        (clip) => clip.timelineStartSeconds,
      ),
    ).toEqual([0, 2]);
    expect(capture.snapshot.availableEndSeconds).toBe(4);
  });
  it('trims packet duration overlap without shifting segment starts or mutating published clips', async () => {
    const capture = await setup(vi.fn());
    processes[0].segments.push({
      file: 'segment-000000.mp4',
      start: 0,
      end: 2.035,
    });
    await vi.waitFor(
      () => expect(capture.snapshot.inputs[0].segmentCount).toBe(1),
      { timeout: 2000 },
    );
    const published = capture.snapshot.mediaAngles[0].clips[0];
    processes[0].segments.push({
      file: 'segment-000001.mp4',
      start: 2.02,
      end: 4.04,
    });
    processes[0].segments.push({
      file: 'segment-000002.mp4',
      start: 4.05,
      end: 6.05,
    });
    await capture.stop();
    const clips = capture.snapshot.mediaAngles[0].clips;
    expect(clips[0].durationSeconds).toBe(2.02);
    expect(clips[1].timelineStartSeconds).toBe(2.02);
    expect(clips[1].durationSeconds).toBeCloseTo(2.03);
    expect(clips[2].timelineStartSeconds).toBe(4.05);
    expect(capture.snapshot.inputs[0].recordedSeconds).toBeCloseTo(6.05);
    expect(published.durationSeconds).toBe(2.035);
    const saved = JSON.parse(
      await fs.readFile(
        path.join(capture.packagePath, '.metadata/config.json'),
        'utf8',
      ),
    );
    expect(saved.angles[0].clips[0].durationSeconds).toBe(2.02);
  });
  it('never overwrites an existing package', async () => {
    const capture = await setup(vi.fn());
    const duplicate = new CaptureSession(
      capture.packagePath,
      {
        name: 'Other',
        quality: '720p',
        inputs: [{ id: 'other', name: 'Other', kind: 'device' }],
      },
      'unused',
      vi.fn(),
    );
    const original = await fs.readFile(
      path.join(capture.packagePath, '.metadata/config.json'),
      'utf8',
    );
    await expect(duplicate.start()).rejects.toMatchObject({ code: 'EEXIST' });
    await duplicate.stop();
    expect(
      await fs.readFile(
        path.join(capture.packagePath, '.metadata/config.json'),
        'utf8',
      ),
    ).toBe(original);
    expect(isPackageCaptureActive(capture.packagePath)).toBe(true);
    expect(capture.snapshot.name).toBe('Live');
  });
  it('cancels startup before creating any processes or touching an existing destination', async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-cancel-'));
    session = new CaptureSession(
      path.join(root, 'cancel.stpkg'),
      {
        name: 'Live',
        quality: '720p',
        inputs: [{ id: 'one', name: 'One', kind: 'device' }],
      },
      'unused',
      vi.fn(),
    );
    const begun = session.start();
    const stopped = session.stop();
    await expect(begun).rejects.toThrow('取り消され');
    await stopped;
    expect(processes).toHaveLength(0);
    expect(isPackageCaptureActive(session.packagePath)).toBe(false);
    await expect(fs.access(session.packagePath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });
});

it('does not leave an input connecting indefinitely while no recorded media arrives', async () => {
  const capture = await setup(vi.fn());
  const now = performance.now();
  const clock = vi.spyOn(performance, 'now').mockReturnValue(now + 31000);
  try {
    await vi.waitFor(
      () => expect(capture.snapshot.inputs[0].phase).toBe('disconnected'),
      { timeout: 2500 },
    );
    expect(capture.snapshot.inputs[0].message).toContain('映像が届かない');
  } finally {
    clock.mockRestore();
  }
});
