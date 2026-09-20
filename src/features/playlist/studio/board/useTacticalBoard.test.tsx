// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useTacticalBoard } from './useTacticalBoard';
import {
  capturePitchFrame,
  recognizePitchFrame,
} from './pitchRecognitionGateway';
import type { PitchDetection } from './pitchRecognition';
vi.mock('./pitchRecognitionGateway', () => ({
  capturePitchFrame: vi.fn(),
  recognizePitchFrame: vi.fn(),
}));
afterEach(() => vi.restoreAllMocks());
const calibration = {
  widthMeters: 70,
  lengthMeters: 100,
  referenceTime: 0,
  corners: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
};
const params = {
  enabled: true,
  calibration,
  time: 10,
  clipStart: 10,
  video: () => null,
  onSave: vi.fn(),
  onSeek: vi.fn(),
};
it('discards a pending recognition result when the clip or angle changes', async () => {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,');
  vi.mocked(capturePitchFrame).mockReturnValue(canvas);
  let resolve: (value: PitchDetection[]) => void = () => {};
  vi.mocked(recognizePitchFrame).mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const { result, rerender } = renderHook(
    ({ key }) => useTacticalBoard({ ...params, documentKey: key }),
    { initialProps: { key: 'clip-one:primary' } },
  );
  act(() => result.current.onOpen());
  expect(result.current.view.canRecognize).toBe(true);
  let job: void | Promise<void>;
  act(() => {
    job = result.current.view.onDetect();
  });
  expect(result.current.view.busy).toBe(true);
  rerender({ key: 'clip-two:secondary' });
  await act(async () => {
    resolve([
      { x: 0.3, y: 0.2, width: 0.1, height: 0.4, kind: 'neutral', score: 0.9 },
    ]);
    await job;
  });
  expect(result.current.view.open).toBe(false);
  expect(result.current.view.candidates).toBeNull();
});
it('requires a current-frame calibration before recognition and does not silently mix saved board times', () => {
  const canvas = document.createElement('canvas');
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/jpeg;base64,');
  vi.mocked(capturePitchFrame).mockReturnValue(canvas);
  const { result } = renderHook(() =>
    useTacticalBoard({
      ...params,
      documentKey: 'clip',
      time: 13,
      saved: {
        widthMeters: 70,
        lengthMeters: 100,
        time: 0,
        markers: [],
        arrows: [],
      },
    }),
  );
  act(() => result.current.onOpen());
  expect(result.current.view.canRecognize).toBe(false);
  expect(result.current.view.onGoToFrame).toBeDefined();
  act(() => result.current.view.onUseCurrentFrame?.());
  expect(result.current.view.editor.board.time).toBe(3);
  expect(result.current.view.canRecognize).toBe(false);
  act(() => result.current.view.editor.onUndo());
  expect(result.current.view.editor.board.time).toBe(0);
});
