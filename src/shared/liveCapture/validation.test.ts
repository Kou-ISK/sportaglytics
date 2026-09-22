import { describe, expect, it } from 'vitest';
import {
  CAPTURE_MAX_CHUNK_BYTES,
  isCaptureChunk,
  isCaptureStartRequest,
  isCaptureUrl,
} from './validation';

describe('capture IPC validation', () => {
  it.each([
    'rtsp://camera.example/live',
    'rtsps://camera.example/live',
    'rtmp://camera.example/app/stream',
    'rtmps://camera.example/app/stream',
    'https://camera.example/live.m3u8',
    'http://operator:example@127.0.0.1:8080/live',
  ])('accepts a supported direct feed: %s', (url) =>
    expect(isCaptureUrl(url)).toBe(true),
  );
  it.each([
    'file:///private/video.mp4',
    'concat:http://a|file:/secret',
    'pipe:0',
    'udp://camera.example',
    'http://camera.example/\ninput',
    'https://camera.example/live#fragment',
    '-i other',
    '',
    null,
  ])('rejects local/nested/unsupported input: %s', (url) =>
    expect(isCaptureUrl(url)).toBe(false),
  );
  it('rejects duplicate IDs, path traversal, oversized source lists and malformed chunks', () => {
    const request = {
      name: 'Live',
      quality: '1080p',
      inputs: [{ id: 'camera', name: 'Angle 1', kind: 'device' }],
    };
    expect(isCaptureStartRequest(request)).toBe(true);
    expect(
      isCaptureStartRequest({
        ...request,
        inputs: [...request.inputs, ...request.inputs],
      }),
    ).toBe(false);
    expect(isCaptureStartRequest({ ...request, name: '../existing' })).toBe(
      false,
    );
    expect(
      isCaptureStartRequest({
        ...request,
        inputs: [{ ...request.inputs[0], id: '../outside' }],
      }),
    ).toBe(false);
    expect(
      isCaptureStartRequest({
        ...request,
        inputs: Array.from({ length: 5 }, (_, i) => ({
          ...request.inputs[0],
          id: `cam${i}`,
        })),
      }),
    ).toBe(false);
    const chunk = {
      sessionId: 'session',
      inputId: 'camera',
      sequence: 0,
      data: new Uint8Array(16),
    };
    expect(isCaptureChunk(chunk)).toBe(true);
    expect(isCaptureChunk({ ...chunk, sequence: -1 })).toBe(false);
    expect(isCaptureChunk({ ...chunk, sequence: 0.5 })).toBe(false);
    expect(
      isCaptureChunk({
        ...chunk,
        data: new Uint8Array(CAPTURE_MAX_CHUNK_BYTES + 1),
      }),
    ).toBe(false);
    expect(isCaptureChunk({ ...chunk, data: [1, 2] })).toBe(false);
  });
});
