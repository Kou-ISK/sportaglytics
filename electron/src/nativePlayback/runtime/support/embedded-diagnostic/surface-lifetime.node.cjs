'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createLifetime, createAdmission } = require('./surface-lifetime.cjs');
for (const order of [
  [0, 1, 2],
  [0, 2, 1],
  [1, 0, 2],
  [1, 2, 0],
  [2, 0, 1],
  [2, 1, 0],
])
  test('release after all independent milestones ' + order, () => {
    let count = 0;
    const l = createLifetime(() => count++),
      events = [l.transfer, l.acknowledge, l.gpuRelease];
    events[order[0]]();
    events[order[1]]();
    assert.equal(count, 0);
    events[order[2]]();
    assert.equal(count, 1);
    events.forEach((f) => f());
    assert.equal(count, 1);
  });
test('late transfer and GPU callback cannot release a quarantined surface', () => {
  let count = 0;
  const l = createLifetime(() => count++);
  l.quarantine();
  l.transfer();
  l.acknowledge();
  l.gpuRelease();
  assert.equal(count, 0);
  assert.equal(l.ended(), false);
});
test('reply failure keeps ownership uncertain without a retry', () => {
  let calls = 0;
  const l = createLifetime(() => {
    calls++;
    throw Error('reply failed');
  });
  l.transfer();
  l.acknowledge();
  assert.throws(l.gpuRelease);
  l.gpuRelease();
  l.transfer();
  l.acknowledge();
  assert.equal(calls, 1);
  assert.equal(l.ended(), false);
  assert.equal(l.uncertain(), true);
});
test('seek retains displayed time and rejects reverse arrival/old document', () => {
  const a = createAdmission(),
    f = { document: 'd', generation: 'owner', seekId: 1, pts: 500, id: 1 };
  a.expect('owner', 1);
  assert.equal(a.commit(f), true);
  a.expect('owner', 2);
  assert.equal(a.presented().pts, 500);
  assert.equal(a.current({ ...f, id: 2 }), false);
  assert.equal(a.commit({ ...f, seekId: 2, pts: 200, id: 3 }), true);
  assert.equal(a.current({ ...f, seekId: 2, pts: 199, id: 4 }), false);
  assert.equal(
    a.current({ ...f, document: 'old', seekId: 2, pts: 201, id: 4 }),
    false,
  );
  assert.equal(a.current({ ...f, seekId: 2, pts: 201, id: 2 }), false);
  a.close();
  assert.equal(a.current({ ...f, seekId: 2, pts: 201, id: 4 }), false);
  assert.throws(() => a.expect('owner', 3));
});
test('pending backend cleanup is reported without releasing quarantine', async () => {
  const { waitOwned } = require('./surface-lifetime.cjs');
  let released = 0;
  const l = createLifetime(() => released++);
  l.quarantine();
  l.transfer();
  l.acknowledge();
  l.gpuRelease();
  await assert.rejects(
    waitOwned(new Promise(() => {}), 10),
    /ownership retained/,
  );
  assert.equal(released, 0);
  assert.equal(l.ended(), false);
});
