/* @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { expect, it } from 'vitest';
import { useHeldPlayback } from './useHeldPlayback';

it.each([false, true])(
  'restores playing=%s and the prior speed after temporary keys',
  (playing) => {
    const { result } = renderHook(() => {
      const [state, apply] = useState({ playing, rate: 1.25 });
      return { state, ...useHeldPlayback(() => state, apply) };
    });
    act(() => result.current.start('slow', 0.5));
    expect(result.current.state).toEqual({ playing: true, rate: 0.5 });
    act(() => result.current.start('fast', 6));
    act(() => result.current.stop('slow'));
    expect(result.current.state.rate).toBe(6);
    act(() => result.current.stop('fast'));
    expect(result.current.state).toEqual({ playing, rate: 1.25 });
  },
);

it('ignores late keyup after another playback command cancels the hold', () => {
  const { result } = renderHook(() => {
    const [state, apply] = useState({ playing: true, rate: 1 });
    return { state, apply, ...useHeldPlayback(() => state, apply) };
  });
  act(() => result.current.start('fast', 6));
  act(() => {
    result.current.cancel();
    result.current.apply({ playing: false, rate: 1 });
  });
  act(() => result.current.stop('fast'));
  expect(result.current.state.playing).toBe(false);
});
