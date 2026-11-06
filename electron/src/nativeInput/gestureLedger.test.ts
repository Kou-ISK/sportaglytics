import { expect, it } from 'vitest';
import { createGestureLedger } from './gestureLedger';
it('retires completed gestures without losing ordered repeated input', () => {
  const ledger = createGestureLedger(4);
  const epoch = ledger.arm();
  for (let id = 1; id <= 100; id++) {
    expect(ledger.down(id).status).toBe('accepted');
    expect(ledger.end(id)).toBe(true);
    expect(ledger.claim(id, epoch)).toBe('ended');
    expect(ledger.retire(id, epoch)).toBe(false);
    expect(ledger.confirmStopped(id, epoch)).toBe(true);
    expect(ledger.retire(id, epoch)).toBe(true);
  }
  expect(ledger.size()).toBe(0);
  expect(ledger.down(1).status).toBe('rejected');
});
it('fails closed at capacity and requires a new epoch', () => {
  const ledger = createGestureLedger(1);
  const first = ledger.arm();
  expect(ledger.down(1).status).toBe('accepted');
  expect(ledger.down(2).status).toBe('overflow');
  expect(ledger.claim(1, first)).toBe('invalid');
  expect(ledger.down(3).status).toBe('rejected');
  expect(ledger.arm()).not.toBe(first);
  expect(ledger.down(3).status).toBe('accepted');
});
it('cannot retire an active or differently scoped gesture', () => {
  const ledger = createGestureLedger(2);
  const epoch = ledger.arm();
  ledger.down(7);
  expect(ledger.retire(7, epoch)).toBe(false);
  expect(ledger.end(7)).toBe(true);
  expect(ledger.retire(7, epoch - 1)).toBe(false);
  expect(ledger.retire(7, epoch)).toBe(true);
});

it('allows a start claim exactly once and reports if it was released', () => {
  const ledger = createGestureLedger(3);
  const epoch = ledger.arm();
  ledger.down(1);
  expect(ledger.claim(1, epoch)).toBe('active');
  expect(ledger.claim(1, epoch)).toBe('invalid');
  ledger.end(1);
  expect(ledger.confirmStopped(1, epoch)).toBe(true);
  ledger.retire(1, epoch);
  ledger.down(2);
  ledger.end(2);
  expect(ledger.claim(2, epoch)).toBe('ended');
  expect(ledger.claim(2, epoch)).toBe('invalid');
});
