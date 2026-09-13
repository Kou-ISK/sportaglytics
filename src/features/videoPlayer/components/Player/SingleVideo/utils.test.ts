import { describe, expect, it } from 'vitest';
import { formatSource, resolveVideoSource } from './utils';

describe('resolveVideoSource', () => {
  it('escapes Windows drive paths, UNC shares and URL delimiters', () => {
    expect(formatSource('C:\\試合 #1\\50% 角度.mp4')).toBe('file:///C:/%E8%A9%A6%E5%90%88%20%231/50%25%20%E8%A7%92%E5%BA%A6.mp4');
    expect(formatSource('\\\\server\\share\\match #1.mp4')).toBe('file://server/share/match%20%231.mp4');
    expect(formatSource('/tmp/match?1#2%.mp4')).toBe('file:///tmp/match%3F1%232%25.mp4');
    expect(formatSource('file:///C:/match%20one.mp4')).toBe('file:///C:/match%20one.mp4');
  });
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
