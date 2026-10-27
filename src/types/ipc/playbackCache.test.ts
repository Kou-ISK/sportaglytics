import { describe, expect, it } from 'vitest';
import {
  parsePlaybackCacheCandidate,
  parsePlaybackCacheRequest,
  parsePlaybackCacheSelection,
  parsePlaybackCacheSnapshot,
} from './playbackCache';

const request = {
  generation: '12345678-1234-1234-1234-123456789abc',
  sourceKey: 'a'.repeat(64),
};
const snapshot = {
  generation: request.generation,
  source: {
    key: request.sourceKey,
    url: 'file:///fixture/media.mp4',
    label: 'media.mp4',
    audioTracks: null,
  },
  status: { phase: 'ready', selected: 'original', progress: null, error: null },
  available: true,
  maximumCacheBytes: 1024,
  reserveBytes: 512,
};
describe('playback cache IPC boundary', () => {
  it('accepts exact owner requests and explicit original selection', () => {
    expect(parsePlaybackCacheRequest(request)).toEqual(request);
    expect(parsePlaybackCacheSelection({ ...request, ticket: null })).toEqual({
      ...request,
      ticket: null,
    });
    expect(parsePlaybackCacheSnapshot(snapshot)).toEqual(snapshot);
  });
  it.each([
    null,
    [],
    {},
    { ...request, generation: 'expired' },
    { ...request, sourceKey: 'g'.repeat(64) },
    { ...request, path: '/fixture/arbitrary.mp4' },
    { ...request, proof: true },
  ])(
    'rejects invalid requests without coercing owner identity: %j',
    (value) => {
      expect(() => parsePlaybackCacheRequest(value)).toThrow();
    },
  );
  it('requires a ticket or explicit null and rejects extra selection properties', () => {
    expect(() => parsePlaybackCacheSelection(request)).toThrow();
    expect(() =>
      parsePlaybackCacheSelection({ ...request, ticket: null, paused: true }),
    ).toThrow();
  });
  it('rejects non-file candidate URLs and invalid audio counts', () => {
    const candidate = {
      url: 'file:///cache/media.mp4',
      ticket: request.generation,
      audioTracks: 3,
    };
    expect(parsePlaybackCacheCandidate(candidate)).toEqual(candidate);
    for (const change of [
      { url: 'https://example.invalid/media.mp4' },
      { audioTracks: 1.5 },
      { audioTracks: 9 },
      { audioTracks: '3' },
    ])
      expect(() =>
        parsePlaybackCacheCandidate({ ...candidate, ...change }),
      ).toThrow();
  });
  it('rejects malformed Main status instead of exposing it to the controller', () => {
    for (const change of [
      { progress: NaN },
      { progress: 1.01 },
      { phase: 'complete' },
      { error: undefined },
      { selected: 'external' },
    ])
      expect(() =>
        parsePlaybackCacheSnapshot({
          ...snapshot,
          status: { ...snapshot.status, ...change },
        }),
      ).toThrow();
    expect(() =>
      parsePlaybackCacheSnapshot({
        ...snapshot,
        source: { ...snapshot.source, audioTracks: -1 },
      }),
    ).toThrow();
    expect(() =>
      parsePlaybackCacheSnapshot({ ...snapshot, available: 1 }),
    ).toThrow();
    expect(() =>
      parsePlaybackCacheSnapshot({ ...snapshot, maximumCacheBytes: Infinity }),
    ).toThrow();
  });
});
