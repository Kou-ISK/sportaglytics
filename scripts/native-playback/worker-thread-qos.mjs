import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** A pinned-source adaptation, applied only to the private static FFmpeg build.
 * Validate every call site before any write. Unknown or already-patched source
 * fails instead of silently building a different threading policy. */
export async function applyWorkerThreadQoS(root) {
  const changes = [
    ['libavutil/slicethread.h', [
      ['int nb_threads);', 'int nb_threads, int inherit_filter_qos);', 1],
    ]],
    ['libavutil/slicethread.c', [
      ['#include "thread.h"', '#include "thread.h"\n#include "WorkerThreadQoS.h"', 1],
      ['int nb_threads)\n{', 'int nb_threads, int inherit_filter_qos)\n{', 2],
      ['pthread_create(&w->thread, NULL, thread_worker, w)', '(inherit_filter_qos ? playback_create_worker_thread(&w->thread, thread_worker, w) : pthread_create(&w->thread, NULL, thread_worker, w))', 1],
    ]],
    ['libavfilter/pthread.c', [
      ['worker_func, NULL, nb_threads);', 'worker_func, NULL, nb_threads, 1);', 1],
    ]],
    ['libavcodec/pthread_frame.c', [
      ['#include \"libavutil/thread.h\"', '#include \"libavutil/thread.h\"\n#include \"libavutil/WorkerThreadQoS.h\"', 1],
      ['pthread_create(&p->thread, NULL, frame_worker_thread, p)', 'playback_create_worker_thread(&p->thread, frame_worker_thread, p)', 1],
    ]],
    ['libavcodec/pthread_slice.c', [
      ['mainfunc, thread_count);', 'mainfunc, thread_count, 0);', 1],
    ]],
  ];
  const prepared = [];
  for (const [file, replacements] of changes) {
    let text = await readFile(join(root, file), 'utf8');
    for (const [before, after, count] of replacements) {
      if (text.split(before).length - 1 !== count)
        throw Error(`Unrecognized FFmpeg thread source: ${file}`);
      text = text.split(before).join(after);
    }
    prepared.push([file, '/* Modified by SporTagLytics, 2026-10-26: filter/frame-decoder caller QoS;\n * private slice-thread ABI flag leaves slice-decoder policy unchanged. */\n' + text]);
  }
  for (const [file, text] of prepared) await writeFile(join(root, file), text);
  await copyFile(
    fileURLToPath(new URL('./WorkerThreadQoS.h', import.meta.url)),
    join(root, 'libavutil/WorkerThreadQoS.h'),
  );
}
