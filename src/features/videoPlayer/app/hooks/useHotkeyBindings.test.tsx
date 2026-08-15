// @vitest-environment jsdom

import { createRef } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EnhancedCodePanelHandle } from '../../components/Controls/EnhancedCodePanel';
import { useHotkeyBindings } from './useHotkeyBindings';

describe('useHotkeyBindings reverse playback', () => {
  it('maps slow, 2x, 4x, and 6x reverse commands and stops them on keyup', () => {
    const startReversePlayback = vi.fn();
    const stopReversePlayback = vi.fn();
    const { result } = renderHook(() =>
      useHotkeyBindings({
        teamNames: [],
        settingsHotkeys: [],
        activeActions: [],
        timelineActionRef: createRef<EnhancedCodePanelHandle | null>(),
        setVideoPlayBackRate: vi.fn(),
        setIsVideoPlaying: vi.fn(),
        setViewMode: vi.fn(),
        startReversePlayback,
        stopReversePlayback,
        performUndo: vi.fn(),
        performRedo: vi.fn(),
        resyncAudio: vi.fn(),
        resetSync: vi.fn(),
        manualSyncFromPlayers: vi.fn(),
        setSyncMode: vi.fn(),
        onAnalyze: vi.fn(),
      }),
    );

    act(() => {
      result.current.combinedHandlers['reverse-playback-slow']?.();
      result.current.combinedHandlers['reverse-playback-2x']?.();
      result.current.combinedHandlers['reverse-playback-4x']?.();
      result.current.combinedHandlers['reverse-playback-6x']?.();
    });

    expect(startReversePlayback.mock.calls.map(([rate]) => rate)).toEqual([
      0.5, 2, 4, 6,
    ]);

    act(() => {
      result.current.keyUpHandlers['reverse-playback-6x']?.();
    });
    expect(stopReversePlayback).toHaveBeenCalledTimes(1);
  });
});
