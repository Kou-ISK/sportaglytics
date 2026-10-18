import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { compileBenchmarkModules } from '../compile-benchmark-modules.mjs';
import { createSyntheticTimeline } from '../synthetic-timeline-workload.mjs';

test('compiled production graph preserves legacy validation and writes', async (t) => {
  const graph = await compileBenchmarkModules();
  t.after(graph.dispose);
  const { validateTimelineDocumentData } = graph.modules.validation;
  const document = createSyntheticTimeline({ count: 3 });
  const original = JSON.stringify(document);
  validateTimelineDocumentData(document);
  assert.equal(JSON.stringify(document), original);
  assert.ok(
    document.instances.every((item) => !Object.hasOwn(item, 'provenance')),
  );
  await t.test(
    'validates provenance when the source graph implements F05',
    {
      skip: existsSync(
        new URL(
          '../../src/shared/timeline/timelineProvenance.ts',
          import.meta.url,
        ),
      )
        ? false
        : 'F05 provenance is not implemented in this source branch',
    },
    () => {
      assert.ok(
        graph.sources.includes('src/shared/timeline/timelineProvenance.ts'),
      );
      assert.ok(graph.sources.includes('src/types/timeline/provenance.ts'));
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
    },
  );
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

test('loader resolves an always-on nested extensionless runtime import graph', async (t) => {
  const parent = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-benchmark-graph-'),
  );
  t.after(() => fs.rm(parent, { recursive: true, force: true }));
  const source = path.join(parent, 'source');
  await fs.mkdir(path.join(source, 'nested'), { recursive: true });
  await fs.writeFile(
    path.join(source, 'entry.ts'),
    "export { value } from './nested/helper';\n",
  );
  await fs.writeFile(
    path.join(source, 'nested/helper.ts'),
    "import { marker } from '../marker'; export const value = marker;\n",
  );
  await fs.writeFile(
    path.join(source, 'marker.ts'),
    "export const marker = 'synthetic-transitive-graph';\n",
  );
  const graph = await compileBenchmarkModules({
    rootDirectory: source,
    parentDirectory: parent,
    entrypoints: { fixture: 'entry.ts' },
  });
  t.after(graph.dispose);
  assert.equal(graph.modules.fixture.value, 'synthetic-transitive-graph');
  assert.deepEqual(graph.sources, [
    'entry.ts',
    'marker.ts',
    'nested/helper.ts',
  ]);
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
