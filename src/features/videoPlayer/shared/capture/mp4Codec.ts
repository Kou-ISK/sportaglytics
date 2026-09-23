/** Read codec declarations from the initialization boxes, never from media payloads. */
export const captureMp4MimeType = (data: ArrayBuffer): string => {
  const view = new DataView(data);
  const text = (start: number, length: number): string =>
    String.fromCharCode(...new Uint8Array(data, start, length));
  let video = '';
  let audio = false;
  const containers: Record<string, number> = {
    moov: 0,
    trak: 0,
    mdia: 0,
    minf: 0,
    stbl: 0,
    stsd: 8,
    avc1: 78,
  };
  const visit = (start: number, end: number, depth: number): void => {
    if (depth > 10) throw new Error('Invalid MP4 nesting');
    for (let at = start; at + 8 <= end; ) {
      const size = view.getUint32(at);
      const type = text(at + 4, 4);
      if (size < 8 || at + size > end) return;
      if (type === 'avcC' && size >= 12)
        video = `avc1.${[9, 10, 11]
          .map((offset) =>
            view
              .getUint8(at + offset)
              .toString(16)
              .padStart(2, '0'),
          )
          .join('')}`;
      if (type === 'mp4a') audio = true;
      if (type in containers)
        visit(at + 8 + containers[type], at + size, depth + 1);
      at += size;
    }
  };
  visit(0, data.byteLength, 0);
  if (!video) throw new Error('H.264 initialization is missing');
  return `video/mp4; codecs="${video}${audio ? ',mp4a.40.2' : ''}"`;
};
