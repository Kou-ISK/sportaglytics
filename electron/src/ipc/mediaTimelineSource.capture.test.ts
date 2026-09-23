import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect, it } from 'vitest';
import { readMediaTimeline } from './mediaTimelineSource';

it('loads a captured timeline with more than sixteen independently stored segments', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'capture-timeline-'));
  const pkg = path.join(root, 'live.stpkg');
  await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
  try {
    const clips = Array.from({ length: 40 }, (_, index) => ({
      id: `clip-${index}`,
      relativePath: `media/one/take-0/segment-${String(index).padStart(6, '0')}.mp4`,
      timelineStartSeconds: index * 2,
      durationSeconds: 2,
    }));
    await fs.writeFile(
      path.join(pkg, '.metadata/config.json'),
      JSON.stringify({
        angles: [{ id: 'one', relativePath: clips[0].relativePath, clips }],
      }),
    );
    const timeline = await readMediaTimeline(
      path.join(pkg, clips[0].relativePath),
      true,
    );
    expect(timeline?.clips).toHaveLength(40);
    expect(timeline?.clips[39].timelineStartSeconds).toBe(78);
    expect(timeline?.clips[39].source).toBe(
      path.join(pkg, clips[39].relativePath),
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
