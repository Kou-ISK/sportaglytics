import { describe, expect, it } from 'vitest';
import { meetingAudioProfile } from './meetingAudioProfile';

const mono = { layout: 'mono', channels: 1, rate: 44100, codec: 'aac' };
const surround = { layout: '5.1', channels: 6, rate: 48000, codec: 'aac' };

describe('meeting audio across clips and slides', () => {
  it('keeps mono and its sample rate across silent items', () => {
    expect(meetingAudioProfile([null, mono])).toEqual({ layout: 'mono', channels: 1, rate: 44100 });
  });
  it('retains the widest layout independent of presentation order', () => {
    for (const tracks of [[mono, surround], [surround, mono]]) {
      expect(meetingAudioProfile(tracks)).toEqual({ layout: '5.1', channels: 6, rate: 48000 });
    }
  });
  it('reports incompatible channel positions instead of silently remapping them', () => {
    expect(() => meetingAudioProfile([surround, { ...surround, layout: '5.1(side)' }])).toThrow(/配置/);
  });
});
