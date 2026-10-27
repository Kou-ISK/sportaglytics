/** Structural byte bounds only. A box list is never a media/timing/HW proof. */
export interface CacheMp4Box {
  type: string;
  start: number;
  end: number;
  headerBytes: number;
  openEnded: boolean;
}
export const readCacheMp4Box = (
  header: Buffer,
  start: number,
  end: number,
): CacheMp4Box => {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    end - start < 8 ||
    header.length < 8
  )
    throw Error('CACHE_INVALID_MP4');
  let length = header.readUInt32BE(0);
  let headerBytes = 8;
  const openEnded = length === 0;
  if (length === 1) {
    if (header.length < 16) throw Error('CACHE_INVALID_MP4');
    const extended = header.readBigUInt64BE(8);
    if (extended > BigInt(Number.MAX_SAFE_INTEGER))
      throw Error('CACHE_INVALID_MP4');
    length = Number(extended);
    headerBytes = 16;
  } else if (openEnded) length = end - start;
  if (length < headerBytes || length > end - start)
    throw Error('CACHE_INVALID_MP4');
  return {
    type: header.toString('latin1', 4, 8),
    start,
    end: start + length,
    headerBytes,
    openEnded,
  };
};
export interface CacheMp4ReadPort {
  /** Read the first at most 16 bytes of each box from an authorized file. */
  read: (position: number, length: number) => Promise<Buffer>;
  signal?: AbortSignal;
}
/** One shared budget can cover top-level and nested moov scans. */
export class CacheMp4BoxReader {
  private count = 0;
  constructor(
    private readonly port: CacheMp4ReadPort,
    private readonly maximumBoxes = 10000,
  ) {
    if (
      !Number.isSafeInteger(maximumBoxes) ||
      maximumBoxes < 1 ||
      maximumBoxes > 10000
    )
      throw Error('CACHE_INVALID_MP4_BUDGET');
  }
  async scan(start: number, end: number): Promise<CacheMp4Box[]> {
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start
    )
      throw Error('CACHE_INVALID_MP4');
    const boxes: CacheMp4Box[] = [];
    for (let at = start; at < end; ) {
      this.port.signal?.throwIfAborted();
      if (++this.count > this.maximumBoxes || end - at < 8)
        throw Error('CACHE_INVALID_MP4');
      const bytes = await this.port.read(at, Math.min(16, end - at));
      this.port.signal?.throwIfAborted();
      const box = readCacheMp4Box(bytes, at, end);
      boxes.push(box);
      at = box.end;
    }
    this.port.signal?.throwIfAborted();
    return boxes;
  }
}
