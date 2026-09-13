import { describe, expect, it, vi } from 'vitest';
vi.mock('electron', () => ({ desktopCapturer: {}, webContents: {} }));
import { isLoopbackAudioCaptureSupported } from './loopbackAudioCapture';

describe('loopback capture platforms', () => {
  it('supports Windows and retains macOS version checks', () => {
    expect(isLoopbackAudioCaptureSupported('win32', '10.0.26100')).toBe(true);
    expect(isLoopbackAudioCaptureSupported('darwin', '22.0.0')).toBe(true);
    expect(isLoopbackAudioCaptureSupported('darwin', '21.0.0')).toBe(false);
    expect(isLoopbackAudioCaptureSupported('linux', '6.1')).toBe(false);
  });
});
