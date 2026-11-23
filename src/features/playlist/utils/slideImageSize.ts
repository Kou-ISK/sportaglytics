const MAX_SIDE = 8192;
const MAX_PIXELS = 24_000_000;

const acceptable = (width: number, height: number): boolean =>
  width > 0 && height > 0 && width <= MAX_SIDE && height <= MAX_SIDE && width * height <= MAX_PIXELS;

/** Read image metadata before allocating pixels. Support PNG and conventional JPEG frames. */
export const fitsSlideImport = (bytes: Uint8Array, mime: string): boolean => {
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === 'image/png') {
    const header = [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82];
    return bytes.length >= 33 && header.every((value, index) => bytes[index] === value) &&
      acceptable(data.getUint32(16), data.getUint32(20));
  }
  if (mime !== 'image/jpeg' || bytes[0] !== 255 || bytes[1] !== 216) return false;
  let offset = 2;
  while (offset + 3 < bytes.length) {
    if (bytes[offset++] !== 255) return false;
    while (offset < bytes.length && bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (offset + 2 > bytes.length || marker === 218 || marker === 217) return false;
    const length = data.getUint16(offset);
    if (length < 2 || length > bytes.length - offset) return false;
    if ([192,193,194].includes(marker)) {
      return length >= 8 && acceptable(data.getUint16(offset + 5), data.getUint16(offset + 3));
    }
    offset += length;
  }
  return false;
};
