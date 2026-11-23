// Run on the Linux quality runner with these two immutable Git objects fetched.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const published = '252aebbb0a9878b04af913c3844a8126ab0fd306';
const tagged = 'a392a2774a7ea5cbd919f56d306c3402270546f7';
const project = process.cwd();
const tmp = await mkdtemp(path.join(tmpdir(), 'playlist-compat-'));
const require = createRequire(import.meta.url);
const modules = await mkdtemp(path.join(project, 'node_modules', '.playlist-compat-'));
const event = { sender: { isDestroyed: () => true } };

async function loadVersion(id) {
  const root = id === 'working' ? project : path.join(tmp, id);
  if (id !== 'working') {
    await mkdir(root);
    const archive = execFileSync('git', ['archive', '--format=tar', id, 'src', 'electron/src'], { maxBuffer: 64 * 1024 * 1024 });
    execFileSync('tar', ['-xf', '-', '-C', root], { input: archive });
  }
  const outfile = path.join(modules, id + '.cjs');
  await build({
    stdin: { contents: [
      "export { loadPlaylistFromPath, savePlaylistToPath } from './electron/src/playlistWindow/storage';",
      "export { buildPlaylistPayload, buildLoadedPlaylistSnapshot } from './src/features/playlist/utils/playlistFileState';",
    ].join('\n'), resolveDir: root },
    bundle: true, platform: 'node', format: 'cjs', external: ['electron'],
    nodePaths: [path.join(project, 'node_modules')], outfile,
  });
  return require(outfile);
}

try {
  const old = await loadVersion(published);
  const candidate = await loadVersion(tagged);
  const fixed = await loadVersion('working');
  const source = path.join(tmp, 'sample.mp4');
  execFileSync('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'color=blue:s=64x64:r=5:d=1', '-c:v', 'mpeg4', source]);
  const clip = { id: 'clip', timelineItemId: null, actionName: 'Clip', startTime: 0, endTime: 1, addedAt: 1, videoSource: source };
  const slide = { id: 'slide', timelineItemId: null, actionName: 'Review', startTime: 0, endTime: 2, addedAt: 2, slide: { title: 'Review', body: 'Observe the next clip' } };
  const document = { id: 'example', name: 'Example', type: 'reference', items: [clip, slide], createdAt: 1, updatedAt: 1 };
  const original = path.join(tmp, 'original.stpl');
  const copy = path.join(tmp, 'copy.stpl');
  const disk = (folder) => path.join(folder, 'playlist.json');
  const save = (api, folder, doc) => api.savePlaylistToPath(folder, doc, event, 'ffmpeg');
  await save(candidate, original, document);
  const bytes = await readFile(disk(original));
  assert.equal((await candidate.loadPlaylistFromPath(original)).items[1].slide.title, 'Review');
  const oldDocument = await old.loadPlaylistFromPath(original);
  const state = old.buildLoadedPlaylistSnapshot(oldDocument, original);
  const edited = old.buildPlaylistPayload({
    ...state, name: 'Edited with prior version', type: state.playlistType, normalizeDocument: true,
  });
  assert.equal(edited.items[1].videoSource, source);
  await save(old, copy, edited);
  assert.deepEqual(await readFile(disk(original)), bytes);
  await assert.rejects(candidate.loadPlaylistFromPath(copy), /スライド/);
  await save(old, original, edited);
  assert.notDeepEqual(await readFile(disk(original)), bytes);
  await assert.rejects(candidate.loadPlaylistFromPath(original), /スライド/);
  console.log('0.17.35 -> 0.17.34 Save As damages only the copy; ordinary overwrite makes the original unreadable to 0.17.35');

  const next = JSON.parse(bytes);
  next.schemaVersion = 99;
  await writeFile(disk(original), JSON.stringify(next));
  assert.equal((await old.loadPlaylistFromPath(original)).schemaVersion, 5);
  console.log('0.17.34 accepts a flat document marked version 99 and normalizes it to 5');

  await writeFile(disk(original), bytes);
  const recovered = await fixed.loadPlaylistFromPath(original);
  await save(fixed, original, recovered);
  const protectedBytes = await readFile(disk(original));
  for (const api of [old, candidate]) {
    await assert.rejects(api.loadPlaylistFromPath(original), /形式が不正/);
    assert.deepEqual(await readFile(disk(original)), protectedBytes);
  }
  const reopened = await fixed.loadPlaylistFromPath(original);
  assert.deepEqual(reopened.items.map(i => i.id), ['clip', 'slide']);
  assert.deepEqual(reopened.items[1].slide, slide.slide);
  assert.equal(reopened.items[1].endTime, 2);
  assert.equal(reopened.items[1].videoSource, undefined);

  await save(old, copy, { ...document, items: [clip] });
  const legacy = await fixed.loadPlaylistFromPath(copy);
  assert.equal(legacy.items[0].videoSource, source);
  await save(fixed, copy, legacy);
  assert.equal((await old.loadPlaylistFromPath(copy)).items[0].id, 'clip');

  const embedded = path.join(tmp, 'embedded.stpl');
  await save(fixed, embedded, { ...document, type: 'embedded', items: [slide] });
  assert.deepEqual((await fixed.loadPlaylistFromPath(embedded)).items[0].slide, slide.slide);
  await assert.rejects(old.loadPlaylistFromPath(embedded), /形式が不正/);
  console.log('Protected reference and embedded slides, unmodified 0.17.35 input, and bidirectional clip-only files passed');
} finally {
  await rm(modules, { recursive: true, force: true });
  await rm(tmp, { recursive: true, force: true });
}
