import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverCaptureDevices } from './captureDevices';

afterEach(() => vi.unstubAllGlobals());

describe('capture input discovery', () => {
  it('requests both permissions and closes the probe after discovering named inputs', async () => {
    const stop = vi.fn();
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop }],
    });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'videoinput', deviceId: 'camera', label: 'USB Camera' },
          { kind: 'audioinput', deviceId: 'microphone', label: 'USB Audio' },
          { kind: 'audioinput', deviceId: '', label: '' },
          { kind: 'audiooutput', deviceId: 'speaker', label: 'Speaker' },
        ]),
      },
    });
    expect(await discoverCaptureDevices()).toEqual([
      { id: 'camera', name: 'USB Camera', kind: 'video' },
      { id: 'microphone', name: 'USB Audio', kind: 'audio' },
    ]);
    expect(getUserMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(stop).toHaveBeenCalledOnce();
  });

  it('retains video-only capture if microphone access fails', async () => {
    const stop = vi.fn();
    const getUserMedia = vi
      .fn()
      .mockRejectedValueOnce(new Error('Microphone unavailable'))
      .mockResolvedValueOnce({ getTracks: () => [{ stop }] });
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia,
        enumerateDevices: vi.fn().mockRejectedValue(new Error('Disconnected')),
      },
    });
    await expect(discoverCaptureDevices()).rejects.toThrow('Disconnected');
    expect(getUserMedia).toHaveBeenLastCalledWith({
      video: true,
      audio: false,
    });
    expect(stop).toHaveBeenCalledOnce();
  });
});
