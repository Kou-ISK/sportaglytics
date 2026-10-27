'use strict';
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs/promises'),
  path = require('node:path'),
  os = require('node:os');
const { EventEmitter } = require('node:events'),
  { PassThrough } = require('node:stream');
const {
  createRecorder,
  WIRE_BYTES,
  FILE_BYTES,
  BUFFER_BUDGET,
  MAGIC,
  FOOTER,
} = require('./recorder.cjs');
const { readSummary } = require('./read.cjs');
const { attachAuxiliary } = require('./auxiliary.cjs');
const fixture = (host) => {
  const b = Buffer.alloc(WIRE_BYTES);
  [MAGIC, 1n, BigInt(host), 2n, 3392n, BigInt(WIRE_BYTES), 0n, 0n].forEach(
    (x, i) => b.writeBigUInt64LE(x, i * 8),
  );
  let offset = 64;
  [2048, 1024, 256, 64].forEach((cap, g) => {
    b.writeBigUInt64LE(BigInt(g), offset);
    b.writeBigUInt64LE(BigInt(cap), offset + 8);
    offset += 64 * (cap + 1);
  });
  [FOOTER, 1n, BigInt(host), 2n, 0n, 0n, 0n, 0n].forEach((x, i) =>
    b.writeBigUInt64LE(x, WIRE_BYTES - 64 + i * 8),
  );
  return b;
};
async function directory(t) {
  const p = await fs.mkdtemp(path.join(os.tmpdir(), 'recurrence149-'));
  t.after(() => fs.rm(p, { recursive: true, force: true }));
  return p;
}
test('fixed ring wraps; no raw text; first failure frozen; full numeric wire', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  for (let i = 0; i < 2000; i++)
    s.note('surface-transfer', {
      id: i,
      seekId: 5,
      pts: i * 1001,
      nativeGeneration: 7,
      document: 'secret-user-path',
    });
  const b = fixture(s.host);
  s.data(b.subarray(0, 100));
  assert.equal(r.beginHost(), null);
  s.note('surface-transfer', { id: 9000 });
  s.data(b.subarray(100));
  await r.done();
  assert.equal(r.state().status, 1);
  assert.equal(r.state().mainCounts[0], 2000);
  assert.ok(BUFFER_BUDGET < 1024 * 1024);
  const file = path.join(dir, 'recurrence-1.bin'),
    bytes = await fs.readFile(file);
  assert.equal(bytes.length, FILE_BYTES);
  assert.equal(bytes.includes(Buffer.from('secret')), false);
  assert.equal(bytes.readDoubleLE(256 + (1999 % 640) * 64 + 7 * 8), 1999);
  assert.equal((await readSummary(file)).nativeWireComplete, true);
  assert.equal((await fs.stat(file)).mode & 0o777, 0o600);
});
test('partial/oversize/wrong host/version/footer are explicitly incomplete', async (t) => {
  const dir = await directory(t);
  let n = 0;
  for (const mutate of [
    (b) => b.subarray(0, 100),
    (b) => Buffer.concat([b, Buffer.alloc(1)]),
    (b) => {
      b.writeBigUInt64LE(8n, 16);
      return b;
    },
    (b) => {
      b.writeBigUInt64LE(9n, 8);
      return b;
    },
    (b) => {
      b.writeBigUInt64LE(0n, WIRE_BYTES - 64);
      return b;
    },
  ]) {
    const d = path.join(dir, String(n++)),
      r = createRecorder(d),
      s = r.beginHost();
    s.data(mutate(fixture(s.host)));
    s.exit();
    await r.done();
    assert.equal(r.state().status, 2);
    assert.equal(
      (await readSummary(path.join(d, 'recurrence-1.bin'))).nativeWireComplete,
      false,
    );
  }
});
test('normal reopen reuses buffers, ignores old host, Main-only failure saves incomplete', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    old = r.beginHost();
  assert.equal(r.beginHost(), null);
  old.exit();
  assert.equal(r.state().status, 0);
  const current = r.beginHost();
  assert.equal(current.host, 2);
  old.data(fixture(1));
  current.note('integration-failure', { reason: 'secret' });
  current.exit();
  await r.done();
  assert.equal(r.state().status, 2);
  assert.equal(
    (await readSummary(path.join(dir, 'recurrence-1.bin'))).receivedNativeBytes,
    0,
  );
});
test('four exact slots; no existing files deleted or overwritten, no fifth file', async (t) => {
  const dir = await directory(t);
  for (let i = 1; i <= 4; i++)
    await fs.writeFile(
      path.join(dir, 'recurrence-' + i + '.bin'),
      'existing-' + i,
    );
  await fs.writeFile(path.join(dir, 'user.txt'), 'keep');
  const r = createRecorder(dir),
    s = r.beginHost();
  s.data(fixture(s.host));
  await r.done();
  assert.equal(r.state().status, 3);
  assert.equal((await fs.readdir(dir)).length, 5);
  assert.equal(
    await fs.readFile(path.join(dir, 'recurrence-1.bin'), 'utf8'),
    'existing-1',
  );
});
test('write failure/zero write/symlink rejected; diagnostics never throw or block reopen', async (t) => {
  const dir = await directory(t);
  for (const errorKind of ['zero', 'reject']) {
    let closed = false;
    const io = {
      mkdir: async () => {},
      lstat: async () => ({ isDirectory: () => true }),
      open: async () => ({
        write: async () => {
          if (errorKind === 'reject') throw Error('disk');
          return { bytesWritten: 0 };
        },
        close: async () => {
          closed = true;
        },
      }),
    };
    const r = createRecorder(dir, { io }),
      s = r.beginHost();
    s.data(fixture(s.host));
    await r.done();
    assert.equal(r.state().status, 4);
    assert.ok(closed);
    assert.equal(r.beginHost(), null);
  }
  const real = path.join(dir, 'real'),
    link = path.join(dir, 'link');
  await fs.mkdir(real);
  await fs.symlink(real, link);
  const r = createRecorder(link),
    s = r.beginHost();
  s.data(fixture(s.host));
  await r.done();
  assert.equal(r.state().status, 4);
  assert.deepEqual(await fs.readdir(real), []);
});
test('pending save cannot allocate next session; bounded short writes', async (t) => {
  let release;
  const gate = new Promise((r) => (release = r));
  let total = 0,
    max = 0,
    calls = 0;
  const io = {
    mkdir: async () => gate,
    lstat: async () => ({ isDirectory: () => true }),
    open: async () => ({
      write: async (b, o, n) => {
        max = Math.max(max, n);
        calls++;
        const bytesWritten = Math.min(n, 1024);
        total += bytesWritten;
        return { bytesWritten };
      },
      close: async () => {},
    }),
  };
  const r = createRecorder('/unused', { io }),
    s = r.beginHost();
  s.data(fixture(s.host));
  assert.equal(r.beginHost(), null);
  release();
  await r.done();
  assert.equal(total, FILE_BYTES);
  assert.ok(max <= 65536 && calls > 250);
});
test('auxiliary exit/error/throw closes only FD3; required stdout and stderr preserved', () => {
  for (const method of ['exit', 'error']) {
    const child = new EventEmitter();
    const auxiliary = new PassThrough();
    child.stdio = [null, new PassThrough(), new PassThrough(), auxiliary];
    attachAuxiliary(child, {
      data() {
        throw Error('optional');
      },
      exit() {
        throw Error('optional');
      },
      error() {
        throw Error('optional');
      },
      end() {},
    });
    auxiliary.write(Buffer.alloc(1));
    child.emit(method, 0);
    assert.equal(auxiliary.destroyed, true);
    assert.equal(child.stdio[1].destroyed, false);
    assert.equal(child.stdio[2].destroyed, false);
  }
});
test('auxiliary unread writer detached at exit without waiting for EOF', () => {
  const child = new EventEmitter(),
    stream = new PassThrough();
  child.stdio = [null, null, null, stream];
  let finalized = 0;
  attachAuxiliary(child, {
    data() {
      return true;
    },
    end() {},
    error() {},
    exit() {
      finalized++;
    },
  });
  child.emit('exit', 0);
  assert.equal(stream.destroyed, true);
  assert.equal(finalized, 1);
});
test('Main failure snapshots within bounded timer without child exit', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.note('integration-failure', { reason: 'secret' });
  assert.equal(r.beginHost(), null);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await r.done();
  assert.equal(r.state().status, 2);
  const summary = await readSummary(path.join(dir, 'recurrence-1.bin'));
  assert.equal(summary.transport, 5);
  assert.equal(summary.receivedNativeBytes, 0);
  s.data(fixture(s.host));
  assert.equal((await fs.readdir(dir)).length, 1);
});
test('surface failures retain only a fixed numeric class within the same record', async (t) => {
  const root = await directory(t);
  for (const [index, reason, code] of [
    [0, 'Error: release reply uncertain; ownership retained', 1],
    [1, 'Error: draw reply failed', 2],
    [2, 'Error: demand request failed', 3],
    [3, 'secret-user-media-path', 0],
  ]) {
    const dir = path.join(root, String(index));
    const recorder = createRecorder(dir),
      session = recorder.beginHost();
    session.note('surface-failure', { reason });
    session.end();
    await recorder.done();
    const bytes = await fs.readFile(path.join(dir, 'recurrence-1.bin'));
    assert.equal(bytes.length, FILE_BYTES);
    assert.equal(bytes.readDoubleLE(256 + 2 * 8), 121);
    assert.equal(bytes.readDoubleLE(256 + 7 * 8), code);
    assert.equal(bytes.includes(Buffer.from(reason)), false);
  }
});
test('abnormal exit with no native bytes retains Main-only diagnosis', async (t) => {
  const dir = await directory(t);
  for (const [index, code, signal] of [
    [0, 1, null],
    [1, null, 'SIGTERM'],
  ]) {
    const d = path.join(dir, String(index)),
      r = createRecorder(d),
      s = r.beginHost();
    s.note('surface-transfer', { id: 5 });
    s.exit(code, signal);
    await r.done();
    const summary = await readSummary(path.join(d, 'recurrence-1.bin'));
    assert.equal(summary.nativeWireComplete, false);
    assert.equal(summary.reason, 125);
    assert.equal(summary.mainLast.length > 0, true);
  }
});
test('wire complete does not hide lost retained slots or credit contention', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost(),
    b = fixture(s.host);
  b.writeBigUInt64LE(1n, 64 + 16);
  b.writeBigUInt64LE(1n, 64 + 24);
  b.writeBigUInt64LE(1n, 64 + 32);
  b.writeBigUInt64LE(1n, 64 + 40);
  b.writeBigUInt64LE(3n, 48);
  s.data(b);
  await r.done();
  const summary = await readSummary(path.join(dir, 'recurrence-1.bin'));
  assert.equal(summary.nativeWireComplete, true);
  assert.equal(summary.retainedSnapshotComplete, false);
  assert.deepEqual(summary.nativeGroups[0].missingSlots, [0]);
  assert.equal(summary.creditRecordsDropped, 3);
});
test('drawn false and true remain distinguishable while retaining transfer ID', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.note('surface-draw-ack', { id: 10, drawn: false });
  s.note('surface-draw-ack', { id: 11, drawn: true });
  s.data(fixture(s.host));
  await r.done();
  const summary = await readSummary(path.join(dir, 'recurrence-1.bin'));
  assert.deepEqual(
    summary.mainLast
      .filter((row) => [103, 107].includes(row[2]))
      .map((row) => [row[2], row[7]]),
    [
      [107, 10],
      [103, 11],
    ],
  );
});
test('reader rejects overlong file and damaged native group metadata', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.data(fixture(s.host));
  await r.done();
  const file = path.join(dir, 'recurrence-1.bin');
  await fs.appendFile(file, Buffer.from([0]));
  assert.equal((await readSummary(file)).fileComplete, false);
  const d = path.join(dir, 'bad'),
    r2 = createRecorder(d),
    s2 = r2.beginHost(),
    b = fixture(s2.host);
  b.writeBigUInt64LE(2n, 64);
  s2.data(b);
  await r2.done();
  assert.equal(
    (await readSummary(path.join(d, 'recurrence-1.bin'))).nativeWireComplete,
    false,
  );
});
test('GPU callback, send completion and final surface release are separate events', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.surfaceStage(108, 5);
  s.surfaceStage(109, 5);
  s.note('surface-released', { id: 5 });
  s.data(fixture(s.host));
  await r.done();
  const summary = await readSummary(path.join(dir, 'recurrence-1.bin'));
  assert.deepEqual(
    summary.mainLast
      .filter((row) => [108, 109, 104].includes(row[2]))
      .map((row) => [row[2], row[7]]),
    [
      [108, 5],
      [109, 5],
      [104, 5],
    ],
  );
});
test('zero-byte EOF before abnormal process exit is not treated as success', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.end();
  assert.equal(r.beginHost(), null);
  s.exit(1, null);
  await r.done();
  assert.equal(r.state().status, 2);
  assert.equal(
    (await readSummary(path.join(dir, 'recurrence-1.bin'))).reason,
    125,
  );
  const r2 = createRecorder(path.join(dir, 'aux')),
    s2 = r2.beginHost(),
    child = new EventEmitter(),
    stream = new PassThrough();
  child.stdio = [null, null, null, stream];
  attachAuxiliary(child, s2);
  stream.emit('end');
  child.emit('exit', 1, null);
  await r2.done();
  assert.equal(r2.state().status, 2);
  assert.equal(stream.destroyed, true);
});
test('reader bounds malformed Main counts and uses fixed tail iteration', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.data(fixture(s.host));
  await r.done();
  const file = path.join(dir, 'recurrence-1.bin'),
    original = await fs.readFile(file);
  for (const count of [2 ** 53 + 2, -1, NaN, Infinity]) {
    const damaged = Buffer.from(original);
    damaged.writeDoubleLE(count, 8 * 8);
    await fs.writeFile(file, damaged);
    await assert.rejects(readSummary(file), /invalid Main record count/);
  }
});

