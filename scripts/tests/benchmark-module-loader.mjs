import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compileBenchmarkModules } from '../compile-benchmark-modules.mjs';
import { createSyntheticTimeline } from '../synthetic-timeline-workload.mjs';

test('compiled production graph resolves extensionless provenance and preserves validation and writes', async (t) => {
  const graph = await compileBenchmarkModules();
  t.after(graph.dispose);
  assert.ok(
    graph.sources.includes('src/shared/timeline/timelineProvenance.ts'),
  );
  assert.ok(graph.sources.includes('src/types/timeline/provenance.ts'));
  const { validateTimelineDocumentData } = graph.modules.validation;
  const document = createSyntheticTimeline({ count: 3 });
  const original = JSON.stringify(document);
  validateTimelineDocumentData(document);
  assert.equal(JSON.stringify(document), original);
  assert.ok(
    document.instances.every((item) => !Object.hasOwn(item, 'provenance')),
  );
  const provenance = {
    reviewStatus: 'unreviewed',
    hasUnknownSource: false,
    sources: [
      {
        origin: 'event-detection',
        requestId: 'synthetic-request',
        modelId: 'synthetic-model',
        modelVersion: 'test-only',
        candidateId: 'candidate-1',
        eventType: 'tackle',
        confidence: 0.8,
        anchorTime: 1,
      },
    ],
  };
  document.instances[0].provenance = provenance;
  validateTimelineDocumentData(document);
  for (const invalid of [
    { ...provenance, reviewStatus: 'reviewed' },
    {
      ...provenance,
      sources: [{ ...provenance.sources[0], confidence: '0.8' }],
    },
  ]) {
    document.instances[0].provenance = invalid;
    assert.throws(
      () => validateTimelineDocumentData(document),
      /検出由来・確認状態が不正/,
    );
  }
  document.instances[0].provenance = provenance;
  assert.equal(
    graph.modules.search.searchTimeline(document.instances, 'needle').length,
    1,
  );
  const filename = path.join(
    graph.temporaryDirectory,
    'synthetic-timeline.json',
  );
  await graph.modules.atomic.writeTextFileAtomically(
    filename,
    JSON.stringify(document),
  );
  const reopened = JSON.parse(await fs.readFile(filename, 'utf8'));
  validateTimelineDocumentData(reopened);
  assert.deepEqual(reopened, document);
  await graph.dispose();
  await assert.rejects(fs.access(graph.temporaryDirectory), { code: 'ENOENT' });
});

test('compiler errors stop loading and remove temporary output', async (t) => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-benchmark-invalid-'),
  );
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const source = path.join(parent, 'source');
  await fs.mkdir(source);
  await fs.writeFile(
    path.join(source, 'broken.ts'),
    'export const value: number = "invalid";\n',
  );
  await assert.rejects(
    compileBenchmarkModules({
      rootDirectory: source,
      parentDirectory: parent,
      entrypoints: { broken: 'broken.ts' },
    }),
  );
  assert.deepEqual(await fs.readdir(parent), ['source']);
});
