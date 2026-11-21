// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { AudioAnalysisResult } from '../../../../../types/video/sync';
import { runAudioSyncAnalysis } from '../../../../../utils/AudioSyncAnalyzer';
import { useAutoAudioResync } from './useAutoAudioResync';

vi.mock('../../../../../utils/AudioSyncAnalyzer', () => ({ runAudioSyncAnalysis: vi.fn() }));
const result = {offsetSeconds: 1.25, confidence: 0.98, correlationPeak: 1, secondBestCorrelation: 0, consistencyScore: 1, usableWindowCount: 3} satisfies AudioAnalysisResult;
const paths = ['a.mp4', 'b.mp4', 'c.mp4'];

it('drops stale results after switching or resetting and retries after a decode failure', async () => {
  const apply = vi.fn(async () => {});
  const set = vi.fn();
  const error = vi.fn();
  const run = vi.mocked(runAudioSyncAnalysis);
  const initialSync = {syncOffset: 4, angleOffsets: [0, 4, -0.5], isAnalyzed: true};
  const hook = renderHook(({document, sync}) => useAutoAudioResync({
    videoList: paths, metaDataConfigFilePath: document,
    syncData: sync,
    setSyncData: set, forceUpdateVideoPlayers: apply, onSyncError: error,
  }), {initialProps: {document: 'A', sync: initialSync}});
  const pending = async () => {
    let resolve!: (value: AudioAnalysisResult) => void;
    run.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    let work!: Promise<void>;
    act(() => { work = hook.result.current.resyncAudio(); });
    await vi.waitFor(() => expect(resolve).toBeTypeOf('function'));
    return { resolve, work };
  };
  try {
    const old = await pending();
    hook.rerender({document: 'B', sync: initialSync});
    await act(async () => { old.resolve(result); await old.work; });
    expect(set).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    run.mockRejectedValueOnce(new Error('decode failed'));
    await act(() => hook.result.current.resyncAudio());
    expect(error).toHaveBeenCalledOnce();
    expect(set).not.toHaveBeenCalled();
    const cancelled = await pending();
    act(() => hook.result.current.resetSync());
    expect(set.mock.lastCall?.[0].angleOffsets).toEqual([0, 0, -0.5]);
    set.mockClear();
    apply.mockClear();
    await act(async () => { cancelled.resolve(result); await cancelled.work; });
    expect(set).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    const superseded = await pending();
    hook.rerender({document: 'B', sync: {...initialSync, syncOffset: 2, angleOffsets: [0, 2, -0.5]}});
    await act(async () => { superseded.resolve(result); await superseded.work; });
    expect(set).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(hook.result.current.isAnalyzing).toBe(false);
    run.mockResolvedValueOnce(result);
    await act(() => hook.result.current.resyncAudio());
    expect(set.mock.lastCall?.[0].angleOffsets).toEqual([0, 1.25, -0.5]);
    expect(apply).toHaveBeenCalledOnce();
    expect(hook.result.current.isAnalyzing).toBe(false);
  } finally {
    hook.unmount();
  }
});

it('can analyze a second angle added to the same open package', async () => {
  const setSyncData = vi.fn();
  const onSyncWarning = vi.fn();
  const apply = vi.fn(async () => {});
  const run = vi.mocked(runAudioSyncAnalysis);
  run.mockClear();
  const hook = renderHook(({ videoList }) => useAutoAudioResync({
    videoList,
    metaDataConfigFilePath: 'same/.metadata/config.json',
    syncData: undefined,
    setSyncData,
    onSyncWarning,
    forceUpdateVideoPlayers: apply,
  }), { initialProps: { videoList: ['a.mp4'] } });
  try {
    await act(() => hook.result.current.resyncAudio());
    expect(run).not.toHaveBeenCalled();
    expect(onSyncWarning).toHaveBeenCalledWith('2つの映像が必要です');
    hook.rerender({ videoList: ['a.mp4', 'b.mp4'] });
    run.mockResolvedValueOnce(result);
    await act(() => hook.result.current.resyncAudio());
    expect(run).toHaveBeenCalledWith(expect.objectContaining({
      videoPath1: 'a.mp4',
      videoPath2: 'b.mp4',
    }));
    expect(setSyncData.mock.lastCall?.[0].angleOffsets).toEqual([0, 1.25]);
  } finally {
    hook.unmount();
  }
});