test('Renderer recovery failure after clean host exit saves bounded Main-only evidence', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.note('issued', { sequence: 2, seekId: 2, targetTime: 20 });
  s.exit();
  assert.equal(r.state().status, 0);
  s.rendererFailure({
    stage: 2,
    code: 26,
    sequence: 2,
    seekId: 2,
    targetTime: 20,
    confirmedTime: 19,
  });
  await r.done();
  const summary = await readSummary(path.join(dir, 'recurrence-1.bin'));
  assert.equal(summary.reason, 126);
  assert.equal(summary.nativeWireComplete, false);
  assert.equal(summary.receivedNativeBytes, 0);
  assert.equal(summary.fileBytes, FILE_BYTES);
  assert.equal(summary.mainLast.filter((row) => row[2] === 126)[0][7], 538);
  assert.equal(
    summary.mainLast.filter((row) => row[2] === 127)[0][6],
    19 * 120000,
  );
  s.rendererFailure({
    stage: 2,
    code: 0,
    sequence: 3,
    seekId: 3,
    targetTime: 21,
    confirmedTime: 20,
  });
  assert.equal((await fs.readdir(dir)).length, 1);
});
test('closed old host cannot record against reopened host or consume its slot', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    old = r.beginHost();
  old.exit();
  const current = r.beginHost();
  old.rendererFailure({
    stage: 2,
    code: 26,
    sequence: 1,
    seekId: 1,
    targetTime: 0,
    confirmedTime: 0,
  });
  assert.equal(r.state().frozen, false);
  current.exit();
  assert.deepEqual(await fs.readdir(dir), []);
});

