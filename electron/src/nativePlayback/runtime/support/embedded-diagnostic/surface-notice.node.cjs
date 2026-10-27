'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSurfaceNotice } = require('./surface-notice.cjs');
const good = { type: 'surface-ready', generation: 'owner', id: 1 };
test('only exact owned surface notice is accepted', () =>
  assert.equal(parseSurfaceNotice(good, 'owner'), 1));
for (const [label, value] of Object.entries({
  null: null,
  array: [good],
  missing: { type: 'surface-ready', id: 1 },
  extra: { ...good, pointer: 123 },
  owner: { ...good, generation: 'other' },
  type: { ...good, type: 'observation' },
  negative: { ...good, id: -1 },
  zero: { ...good, id: 0 },
  fraction: { ...good, id: 1.5 },
  string: { ...good, id: '1' },
  unsafe: { ...good, id: Number.MAX_SAFE_INTEGER + 1 },
}))
  test('reject ' + label, () =>
    assert.throws(
      () => parseSurfaceNotice(value, 'owner'),
      /invalid surface notice/,
    ),
  );
