'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { assertNativeDrain } = require('./native-receipt.cjs');
const owner = { generation: 'synthetic' };
const valid = () => ({
  owner,
  receipt: {
    type: 'drained',
    generation: owner.generation,
    nativeDrained: true,
    requiresOwnerExitZero: true,
    resultPersisted: true,
    success: true,
  },
  actualExit: { code: 0, signal: null },
  spawned: true,
  pendingOutput: '',
  controlClosed: true,
});
test('requires both native receipt and physical process/control closure', () => {
  assert.deepEqual(assertNativeDrain(valid()), {
    generation: 'synthetic',
    nativeDrained: true,
    processStarted: true,
    processExited: true,
    pipesClosed: true,
    stopped: null,
  });
  for (const patch of [
    { receipt: null },
    { spawned: false },
    { actualExit: null },
    { actualExit: { code: null, signal: 'SIGTERM' } },
    { controlClosed: false },
    { pendingOutput: 'partial' },
  ])
    assert.throws(
      () => assertNativeDrain({ ...valid(), ...patch }),
      /unconfirmed/,
    );
});
test('rejects wrong generation and malformed acknowledgements', () => {
  for (const patch of [
    { generation: 'other' },
    { nativeDrained: false },
    { nativeDrained: 1 },
    { requiresOwnerExitZero: false },
    { resultPersisted: 'true' },
    { success: undefined },
  ])
    assert.throws(
      () =>
        assertNativeDrain({
          ...valid(),
          receipt: { ...valid().receipt, ...patch },
        }),
      /unconfirmed/,
    );
});
test('a failed diagnostic may drain without qualifying playback success', () => {
  const value = {
    ...valid(),
    actualExit: { code: 1, signal: null },
    receipt: { ...valid().receipt, success: false },
  };
  assert.equal(assertNativeDrain(value).nativeDrained, true);
  assert.equal(value.receipt.success, false);
});
