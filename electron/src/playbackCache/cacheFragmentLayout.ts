import type { CacheMp4Box } from './cacheMp4Boxes';
export interface CacheFragmentByteRange {
  start: number;
  end: number;
}
export interface CacheFragmentLayout {
  kind: 'fragment-byte-layout';
  initialization: CacheFragmentByteRange;
  fragments: CacheFragmentByteRange[];
}
/** Exact contiguous ftyp/moov + moof/mdat byte ranges. This does not prove random
 * access, codec/track identity, timestamps, field/audio coverage or adoption. */
export const cacheFragmentLayout = (
  boxes: readonly CacheMp4Box[],
): CacheFragmentLayout => {
  if (boxes.length < 4 || boxes.length > 10000)
    throw Error('CACHE_INVALID_FRAGMENT_LAYOUT');
  let position = 0;
  for (const box of boxes) {
    if (
      !Number.isSafeInteger(box.start) ||
      !Number.isSafeInteger(box.end) ||
      box.start !== position ||
      ![8, 16].includes(box.headerBytes) ||
      box.end - box.start < box.headerBytes ||
      box.openEnded
    )
      throw Error('CACHE_INVALID_FRAGMENT_LAYOUT');
    position = box.end;
  }
  if (boxes[0].type !== 'ftyp') throw Error('CACHE_INVALID_FRAGMENT_LAYOUT');
  let cursor = 1;
  while (boxes[cursor]?.type === 'free') cursor++;
  const moov = boxes[cursor++];
  if (
    !moov ||
    moov.type !== 'moov' ||
    moov.end > 1024 * 1024 ||
    moov.end - moov.start <= moov.headerBytes
  )
    throw Error('CACHE_INVALID_FRAGMENT_INITIALIZATION');
  const fragments: CacheFragmentByteRange[] = [];
  while (cursor < boxes.length) {
    const moof = boxes[cursor++];
    // Terminal seek index is metadata, never fed as media payload.
    if (moof.type === 'mfra' && cursor === boxes.length) break;
    const mdat = boxes[cursor++];
    if (
      moof.type !== 'moof' ||
      !mdat ||
      mdat.type !== 'mdat' ||
      moof.end - moof.start <= moof.headerBytes ||
      mdat.end - mdat.start <= mdat.headerBytes ||
      mdat.end - moof.start > 64 * 1024 * 1024
    )
      throw Error('CACHE_INVALID_FRAGMENT_LAYOUT');
    fragments.push({ start: moof.start, end: mdat.end });
  }
  if (!fragments.length) throw Error('CACHE_INVALID_FRAGMENT_LAYOUT');
  return {
    kind: 'fragment-byte-layout',
    initialization: { start: 0, end: moov.end },
    fragments,
  };
};
