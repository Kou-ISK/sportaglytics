'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { cancellationGate } = require('./cancellation-gate.cjs');
for (const stage of ['source-hash', 'manifest-write'])
  test(`cancellation during ${stage} never dispatches a launch`, async () => {
    let stopped = false,
      launches = 0;
    const held = Promise.withResolvers();
    const gate = cancellationGate(() => stopped);
    const work = (async () => {
      await gate.wait(() => held.promise);
      await gate.beforeSpawn();
      launches++;
    })();
    const rejected = assert.rejects(work, /cancelled/);
    stopped = true;
    held.resolve();
    await rejected;
    assert.equal(launches, 0);
  });
test('queued cancellation is processed before synchronous spawn', async () => {
  let stopped = false;
  const gate = cancellationGate(() => stopped);
  setImmediate(() => {
    stopped = true;
  });
  await assert.rejects(gate.beforeSpawn(), /cancelled/);
});
test('a cancelled gate does not begin another preparation', async () => {
  let preparations = 0;
  const gate = cancellationGate(() => true);
  await assert.rejects(
    gate.wait(async () => {
      preparations++;
    }),
    /cancelled/,
  );
  assert.equal(preparations, 0);
});