test('duration failure context is numeric, bounded and distinct from newer intent', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.exit();
  const failure = {
    stage: 2,
    code: 26,
    sequence: 6,
    seekId: 2,
    targetTime: 100,
    confirmedTime: 19,
  };
  const recovery = {
    requestedTime: 120.123333,
    duration: 120.123133,
    durationKind: 0,
    readyState: 2,
    seeking: 0,
  };
  for (const invalid of [
    { ...recovery, secret: 'no' },
    { ...recovery, duration: NaN },
    { ...recovery, durationKind: 9 },
    { ...recovery, durationKind: 1 },
    { ...recovery, readyState: 6 },
    { ...recovery, seeking: 2 },
  ]) {
    s.rendererFailure({ ...failure, recovery: invalid });
    assert.equal(r.state().frozen, false);
  }
  s.rendererFailure({ ...failure, recovery });
  await r.done();
  const summary = await readSummary(path.join(dir, 'recurrence-1.bin'));
  assert.equal(summary.fileBytes, FILE_BYTES);
  assert.equal(r.state().bufferBudget, BUFFER_BUDGET);
  assert.equal(summary.mainLast.find((row) => row[2] === 126)[6], 100 * 120000);
  assert.equal(
    summary.mainLast.find((row) => row[2] === 127)[7],
    120.123333 * 120000,
  );
  assert.deepEqual(summary.mainLast.find((row) => row[2] === 128).slice(6), [
    120.123133 * 120000,
    16,
  ]);
});
test('non-finite duration uses an enum, never NaN or Infinity in the ring', async (t) => {
  const dir = await directory(t),
    r = createRecorder(dir),
    s = r.beginHost();
  s.exit();
  s.rendererFailure({
    stage: 2,
    code: 26,
    sequence: 1,
    seekId: 1,
    targetTime: 20,
    confirmedTime: 19,
    recovery: {
      requestedTime: 20,
      duration: 0,
      durationKind: 1,
      readyState: 0,
      seeking: 1,
    },
  });
  await r.done();
  const summary = await readSummary(path.join(dir, 'recurrence-1.bin'));
  assert.deepEqual(
    summary.mainLast.find((row) => row[2] === 128).slice(6),
    [0, 65],
  );
});
