import { expect, it } from 'vitest';
import { parseNativePlaybackAvailability } from './nativePlayback';
const source = { available: true, owner: { generation: 'owner', sourceKey: 'a'.repeat(64) },
  sourceUrl: 'file:///synthetic.mp4', sourceEnd: 20, presentation: null, reason: null };
const presentation = { width: 1920, height: 1080, start: 0, end: 20, seekEnd: 19,
  playEnd: 19.5, rates: [1, -2], audioTracks: 1, seekGrid: null,
  mutedOnly: true, exactFloatVolume: false, audioSwitch: false };
it('retains absent legacy authority and copies only the qualified group rate scope', () => {
  expect(parseNativePlaybackAvailability(source)).toEqual(source);
  const parsed = parseNativePlaybackAvailability({ ...source, presentation, clockAuthority: 'drawn-pair' });
  expect(parsed.clockAuthority).toBe('drawn-pair');
  expect(parsed.presentation?.rates).toEqual([1, -2]);
  expect(parsed.presentation?.rates).not.toBe(presentation.rates);
});
it.each([
  { ...source, clockAuthority: 'drawn-pair' },
  { ...source, presentation, clockAuthority: 'unknown' },
  { ...source, presentation, clockAuthority: 'source-clock' },
  { available: false, owner: null, sourceUrl: null, sourceEnd: null,
    presentation: null, reason: 'unsupported', clockAuthority: 'drawn-pair' },
])('rejects missing, unknown or disabled group authority', (value) => {
  expect(() => parseNativePlaybackAvailability(value)).toThrow();
});
