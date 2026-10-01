import { expect, it } from 'vitest';
import { resolvePackageMediaPath } from './packageMediaPath';
it.each([
  ['file:///C:/Videos/match%20%23%25.mp4', 'C:/Videos/match #%.mp4'],
  ['file://server/share/match%20%23%25.mp4', '//server/share/match #%.mp4'],
  ['file://localhost/tmp/match.mp4', '/tmp/match.mp4'],
  ['videos/second.mp4', '/copy.stpkg/videos/second.mp4'],
])('resolves %s without guessing a media location', (reference, expected) => {
  expect(resolvePackageMediaPath('/copy.stpkg', reference)).toBe(expected);
});
it.each([
  'file:///tmp/a%2fb.mp4',
  'file:///tmp/a%5cb.mp4',
  'file:///tmp/a.mp4?download=1',
  'file:///tmp/a.mp4#section',
  'https://example.test/a.mp4',
  'file:///tmp/a%00.mp4',
])('rejects ambiguous local media reference %s', (reference) => {
  expect(() => resolvePackageMediaPath('/copy.stpkg', reference)).toThrow();
});
