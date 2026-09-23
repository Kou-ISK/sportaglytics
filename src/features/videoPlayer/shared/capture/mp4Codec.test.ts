import { describe, expect, it } from 'vitest';
import { captureMp4MimeType } from './mp4Codec';

const box = (type: string, ...contents: Uint8Array[]): Uint8Array => {
  const size = 8 + contents.reduce((sum, part) => sum + part.length, 0);
  const bytes = new Uint8Array(size);
  new DataView(bytes.buffer).setUint32(0, size);
  bytes.set(new TextEncoder().encode(type), 4);
  let offset = 8;
  for (const part of contents) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
};
const init = (audio: boolean): ArrayBuffer => {
  const avc = box(
    'avc1',
    new Uint8Array(78),
    box('avcC', new Uint8Array([1, 0x64, 0, 0x28])),
  );
  const stsd = box(
    'stsd',
    new Uint8Array(8),
    avc,
    ...(audio ? [box('mp4a', new Uint8Array(28))] : []),
  );
  const result = box(
    'moov',
    box('trak', box('mdia', box('minf', box('stbl', stsd)))),
  );
  return new Uint8Array(result).buffer;
};
describe('capture codec declarations', () => {
  it('reads H.264 profile/level and optional AAC from sample descriptions', () => {
    expect(captureMp4MimeType(init(true))).toBe(
      'video/mp4; codecs="avc1.640028,mp4a.40.2"',
    );
    expect(captureMp4MimeType(init(false))).toBe(
      'video/mp4; codecs="avc1.640028"',
    );
  });
  it('does not mistake media payload for initialization', () => {
    const result = box('mdat', new Uint8Array(init(true)));
    expect(() => captureMp4MimeType(new Uint8Array(result).buffer)).toThrow();
    expect(() =>
      captureMp4MimeType(new Uint8Array([0, 0, 0, 1]).buffer),
    ).toThrow();
  });
});
