import { expect, it } from 'vitest';
import {
  readCacheNativeAudio,
  restoreCacheNativeAudio,
} from './cacheNativeAudio';

it('preserves the exact three-track selection in both source directions', () => {
  const original = {
    audioTracks: [{ enabled: false }, { enabled: true }, { enabled: false }],
  };
  const saved = readCacheNativeAudio(original);
  const cache = {
    audioTracks: [{ enabled: true }, { enabled: false }, { enabled: false }],
  };
  restoreCacheNativeAudio(cache, saved, 3);
  expect(readCacheNativeAudio(cache)).toEqual([false, true, false]);
  original.audioTracks[0].enabled = true;
  original.audioTracks[1].enabled = false;
  restoreCacheNativeAudio(original, readCacheNativeAudio(cache), 3);
  expect(readCacheNativeAudio(original)).toEqual(saved);
});

it('rejects absent, emulated, malformed or incomplete lists before adopting multi-track media', () => {
  for (const element of [
    null,
    {},
    { audioTracks: null },
    { audioTracks: { length: -1 } },
    { audioTracks: { length: 9 } },
    { audioTracks: [{ enabled: 'true' }] },
    { audioTracks: [] },
  ]) {
    expect(() =>
      restoreCacheNativeAudio(element, [true, false, false], 3),
    ).toThrow('CACHE_AUDIO_SELECTION_UNAVAILABLE');
  }
  expect(() =>
    restoreCacheNativeAudio(
      { audioTracks: [{ enabled: true }] },
      [true, false, false],
      3,
    ),
  ).toThrow();
});

it('rejects native setters that ignore or normalize the selection', () => {
  const ignored = {
    get enabled(): boolean {
      return true;
    },
    set enabled(_value: boolean) {
      /* Native setter ignores request. */
    },
  };
  expect(() =>
    restoreCacheNativeAudio(
      { audioTracks: [ignored, { enabled: false }] },
      [false, true],
      2,
    ),
  ).toThrow('CACHE_AUDIO_SELECTION_CHANGED');
});

it('retains all-disabled state and supports silent or single-track runtimes without the API', () => {
  const element = { audioTracks: [{ enabled: true }, { enabled: false }] };
  restoreCacheNativeAudio(element, [false, false], 2);
  expect(readCacheNativeAudio(element)).toEqual([false, false]);
  expect(() => restoreCacheNativeAudio({}, null, 0)).not.toThrow();
  expect(() => restoreCacheNativeAudio({}, null, 1)).not.toThrow();
  expect(() => restoreCacheNativeAudio({ audioTracks: [] }, null, 1)).toThrow();
});
