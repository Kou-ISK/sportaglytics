import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { run } from './media-tools/process.mjs';

if (process.platform !== 'darwin' || process.arch !== 'arm64')
  throw Error('Group transport contract requires macOS arm64');
const require = createRequire(import.meta.url);
const receiver = require(
  resolve('.cache/native-playback/darwin-arm64/Receiver.node'),
);
const work = await mkdtemp(join(tmpdir(), 'native-group-surface-'));
let child;
let childClosed;
let childExited = false;
let opened = false;
let hadError = false;
let service;
try {
  const binary = join(work, 'GroupSurfaceProbe');
  await run('xcrun', [
    'clang++',
    '-arch',
    'arm64',
    '-std=c++17',
    '-O2',
    '-fobjc-arc',
    'native/macos/playback/surface-transport/GroupSurfaceProbe.mm',
    '-framework',
    'Foundation',
    '-framework',
    'CoreVideo',
    '-framework',
    'IOSurface',
    '-lbsm',
    '-o',
    binary,
  ]);
  service = 'local.sportaglytics.surface.group-' + randomUUID();
  assert.throws(() => receiver.openGroupV2(service + '\0extra'), /service/);
  receiver.openGroupV2(service);
  opened = true;
  assert.throws(() => receiver.open(service), /already open/);
  assert.throws(() => receiver.groupClose(service + '-other'), /owner changed/);
  assert.throws(() => receiver.groupPoll(service + '-other'), /owner changed/);
  assert.equal(receiver.groupCount(service), 0);
  assert.throws(() => receiver.count(), /v2 API/);
  assert.throws(() => receiver.close(), /v2 API/);
  assert.throws(() => receiver.groupSetPeer(service, 1, 2), /arguments/);
  child = spawn(binary, [service, String(process.pid)], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '',
    errors = '',
    spawnError = null;
  child.stdin.on('error', () =>
    console.error('Owned peer cancellation pipe closed; awaiting child close.'),
  );
  child.stdout.on('data', (data) => {
    output += data.toString();
  });
  child.stderr.on('data', (data) => {
    errors += data.toString();
  });
  child.on('error', (error) => {
    spawnError = error;
  });
  childClosed = new Promise((done) =>
    child.once('close', (code, signal) => {
      childExited = true;
      done({ code, signal });
    }),
  );
  assert.ok(child.pid);
  receiver.groupSetPeer(service, child.pid);
  const packets = [];
  const deadline = performance.now() + 5000;
  while (packets.length < 4 && performance.now() < deadline && !childExited) {
    assert.ok(output.length <= 65536 && errors.length <= 65536);
    const frame = receiver.groupPoll(service);
    if (frame) packets.push(frame);
    else await delay(5);
  }
  assert.equal(packets.length, 4);
  assert.deepEqual(
    packets.map((p) => p.id),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    packets.map((p) => p.angle),
    [0, 1, 0, 1],
  );
  assert.deepEqual(
    packets.map((p) => p.sourceEpoch),
    [1, 1, 2, 2],
  );
  assert.deepEqual(
    packets.map((p) => p.pair),
    [1, 1, 2, 2],
  );
  assert.deepEqual(
    packets.map((p) => p.sourceIndex),
    [0, 1, 0, 1],
  );
  assert.ok(
    packets.every(
      (p) =>
        p.globalStart <= p.globalTicks &&
        p.globalTicks < p.globalEnd &&
        p.sourcePTS < p.sourceEndPTS,
    ),
  );
  assert.ok(
    packets.every(
      (p) => p.globalTicks === 2400000 && Buffer.isBuffer(p.handle),
    ),
  );
  assert.notEqual(packets[0].surfaceID, packets[1].surfaceID);
  assert.equal(packets[0].surfaceID, packets[2].surfaceID);
  assert.equal(receiver.groupCount(service), 4);
  assert.throws(() => receiver.groupClose(service), /still owned/);
  for (const id of [3, 4, 1, 2]) receiver.groupDrawn(service, id);
  assert.throws(() => receiver.groupDrawn(service, 3), /duplicate/);
  for (const packet of packets) receiver.groupRelease(service, packet.id);
  assert.equal(receiver.groupCount(service), 0);
  const closed = await childClosed;
  if (spawnError) throw spawnError;
  assert.equal(closed.code, 0, errors);
  assert.equal(closed.signal, null);
  const rows = output
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  assert.deepEqual(rows.at(-1), {
    drained: true,
    heldBytes: 0,
    lastDrawn: [3, 4],
  });
  receiver.groupClose(service);
  opened = false;
  receiver.open('local.sportaglytics.surface.legacy-' + randomUUID());
  receiver.setPeer(process.pid);
  assert.equal(receiver.count(), 0);
  receiver.close();
  console.log(
    'Group native addon contract passed: two independent surfaces, four held images, epochs, late Drawn, release/drain and v1 reopening. No GPU/display/audio acceptance.',
  );
} catch (error) {
  hadError = true;
  throw error;
} finally {
  if (child && !childExited) {
    child.stdin.end('q'); // owned peer's cooperative cancellation, never kill
    await childClosed;
  }
  if (opened) {
    try {
      receiver.groupClose(service);
      opened = false;
    } catch (error) {
      if (!hadError) throw error;
      console.error(
        'Group receiver cleanup unconfirmed; original test error preserved.',
      );
    }
  }
  if ((!child || childExited) && !opened)
    await rm(work, { recursive: true, force: true });
}
