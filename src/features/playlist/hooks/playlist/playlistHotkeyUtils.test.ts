// @vitest-environment jsdom
import { expect, it } from 'vitest';
import { applyPlaybackRate } from './playlistHotkeyUtils';

it.each([0.5, 2, 4, 6])('keeps %sx across a source load and restores normal speed on release', (rate) => {
  const first = document.createElement('video');
  const second = document.createElement('video');
  const refs = { primary: { current: first }, secondary: { current: second } };
  applyPlaybackRate(refs, rate);
  // HTML media load restores playbackRate to the element's defaultPlaybackRate.
  second.playbackRate = second.defaultPlaybackRate;
  expect([first.playbackRate, second.playbackRate]).toEqual([rate, rate]);
  applyPlaybackRate(refs, 1);
  expect([first.playbackRate, second.playbackRate]).toEqual([1, 1]);
  expect([first.defaultPlaybackRate, second.defaultPlaybackRate]).toEqual([1, 1]);
});
