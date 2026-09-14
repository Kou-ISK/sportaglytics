// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useRecentPackages } from './useRecentPackages';
import { loadRecentPackagesFromStorage } from '../gateway/recentPackagesGateway';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});
const match = (name: string) => ({
  path: `/matches/${name}.stpkg`,
  name,
  team1Name: 'Red',
  team2Name: 'Blue',
  videoCount: 1,
});

describe('recent package persistence', () => {
  it('persists metadata that finishes loading after the launcher unmounts', () => {
    const { result, unmount } = renderHook(() => useRecentPackages());
    const register = result.current.addRecentPackage;
    unmount();
    register(match('reopen'));
    expect(loadRecentPackagesFromStorage()).toEqual([
      expect.objectContaining(match('reopen')),
    ]);
    const next = renderHook(() => useRecentPackages());
    expect(next.result.current.recentPackages[0].name).toBe('reopen');
  });

  it('merges and removes against the latest shared history without overwriting another window', () => {
    const first = renderHook(() => useRecentPackages());
    const second = renderHook(() => useRecentPackages());
    act(() => first.result.current.addRecentPackage(match('first')));
    act(() => second.result.current.addRecentPackage(match('second')));
    expect(loadRecentPackagesFromStorage().map((entry) => entry.name)).toEqual([
      'second',
      'first',
    ]);
    act(() => first.result.current.removeRecentPackage(match('first').path));
    expect(loadRecentPackagesFromStorage().map((entry) => entry.name)).toEqual([
      'second',
    ]);
  });
});
