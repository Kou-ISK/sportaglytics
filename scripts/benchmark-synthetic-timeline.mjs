import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createSyntheticTimeline,
  summarizeTimings,
} from './synthetic-timeline-workload.mjs';
import { searchTimeline } from '../src/features/videoPlayer/components/Timeline/VisualTimeline/review/timelineReviewSearch.ts';
import { validateTimelineDocumentData } from '../src/shared/timeline/timelineValidation.ts';
import { writeTextFileAtomically } from '../electron/src/ipc/atomicTextFile.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = path.resolve(
  process.argv[2] ?? 'output/benchmarks/synthetic-timeline.json',
);
const sourceFiles = [
  'src/features/videoPlayer/components/Timeline/VisualTimeline/review/timelineReviewSearch.ts',
  'src/shared/timeline/timelineValidation.ts',
  'electron/src/ipc/atomicTextFile.ts',
];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const temporary = await fs.mkdtemp(
  path.join(os.tmpdir(), 'sportaglytics-bounded-benchmark-'),
);
const measure = async (operation, warmups = 5, repetitions = 30) => {
  for (let index = 0; index < warmups; index++) await operation();
  const values = [];
  for (let index = 0; index < repetitions; index++) {
    const start = performance.now();
    await operation();
    values.push(performance.now() - start);
  }
  return { ...summarizeTimings(values), samplesMs: values };
};
try {
  // Refuse a pre-existing report before doing the benchmark; retain prior evidence.
  try {
    await fs.access(output);
    throw new Error('Report already exists; choose a new output path');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const stat = await fs.statfs(temporary);
  const report = {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      osRelease: os.release(),
      cpu: os.cpus()[0]?.model,
      availableParallelism: os.availableParallelism(),
      tmpFilesystemType: `0x${stat.type.toString(16)}`,
      sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).trim(),
      sources: await Promise.all(
        sourceFiles.map(async (file) => ({
          file,
          sha256: sha256(await fs.readFile(path.join(root, file))),
        })),
      ),
    },
    scope:
      'Node-only production metadata validation/search/serialization and real atomic filesystem write; no Electron renderer, decode, export, model inference or end-to-end save acknowledgement',
    protocol: {
      warmups: 5,
      repetitions: 30,
      percentile: 'nearest rank',
      concurrentWritesPerBatch: 8,
      rows: 24,
      timelineDurationSeconds: 5400,
      video: 'none; synthetic metadata timestamps only',
      thresholds:
        'none; measurements are evidence for this host, not cross-platform performance guarantees',
    },
    cases: [],
  };
  for (const count of [240, 2400, 10000]) {
    const document = createSyntheticTimeline({ count });
    const bytes = JSON.stringify(document);
    const file = path.join(temporary, `timeline-${count}.json`);
    const before = process.memoryUsage();
    const result = {
      tags: count,
      utf8Bytes: Buffer.byteLength(bytes),
      inputSha256: sha256(bytes),
      metrics: {},
    };
    result.metrics.validate = await measure(() =>
      validateTimelineDocumentData(document),
    );
    result.metrics.searchAll = await measure(() =>
      assert.equal(searchTimeline(document.instances, '').length, count),
    );
    result.metrics.searchSelective = await measure(() =>
      assert.equal(
        searchTimeline(document.instances, 'needle').length,
        Math.ceil(count / 17),
      ),
    );
    result.metrics.serialize = await measure(() => {
      assert.equal(JSON.stringify(document).length, bytes.length);
    });
    result.metrics.atomicSave = await measure(async () => {
      await writeTextFileAtomically(file, bytes);
    });
    result.metrics.atomicQueueBatch8 = await measure(async () => {
      await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          writeTextFileAtomically(file, `${bytes}${' '.repeat(index)}`),
        ),
      );
    });
    assert.equal(
      await fs.readFile(file, 'utf8'),
      `${bytes}${' '.repeat(7)}`,
      'queue must finish with the last write',
    );
    assert.equal(
      sha256(JSON.stringify(document)),
      result.inputSha256,
      'measurement must not change input',
    );
    result.memory = {
      before,
      after: process.memoryUsage(),
      processMaxRssKiB: process.resourceUsage().maxRSS,
    };
    report.cases.push(result);
    console.log(
      `${count} tags: search all P95=${result.metrics.searchAll.p95Ms} ms, atomic save P95=${result.metrics.atomicSave.p95Ms} ms`,
    );
  }
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`, {
    flag: 'wx',
  });
  console.log(`Report: ${output}`);
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
