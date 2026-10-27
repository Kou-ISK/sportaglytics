const { test } = require('node:test'),
  assert = require('node:assert/strict');
const { packetLines } = require('./packet-lines.cjs');
test('lifetime traffic is unbounded while individual messages are bounded', () => {
  let count = 0;
  const p = packetLines(() => count++);
  const row = Buffer.from(JSON.stringify({ message: 'x'.repeat(500) }) + '\n');
  for (let i = 0; i < 6000; i++) p.write(row);
  assert.equal(count, 6000);
  assert.equal(p.pending(), '');
});
test('split UTF8 and combined lines preserve packets', () => {
  const values = [],
    p = packetLines((v) => values.push(v));
  const data = Buffer.from('"音声"\n0\n');
  for (const byte of data) p.write(Buffer.from([byte]));
  assert.deepEqual(values, ['音声', 0]);
});
test('oversize complete and incomplete lines fail closed', () => {
  for (const tail of ['', '\n']) {
    const p = packetLines(() => {}, 10);
    assert.throws(() => p.write(Buffer.from('"1234567890"' + tail)), /limit/);
    assert.throws(() => p.write(Buffer.from('0\n')), /failed/);
  }
});
