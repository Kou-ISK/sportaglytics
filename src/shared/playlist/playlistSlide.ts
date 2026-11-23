import type { PlaylistItem, PlaylistSlide } from '../../types/playlist/core';

export const SLIDE_WIDTH = 1280;
export const SLIDE_HEIGHT = 720;
export const MAX_SLIDE_PNG_LENGTH = 5 * 1024 * 1024;

// Only accept a bounded PNG with an IHDR. Never load document-supplied URLs.
export const isSlidePng = (value: unknown, exactSize = false): value is string => {
  const prefix = 'data:image/png;base64,';
  if (typeof value !== 'string' || value.length > MAX_SLIDE_PNG_LENGTH ||
      !value.startsWith(prefix) || value.length < prefix.length + 44) return false;
  const encoded = value.slice(prefix.length);
  if (encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return false;
  const header = Uint8Array.from(atob(encoded.slice(0, 44)), (char) => char.charCodeAt(0));
  const expected = [137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82];
  if (!expected.every((byte, i) => header[i] === byte)) return false;
  const view = new DataView(header.buffer);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return exactSize ? width === SLIDE_WIDTH && height === SLIDE_HEIGHT :
    width > 0 && width <= SLIDE_WIDTH && height > 0 && height <= SLIDE_HEIGHT;
};

export const isSlideDuration = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 120;

export const isPlaylistSlide = (value: unknown): value is PlaylistSlide =>
  typeof value === 'object' && value !== null &&
  'title' in value && typeof value.title === 'string' &&
  value.title.trim().length > 0 && value.title.length <= 80 &&
  'body' in value && typeof value.body === 'string' && value.body.length <= 320 &&
  (!('image' in value) || value.image === undefined || isSlidePng(value.image));

export const validateSlideItem = (item: PlaylistItem): void => {
  if (item.slide === undefined) return;
  if (!isPlaylistSlide(item.slide) || item.startTime !== 0 ||
      !isSlideDuration(item.endTime) || item.videoSource || item.videoSource2 ||
      item.mediaReference || item.mediaReference2 || item.annotation)
    throw new Error('スライドの形式、表示秒数または画像を確認してください。');
};
