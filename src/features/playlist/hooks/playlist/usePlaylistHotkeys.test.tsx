// @vitest-environment jsdom

import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePlaylistHotkeys } from './usePlaylistHotkeys';

describe('usePlaylistHotkeys', () => {
  it('uses continuous reverse shortcuts without conflicting with previous item', () => {
    const { result } = renderHook(() => usePlaylistHotkeys());
    const byId = new Map(
      result.current.map((hotkey) => [hotkey.id, hotkey.key]),
    );

    expect(byId.get('reverse-playback-slow')).toBe('Left');
    expect(byId.get('reverse-playback-2x')).toBe('Shift+Left');
    expect(byId.get('reverse-playback-4x')).toBe('Option+Left');
    expect(byId.get('reverse-playback-6x')).toBe('Command+Left');
    expect(byId.get('previous-item')).toBe('Command+Option+Left');
  });
});
