import { expect, it } from 'vitest';
import { fitsSlideImport } from './slideImageSize';

it('checks PNG dimensions and total pixels before decoding', () => {
  const bytes = new Uint8Array(33);
  bytes.set([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]);
  const header = new DataView(bytes.buffer);
  header.setUint32(16, 4000);
  header.setUint32(20, 3000);
  expect(fitsSlideImport(bytes, 'image/png')).toBe(true);
  header.setUint32(16, 8192);
  expect(fitsSlideImport(bytes, 'image/png')).toBe(false);
});

it('uses the JPEG frame dimensions after metadata and rejects incomplete headers', () => {
  const bytes = Uint8Array.from([255,216,255,225,0,4,0,0,255,194,0,11,8,0,64,0,80,1,1,17,0]);
  expect(fitsSlideImport(bytes, 'image/jpeg')).toBe(true);
  expect(fitsSlideImport(bytes.slice(0,18), 'image/jpeg')).toBe(false);
  expect(fitsSlideImport(bytes, 'image/png')).toBe(false);
});
