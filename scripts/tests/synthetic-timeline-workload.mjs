import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createSyntheticTimeline,
  summarizeTimings,
} from '../synthetic-timeline-workload.mjs';

test('workload has unique IDs, resolvable rows and bounded nonzero clip ranges', () => {
  const document = createSyntheticTimeline({ count: 10000 });
  assert.equal(document.rows.length, 24);
  assert.equal(new Set(document.instances.map((item) => item.id)).size, 10000);
  for (const item of document.instances) {
    assert.ok(document.rows.some((row) => row.name === item.actionName));
    assert.ok(
      item.startTime >= 0 &&
        item.endTime > item.startTime &&
        item.endTime <= 5400,
    );
  }
  assert.deepEqual(
    createSyntheticTimeline({ count: 240 }),
    createSyntheticTimeline({ count: 240 }),
  );
  assert.equal(
    document.instances.filter((item) => item.memo.includes('needle')).length,
    Math.ceil(10000 / 17),
  );
  assert.ok(
    document.instances.some(
      (item, index) =>
        index && item.startTime < document.instances[index - 1].startTime,
    ),
  );
});

test('unbounded or invalid workloads are rejected before allocation', () => {
  for (const input of [
    { count: 0 },
    { count: 100001 },
    { count: 1.5 },
    { count: 1, rows: 0 },
    { count: 1, duration: Infinity },
  ])
    assert.throws(() => createSyntheticTimeline(input), RangeError);
});

test('nearest-rank percentiles retain outliers without mutating samples', () => {
  const samples = [100, ...Array.from({ length: 19 }, (_, index) => index)];
  const original = [...samples];
  assert.deepEqual(summarizeTimings(samples), {
    count: 20,
    minMs: 0,
    p50Ms: 9,
    p95Ms: 18,
    maxMs: 100,
  });
  assert.deepEqual(samples, original);
  assert.throws(() => summarizeTimings([]), RangeError);
  assert.throws(() => summarizeTimings([NaN]), RangeError);
});
