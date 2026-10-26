import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { applyFilterThreadQoS } from '../native-playback/filter-thread-qos.mjs';
import { BUILD_INPUT_FILES } from '../native-playback/recipe.mjs';

// Synthetic snippets exercise the exact pinned-source boundaries; no media.
const snippets = {
  'libavutil/slicethread.h': 'int create(int nb_threads);',
  'libavutil/slicethread.c': '#include "thread.h"\nvoid (*worker)(int nb_threads);\nint create(int nb_threads)\n{\n}\nint fallback(int nb_threads)\n{\n}\npthread_create(&w->thread, NULL, thread_worker, w)',
  'libavfilter/pthread.c': 'create(&ctx, worker_func, NULL, nb_threads);',
  'libavcodec/pthread_slice.c': 'create(&ctx, mainfunc, thread_count);',
};
async function fixture(callback) {
  const root = await mkdtemp(join(tmpdir(), 'filter-qos-test-'));
  try {
    for (const [file, contents] of Object.entries(snippets)) {
      await mkdir(dirname(join(root, file)), { recursive: true });
      await writeFile(join(root, file), contents);
    }
    await callback(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
test('only filter opts in; decoder slice and fallback ABI stay explicit', () => fixture(async (root) => {
  await applyFilterThreadQoS(root);
  assert.match(await readFile(join(root, 'libavfilter/pthread.c'), 'utf8'), /nb_threads, 1\);/);
  assert.match(await readFile(join(root, 'libavcodec/pthread_slice.c'), 'utf8'), /thread_count, 0\);/);
  const worker = await readFile(join(root, 'libavutil/slicethread.c'), 'utf8');
  assert.equal(worker.match(/int inherit_filter_qos/g).length, 2);
  assert.match(worker, /: pthread_create\(&w->thread, NULL, thread_worker, w\)/);
  assert.match(await readFile(join(root, 'libavutil/FilterThreadQoS.h'), 'utf8'), /pthread_get_qos_class_np/);
  await assert.rejects(applyFilterThreadQoS(root), /Unrecognized/);
}));
test('unknown final caller rejects entire adaptation before mutating earlier files', () => fixture(async (root) => {
  await writeFile(join(root, 'libavcodec/pthread_slice.c'), 'different upstream ABI');
  await assert.rejects(applyFilterThreadQoS(root), /Unrecognized/);
  for (const [file, contents] of Object.entries(snippets).slice(0, -1))
    assert.equal(await readFile(join(root, file), 'utf8'), contents);
}));
test('build identity and matching source include policy and adaptation', () => {
  assert.ok(BUILD_INPUT_FILES.includes('scripts/native-playback/FilterThreadQoS.h'));
  assert.ok(BUILD_INPUT_FILES.includes('scripts/native-playback/filter-thread-qos.mjs'));
});
for (const name of ['filter-thread-qos', 'filter-thread-qos-failures']) {
  test(`${name}: real requested class/priority or failure ownership`, { skip: process.platform !== 'darwin' }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'filter-qos-c-'));
    try {
      const binary = join(root, name);
      execFileSync('xcrun', ['clang', '-Wall', '-Wextra', '-Werror', '-O2',
        fileURLToPath(new URL(`./${name}.c`, import.meta.url)), '-o', binary]);
      execFileSync(binary, [], { timeout: 10000 });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
