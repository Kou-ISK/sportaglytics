// @vitest-environment jsdom
import { Blob as NodeBlob } from 'node:buffer';
import { afterEach, expect, it, vi } from 'vitest';
import type { ILiveCaptureAPI } from '../../types/liveCapture';
import { recordCaptureDevice } from './deviceRecorder';

const devices: FakeRecorder[] = [];
class FakeRecorder extends EventTarget {
  static isTypeSupported(): boolean {
    return true;
  }
  state: RecordingState = 'inactive';
  constructor() {
    super();
    devices.push(this);
  }
  start(): void {
    this.state = 'recording';
  }
  emit(data: Blob): void {
    const event = new Event('dataavailable');
    Object.defineProperty(event, 'data', { value: data });
    this.dispatchEvent(event);
  }
  stop(): void {
    this.state = 'inactive';
    queueMicrotask(() => {
      this.emit(new Blob(['final']));
      this.dispatchEvent(new Event('stop'));
    });
  }
}
afterEach(() => {
  devices.length = 0;
  vi.unstubAllGlobals();
});
it('splits large chunks, preserves acknowledgement order, and flushes final data before stopping tracks', async () => {
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  vi.stubGlobal('Blob', NodeBlob);
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  // Only the MediaStream methods consumed by this adapter are simulated.
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const append = vi
    .fn<ILiveCaptureAPI['append']>()
    .mockResolvedValue(undefined);
  const api: ILiveCaptureAPI = {
    append,
    endInput: vi.fn(),
    open: vi.fn(),
    authorizeDevices: vi.fn(),
    capabilities: vi.fn(),
    start: vi.fn(),
    retry: vi.fn(),
    stop: vi.fn(),
    getState: vi.fn(),
    onState: vi.fn(),
    onStopRequest: vi.fn(),
  };
  const onError = vi.fn();
  const recording = recordCaptureDevice(stream, 'session', 'one', api, onError);
  devices[0].emit(new Blob([new Uint8Array(1024 * 1024 + 10)]));
  devices[0].emit(new Blob(['next']));
  await recording.stop();
  expect(append.mock.calls.map(([chunk]) => chunk.sequence)).toEqual([
    0, 1, 2, 3,
  ]);
  expect(append.mock.calls.map(([chunk]) => chunk.data.length)).toEqual([
    1024 * 1024,
    10,
    4,
    5,
  ]);
  expect(track.stop).toHaveBeenCalledTimes(1);
  expect(onError).not.toHaveBeenCalled();
});
