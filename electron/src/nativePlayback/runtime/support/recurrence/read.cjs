'use strict';
const fs = require('node:fs/promises');
const { FILE_BYTES, WIRE_BYTES, validNative } = require('./recorder.cjs');
async function readSummary(filename) {
  const handle = await fs.open(filename, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024)
      throw Error('not a bounded recurrence file');
    const buffer = Buffer.alloc(Math.min(stat.size, FILE_BYTES));
    let got = 0;
    while (got < buffer.length) {
      const r = await handle.read(buffer, got, buffer.length - got, got);
      if (!r.bytesRead) break;
      got += r.bytesRead;
    }
    if (
      buffer.length < 256 ||
      buffer.readDoubleLE(0) !== 149001 ||
      buffer.readDoubleLE(8) !== 1
    )
      throw Error('incomplete or unknown file header');
    const h = (i) => buffer.readDoubleLE(i * 8),
      fileComplete =
        stat.size === FILE_BYTES &&
        got === FILE_BYTES &&
        h(2) === FILE_BYTES &&
        buffer.readDoubleLE(FILE_BYTES - 64) === 149002 &&
        buffer.readDoubleLE(FILE_BYTES - 56) === FILE_BYTES;
    const summary = {
      schema: 1,
      fileComplete,
      nativeWireComplete:
        fileComplete &&
        h(5) === 1 &&
        h(6) === WIRE_BYTES &&
        validNative(
          buffer.subarray(256 + 704 * 64, 256 + 704 * 64 + WIRE_BYTES),
          h(3),
        ),
      launchID: h(14),
      host: h(3),
      reason: h(4),
      receivedNativeBytes: h(6),
      transport: h(7),
      fileBytes: stat.size,
      mainCounts: [h(8), h(9)],
      nativeGroups: [],
      mainLast: [],
      retainedSnapshotComplete: false,
      interpretation:
        'Notification/draw events are not physical display proof. Different process clocks cannot be subtracted.',
    };
    if (!summary.mainCounts.every((n) => Number.isSafeInteger(n) && n >= 0))
      throw Error('invalid Main record count');
    if (fileComplete) {
      for (let group = 0; group < 2; group++) {
        const cap = group ? 64 : 640,
          base = group ? 640 : 0,
          count = summary.mainCounts[group];
        const take = Math.min(count, cap, 16);
        for (let j = 0; j < take; j++) {
          const n = count - take + j,
            offset = 256 + (base + (n % cap)) * 64;
          summary.mainLast.push(
            Array.from({ length: 8 }, (_, i) =>
              buffer.readDoubleLE(offset + i * 8),
            ),
          );
        }
      }
    }
    if (summary.nativeWireComplete) {
      let offset = 256 + 704 * 64 + 64;
      for (let group = 0; group < 4; group++) {
        const number = (i) => Number(buffer.readBigUInt64LE(offset + i * 8));
        const capacity = number(1);
        if (capacity !== [2048, 1024, 256, 64][group])
          throw Error('unknown native ring');
        const retained = number(3),
          last = [],
          missing = [];
        for (let r = 0; r < retained; r++) {
          const rowOffset = offset + 64 + r * 64;
          const sequence = buffer.readBigUInt64LE(rowOffset);
          if (sequence !== buffer.readBigUInt64LE(offset + 32) + BigInt(r))
            missing.push(r);
          if (r >= retained - 16)
            last.push(
              Array.from({ length: 8 }, (_, i) =>
                i === 6
                  ? buffer.readBigInt64LE(rowOffset + i * 8).toString()
                  : buffer.readBigUInt64LE(rowOffset + i * 8).toString(),
              ),
            );
        }
        summary.nativeGroups.push({
          group: number(0),
          capacity,
          total: number(2),
          retained,
          firstSequence: number(4),
          lastSequence: number(5),
          overwritten: number(6),
          missingSlots: missing,
          last,
        });
        offset += 64 + capacity * 64;
      }
      summary.creditRecordsDropped = Number(
        buffer.readBigUInt64LE(256 + 704 * 64 + 48),
      );
      summary.retainedSnapshotComplete =
        summary.creditRecordsDropped === 0 &&
        summary.nativeGroups.every((g) => g.missingSlots.length === 0);
    }
    return summary;
  } finally {
    await handle.close();
  }
}
module.exports = { readSummary };
if (require.main === module) {
  if (process.argv.length !== 3)
    throw Error('Usage: node recurrence/read.cjs recurrence-N.bin');
  readSummary(process.argv[2])
    .then((x) => console.log(JSON.stringify(x, null, 2)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
