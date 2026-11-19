import { describe, expect, it } from 'vitest';
import { parsePreviewPackets } from './produce';
import { prioritizeClipExport, scrubIdleSignal } from './exportPriority';
const packet = Buffer.from([255, 216, 255, 217]);
const jpeg = Buffer.concat([packet, packet]);
const log =
  '#tb 0: 1/60000\n0,4500001,4500001,1001,4,0\n0,4501002,4501002,1001,4,0';
describe('bounded scrub preview', () => {
  it('preserves absolute PTS for a nonzero source interval', () => {
    expect(parsePreviewPackets(log, jpeg, 4500000, 4502000)).toEqual([
      { pts: 4500001, size: 4, offset: 0 },
      { pts: 4501002, size: 4, offset: 4 },
    ]);
  });
  it.each([
    log.replace('1/60000', '1/1000'),
    log.replaceAll('4501002', '4501001'),
    log.replace('1001,4', '1001,5'),
    log + '\n0,garbage',
  ])('rejects invalid timing or packet lengths', (value) => {
    expect(() => parsePreviewPackets(value, jpeg, 4500000, 4502000)).toThrow();
  });
  it('refuses unaccounted bytes, truncated images and packets outside the interval', () => {
    for (const bytes of [Buffer.concat([jpeg, packet]), jpeg.subarray(1)])
      expect(() => parsePreviewPackets(log, bytes, 4500000, 4502000)).toThrow();
    expect(() => parsePreviewPackets(log, jpeg, 4500000, 4501002)).toThrow();
  });
  it('gives simultaneous clip exports priority until both have finished', () => {
    const first = scrubIdleSignal();
    const one = prioritizeClipExport(),
      two = prioritizeClipExport();
    expect(first.aborted).toBe(true);
    one();
    one();
    expect(scrubIdleSignal().aborted).toBe(true);
    two();
    expect(scrubIdleSignal().aborted).toBe(false);
    expect(first.aborted).toBe(true);
  });
});
