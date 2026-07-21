import { describe, expect, it } from 'vitest';
import { resolveVideoSource } from './utils';

describe('resolveVideoSource', () => {
  it('uses the YouTube Video.js tech for YouTube URLs', () => {
    expect(resolveVideoSource('https://youtu.be/example')).toEqual({
      src: 'https://youtu.be/example',
      type: 'video/youtube',
    });
  });

  it('keeps local paths on the HTML5 video tech', () => {
    expect(resolveVideoSource('/tmp/match.mp4')).toEqual({
      src: 'file:///tmp/match.mp4',
      type: 'video/mp4',
    });
  });
});
