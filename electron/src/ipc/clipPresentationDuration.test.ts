import { expect, it } from 'vitest';
import { clipPresentationDuration } from './clipPresentationDuration';

it('counts every active Paint freeze and ignores an unused default duration', () => {
  const clip = { id:'clip', actionName:'Review', startTime:3, endTime:13, freezeDuration:2 };
  expect(clipPresentationDuration(clip)).toBe(10);
  expect(clipPresentationDuration({ ...clip, freezeAt:4 })).toBe(12);
  expect(clipPresentationDuration({ ...clip, freezeAt:4, freezeFrames:[] })).toBe(10);
  expect(clipPresentationDuration({ ...clip, freezeFrames:[{time:2,duration:2},{time:5,duration:3}] })).toBe(15);
});
